using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Reception;

public record RegistrationInputV2(string Contact, Guid? PreferredDepartmentId, string Description, string SourceLanguage);
public record RegistrationViewV2(Guid Id, int Version, DateTime CreatedAt, string ContractVersion,
    string PatientName, string Contact, Guid? PreferredDepartmentId, string Description, string SourceLanguage,
    string Status, Guid DepartmentId, Guid? VisitId, bool CanConfirm);
public class RegistrationConflict(string code, Guid? requestId = null, Guid? visitId = null, string? requestContract = null)
    : ApiException(409, code, "Continue the existing reception record.")
{
    public Guid? ExistingRequestId { get; } = requestId;
    public Guid? ExistingVisitId { get; } = visitId;
    public string? ExistingRequestContract { get; } = requestContract;
}

public static class RegistrationV2Endpoints
{
    public static void MapRegistrationV2(this WebApplication app)
    {
        // Deliberately no localization response filter: patient originals must remain exact.
        var group = app.MapGroup("/api/v2/requests").WithTags("Registration v2")
            .AddEndpointFilter(async (context, next) => {
                var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
                Check.That(config.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "The new reception workflow is not enabled.", 503);
                return await next(context);
            });
        group.MapGet("", async (int? offset, int? limit, Access access, HospitalDb db) => {
            Check.That((offset ?? 0) >= 0 && (limit ?? 100) is >= 1 and <= 100, "validation", "Invalid page.");
            var session = await access.Current();
            var query = db.Requests.Where(r => r.SourceLanguage != null);
            if (session.PatientId is {} patientId)
                query = query.Where(r => r.PatientId == patientId && (!session.IsGuest || r.SessionId == session.Id));
            else {
                var staff = await access.Staff("Reception");
                var scope = staff.Scopes.Select(s => s.DepartmentId).ToArray();
                query = query.Where(r => scope.Contains(r.DepartmentId));
            }
            return await query.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id)
                .Skip(offset ?? 0).Take(limit ?? 100)
                .Select(r => new RegistrationViewV2(r.Id, r.Version, r.CreatedAt, "prd-v2", r.Name, r.Contact,
                    r.PreferredDepartmentId, r.Description, r.SourceLanguage!, r.Status, r.DepartmentId,
                    db.Visits.Where(v => db.Set<ReceptionRecord>().Any(rec => rec.Id == v.ReceptionRecordId && rec.RegistrationRequestId == r.Id))
                        .Select(v => (Guid?)v.Id).FirstOrDefault(), session.PatientId == null && r.Status == "Submitted")).ToListAsync();
        });
        group.MapGet("/{id:guid}", async (Guid id, Access access, HospitalDb db) => {
            var request = await access.Request(id);
            Check.That(request.SourceLanguage != null, "legacyRecord", "Read this historical request through its original contract.", 409);
            return await View(request, db, (await access.Current()).UserAccount?.Role == "Reception");
        });
        group.MapPost("", async (JsonElement body, Access access, HospitalDb db, CommandBus bus) => {
            var session = await access.Patient();
            var input = Parse(body);
            var result = await bus.Run($"prd-v2:{session.Id}:create-request:{session.PatientId}", input, async () => {
                // The SQL application lock covers both pending requests and active Visits.
                var active = await db.Visits.Where(v => v.PatientId == session.PatientId && v.Status == "Active")
                    .OrderBy(v => v.CreatedAt).ThenBy(v => v.Id).FirstOrDefaultAsync();
                if (active != null) {
                    var mayRead = !session.IsGuest || await db.Set<AccessGrant>().AnyAsync(g => g.SessionId == session.Id && g.VisitId == active.Id && g.ExpiresAt > DateTime.UtcNow);
                    throw new RegistrationConflict("activeVisitExists", visitId: mayRead ? active.Id : null);
                }
                var pending = await db.Requests.Where(r => r.PatientId == session.PatientId && (r.Status == "Submitted" || r.Status == "NeedsInformation"))
                    .OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).FirstOrDefaultAsync();
                if (pending != null) {
                    var mayRead = !session.IsGuest || pending.SessionId == session.Id;
                    throw new RegistrationConflict("pendingRequestExists", mayRead ? pending.Id : null,
                        requestContract: mayRead ? pending.SourceLanguage == null ? "legacy" : "prd-v2" : null);
                }
                if (input.PreferredDepartmentId is {} preference)
                    Check.That(await db.Set<Department>().AnyAsync(d => d.Id == preference && d.Active), "departmentInvalid", "Choose an active department.");
                // Routing is a server decision; preference never becomes Reception authority.
                var department = await db.Set<Department>().SingleOrDefaultAsync(d => d.Code == "CONSULT" && d.Active);
                Check.That(department != null, "departmentInvalid", "Reception routing is unavailable.", 503);
                var patient = await db.Patients.SingleAsync(p => p.Id == session.PatientId);
                Check.Text(patient.Name, "name", 2, 120);
                var request = new RegistrationRequest {
                    PatientId = patient.Id, SessionId = session.Id, Name = patient.Name, Contact = input.Contact,
                    Description = input.Description, SourceLanguage = input.SourceLanguage,
                    PreferredDepartmentId = input.PreferredDepartmentId, DepartmentId = department!.Id
                };
                db.Add(request);
                bus.Audit(session.Id, "RequestSubmittedV2", detail: request.Id.ToString(), source: "Patient");
                // Save before taking the returned snapshot so version/createdAt match persistence.
                await db.SaveChangesAsync();
                return await View(request, db);
            });
            return Results.Json(result, statusCode: 201);
        }).Accepts<RegistrationInputV2>("application/json").Produces<RegistrationViewV2>(201)
            .ProducesProblem(409, "application/json").ProducesProblem(422, "application/json")
            .ProducesProblem(503, "application/json");
    }

    public static async Task BlockLegacyCreate(HospitalDb db, Session session)
    {
        var request = await db.Requests.FirstOrDefaultAsync(r => r.PatientId == session.PatientId && r.SourceLanguage != null && r.Status == "Submitted");
        if (request != null)
            throw new RegistrationConflict("pendingRequestExists", !session.IsGuest || request.SessionId == session.Id ? request.Id : null,
                requestContract: !session.IsGuest || request.SessionId == session.Id ? "prd-v2" : null);
        var visit = await db.Visits.FirstOrDefaultAsync(v => v.PatientId == session.PatientId && v.ExamStatus != null && v.Status == "Active");
        if (visit != null) {
            var mayRead = !session.IsGuest || await db.Set<AccessGrant>().AnyAsync(g => g.SessionId == session.Id && g.VisitId == visit.Id && g.ExpiresAt > DateTime.UtcNow);
            throw new RegistrationConflict("activeVisitExists", visitId: mayRead ? visit.Id : null);
        }
    }

    static RegistrationInputV2 Parse(JsonElement body)
    {
        string[] allowed = ["contact", "preferredDepartmentId", "description", "sourceLanguage"];
        Check.That(body.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
        var names = body.EnumerateObject().Select(p => p.Name).ToArray();
        Check.That(names.Length == allowed.Length && names.Distinct().Count() == names.Length && names.All(allowed.Contains), "validation", "Only the four reception input fields are permitted.");
        foreach (var name in new[] { "contact", "description", "sourceLanguage" })
            Check.That(body.GetProperty(name).ValueKind == JsonValueKind.String, "validation", "Text input is required.");
        var contact = Check.Text(body.GetProperty("contact").GetString(), "contact", 5, 80);
        var description = body.GetProperty("description").GetString()!;
        Check.That(description.Length <= 2000, "validation", "Description is too long.");
        var language = body.GetProperty("sourceLanguage").GetString()!;
        Check.That(language is "vi" or "en" or "zh" or "ja", "validation", "Unsupported source language.");
        var preferred = body.GetProperty("preferredDepartmentId");
        Check.That(preferred.ValueKind == JsonValueKind.Null || preferred.ValueKind == JsonValueKind.String && preferred.TryGetGuid(out _), "validation", "Invalid preferred department.");
        return new(contact, preferred.ValueKind == JsonValueKind.Null ? null : preferred.GetGuid(), description, language);
    }

    public static async Task<RegistrationViewV2> View(RegistrationRequest request, HospitalDb db, bool reception = false)
    {
        var visit = await db.Visits.Where(v => db.Set<ReceptionRecord>().Any(r => r.Id == v.ReceptionRecordId && r.RegistrationRequestId == request.Id))
            .Select(v => (Guid?)v.Id).SingleOrDefaultAsync();
        return new(request.Id, request.Version, request.CreatedAt, "prd-v2", request.Name, request.Contact,
            request.PreferredDepartmentId, request.Description, request.SourceLanguage!, request.Status, request.DepartmentId, visit, reception && request.Status == "Submitted" && visit == null);
    }
}
