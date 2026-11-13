using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Journeys;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Reception;

public record ConfirmReceptionV2(int Version, Guid ClinicLocationId, int ClinicAssignmentVersion, bool AttendeeVerified, string VerificationNote);
public record PatientTicketSnapshot(string Name, string Contact);
public record DoctorTicketSnapshot(Guid Id, string Name);
public record ClinicTicketSnapshot(Guid Id, Guid DepartmentId, string NameVi, string NameEn, string Building, string Floor, string Room);
public record TicketViewV2(string ContractVersion, Guid Id, Guid VisitId, Guid JourneyId, DateTime IssuedAt,
    Guid ClinicLocationId, DateOnly IssuedOn, int SequenceNumber, string Number,
    PatientTicketSnapshot PatientSnapshot, ClinicTicketSnapshot ClinicSnapshot, DoctorTicketSnapshot DoctorSnapshot);

public static class ReceptionConfirmation
{
    public static void MapReceptionConfirmation(this WebApplication app)
    {
        var group = app.MapGroup("/api/v2").WithTags("Reception confirmation v2")
            .AddEndpointFilter(async (context, next) => {
                Check.That(context.HttpContext.RequestServices.GetRequiredService<IConfiguration>().GetValue<bool>("Workflow:PrdV2Enabled"),
                    "workflowNotEnabled", "The new reception workflow is not enabled.", 503);
                return await next(context);
            });
        group.MapGet("/reception/clinics", async (Access access, HospitalDb db) => {
            var user = await access.Staff("Reception");
            var departments = user.Scopes.Select(s => s.DepartmentId).ToArray();
            return await (from room in db.Set<ClinicRoom>()
                join location in db.Set<Location>() on room.ClinicLocationId equals location.Id
                join department in db.Set<Department>() on location.DepartmentId equals department.Id
                join doctor in db.Users on room.ActiveDoctorId equals doctor.Id
                where location.Active && department.Active && departments.Contains(location.DepartmentId)
                    && doctor.Active && doctor.Role == "Doctor" && doctor.PasswordHash != ""
                    && doctor.Scopes.Any(s => s.DepartmentId == location.DepartmentId)
                    && db.Set<ClinicDoctor>().Any(a => a.ClinicLocationId == location.Id && a.DoctorId == doctor.Id)
                orderby location.Room, location.Id
                select new { clinicLocationId = location.Id, room.Version, location.DepartmentId, location.NameVi, location.Room,
                    activeDoctor = new DoctorTicketSnapshot(doctor.Id, doctor.Name) }).ToListAsync();
        });
        group.MapPost("/requests/{id:guid}/confirm", async (Guid id, JsonElement body, Access access, HospitalDb db,
            CommandBus bus, Workflow workflow, TicketNumberAllocator allocator) => {
            var actor = await access.Staff("Reception");
            // Check current permission even when CommandBus returns an old receipt.
            var scope = await db.Requests.AsNoTracking().Where(r => r.Id == id).Select(r => (Guid?)r.DepartmentId).SingleOrDefaultAsync();
            Check.That(scope != null, "notFound", "Request not found.", 404);
            Access.Scope(actor, scope!.Value);
            var confirmedDepartment = await db.Visits.AsNoTracking()
                .Where(v => db.Set<ReceptionRecord>().Any(r => r.Id == v.ReceptionRecordId && r.RegistrationRequestId == id))
                .Select(v => (Guid?)v.DepartmentId).SingleOrDefaultAsync();
            if (confirmedDepartment is {} departmentId) Access.Scope(actor, departmentId);
            var input = Parse(body);
            return await bus.Run<object>($"prd-v2:{actor.Id}:confirm:{id}", input, async () => {
                var staff = await db.Users.AsNoTracking().Include(u => u.Scopes).SingleAsync(u => u.Id == actor.Id);
                Check.That(staff.Active && staff.Role == "Reception", "forbidden", "Reception authority required.", 403);
                var request = await db.Requests.SingleAsync(r => r.Id == id);
                Access.Scope(staff, request.DepartmentId);
                Check.That(request.SourceLanguage != null, "legacyRecord", "Use the historical reception contract for this request.", 409);
                var existing = await db.Visits.Where(v => db.Set<ReceptionRecord>().Any(r => r.Id == v.ReceptionRecordId && r.RegistrationRequestId == id)).Select(v => (Guid?)v.Id).SingleOrDefaultAsync();
                if (existing is {} visitId) {
                    var existingVisit = await db.FullVisits().SingleAsync(v => v.Id == visitId);
                    Access.Scope(staff, existingVisit.DepartmentId);
                    return await Result(request, existingVisit, db);
                }
                Check.Version(request, input.Version);
                Check.That(request.Status == "Submitted", "requestLocked", "Only a submitted request can be confirmed.", 409);
                Check.That(input.AttendeeVerified, "verificationRequired", "Verify the attendee before confirmation.");
                var note = Check.Text(input.VerificationNote, "verificationNote", 3, 500);
                // Locks also cover direct SQL writers. All normal application commands share CommandBus's SQL lock.
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM Patients WITH (UPDLOCK,HOLDLOCK) WHERE Id={request.PatientId}");
                var active = await db.Visits.Where(v => v.PatientId == request.PatientId && v.Status == "Active").Select(v => (Guid?)v.Id).FirstOrDefaultAsync();
                if (active != null) throw new RegistrationConflict("activeVisitExists", visitId: active);
                Check.That(!await db.Requests.AnyAsync(r => r.PatientId == request.PatientId && r.Id != id && (r.Status == "Submitted" || r.Status == "NeedsInformation")),
                    "pendingRequestExists", "Resolve the other pending request before confirmation.", 409);
                var room = await db.Set<ClinicRoom>().FromSqlInterpolated($"SELECT * FROM ClinicRoom WITH (UPDLOCK,HOLDLOCK) WHERE ClinicLocationId={input.ClinicLocationId}").SingleOrDefaultAsync();
                Check.That(room != null, "clinicUnavailable", "Select a configured clinic.", 409);
                Check.That(room!.Version == input.ClinicAssignmentVersion, "conflict", "Clinic assignment changed. Refresh and verify it again.", 409);
                var location = await db.Set<Location>().FromSqlInterpolated($"SELECT * FROM Location WITH (UPDLOCK,HOLDLOCK) WHERE Id={input.ClinicLocationId}").SingleAsync();
                Access.Scope(staff, location.DepartmentId);
                var department = await db.Set<Department>().FromSqlInterpolated($"SELECT * FROM Department WITH (UPDLOCK,HOLDLOCK) WHERE Id={location.DepartmentId}").SingleAsync();
                Check.That(location.Active && department.Active, "clinicUnavailable", "The clinic is unavailable.", 409);
                var doctor = await db.Users.FromSqlInterpolated($"SELECT * FROM Users WITH (UPDLOCK,HOLDLOCK) WHERE Id={room.ActiveDoctorId}").Include(u => u.Scopes).SingleOrDefaultAsync();
                Check.That(doctor is { Active: true, Role: "Doctor" } && !string.IsNullOrWhiteSpace(doctor.PasswordHash)
                    && doctor.Scopes.Any(s => s.DepartmentId == location.DepartmentId)
                    && await db.Set<ClinicDoctor>().AnyAsync(a => a.DoctorId == doctor.Id && a.ClinicLocationId == location.Id),
                    "doctorUnavailable", "The clinic needs an active, authorized doctor with a usable account.", 409);
                var now = DateTime.UtcNow;
                var record = new ReceptionRecord { PatientId = request.PatientId, RegistrationRequestId = id, ConfirmedBy = staff.Id, VerificationNote = note };
                var visit = new Visit { PatientId = request.PatientId, ReceptionRecordId = record.Id, DepartmentId = location.DepartmentId,
                    ClinicLocationId = location.Id, DoctorId = doctor!.Id, ExamStatus = "Waiting", ConsultationCount = 0 };
                visit.Journey = new PatientJourney { VisitId = visit.Id, Status = "Active", ActivatedAt = now };
                visit.Ticket = new ExaminationTicket { VisitId = visit.Id, CreatedAt = now, SnapshotSource = "Captured",
                    PatientSnapshot = JsonSerializer.Serialize(new PatientTicketSnapshot(request.Name, request.Contact), CommandBus.Json),
                    ClinicSnapshot = JsonSerializer.Serialize(new ClinicTicketSnapshot(location.Id, location.DepartmentId, location.NameVi, location.NameVi, location.Building, location.Floor, location.Room), CommandBus.Json),
                    DoctorSnapshot = JsonSerializer.Serialize(new DoctorTicketSnapshot(doctor.Id, doctor.Name), CommandBus.Json) };
                db.AddRange(record, visit);
                await allocator.AssignAsync(visit.Ticket, location.Id);
                var consult = workflow.MakeStep(visit.Journey, location, "Consultation", "Doctor", "consultation", 10);
                consult.QueueNumber = visit.Ticket.Number;
                // This can fail after allocation; the same transaction rolls back the counter and every entity.
                var cashier = await workflow.DefaultDestination("CASHIER");
                var settlement = workflow.MakeStep(visit.Journey, cashier, "Settlement", "Cashier", "settlement", 9000);
                Workflow.Depends(settlement, consult);
                var session = await db.Sessions.SingleAsync(s => s.Id == request.SessionId);
                Check.That(session.PatientId == request.PatientId, "requestInvalid", "Request/session ownership requires review.", 409);
                if (session.IsGuest) db.Add(new AccessGrant { SessionId = session.Id, VisitId = visit.Id, ExpiresAt = session.ExpiresAt });
                request.Status = "Confirmed";
                // Retain request routing scope, so its original reception staff can still find it.
                workflow.Evaluate(visit);
                bus.Audit(staff.Id, "ReceptionConfirmedV2", visit.Id);
                bus.Notify(visit.PatientId, visit.Id, "ticketIssued");
                await db.SaveChangesAsync();
                return await Result(request, visit, db);
            });
        });
    }

    public static TicketViewV2 Ticket(Visit visit) => new("prd-v2", visit.Ticket.Id, visit.Id, visit.Journey.Id, visit.Ticket.CreatedAt,
        visit.Ticket.ClinicLocationId!.Value, visit.Ticket.IssuedOn!.Value, visit.Ticket.SequenceNumber!.Value, visit.Ticket.Number,
        JsonSerializer.Deserialize<PatientTicketSnapshot>(visit.Ticket.PatientSnapshot!, CommandBus.Json)!,
        JsonSerializer.Deserialize<ClinicTicketSnapshot>(visit.Ticket.ClinicSnapshot!, CommandBus.Json)!,
        JsonSerializer.Deserialize<DoctorTicketSnapshot>(visit.Ticket.DoctorSnapshot!, CommandBus.Json)!);

    static async Task<object> Result(RegistrationRequest request, Visit visit, HospitalDb db)
    {
        var ticket = Ticket(visit);
        var current = visit.Journey.Steps.OrderBy(s => s.Sequence).FirstOrDefault(s => !Workflow.Resolved(s));
        return new { request = await RegistrationV2Endpoints.View(request, db), ticket, visit = new {
            contractVersion = "prd-v2", visit.Id, visit.Version, visit.CreatedAt, visit.Status,
            journeyStatus = visit.Journey.Status, visit.ExamStatus, patientName = ticket.PatientSnapshot.Name,
            visit.ClinicLocationId, clinic = ticket.ClinicSnapshot, visit.DoctorId, doctor = ticket.DoctorSnapshot,
            ticket = new { ticket.ClinicLocationId, ticket.IssuedOn, ticket.SequenceNumber, ticket.Number },
            visit.ConsultationCount, visit.ExaminationCompletedAt, visit.ClosedAt, visit.WorkRevision, visit.DepartmentId,
            journeyId = visit.Journey.Id, journeyVersion = visit.Journey.Version, updatedAt = DateTime.UtcNow,
            visit.FinalSettlementRevision, visit.FinalSettlementOutcome, currentStepId = current?.Id,
            currentStep = current == null ? null : Step(current), latestConsultationCall = (object?)null,
            capabilities = new { canAcceptConsultation = false, canConfirmOrder = false, canCompleteService = false,
                canPreviewExamination = false, canCompleteExamination = false, canSettle = false, canViewResults = false },
            steps = visit.Journey.Steps.OrderBy(s => s.Sequence).Select(Step), orders = Array.Empty<object>()
        } };
    }
    static object Step(JourneyStep step) => new { step.Id, step.Version, step.CreatedAt, step.Kind, step.Status, step.Sequence,
        consultationNumber = (int?)null, step.DoctorOrderId, destination = JsonSerializer.Deserialize<JsonElement>(step.DestinationSnapshot), step.CompletedAt };

    static ConfirmReceptionV2 Parse(JsonElement body)
    {
        string[] allowed = ["version", "clinicLocationId", "clinicAssignmentVersion", "attendeeVerified", "verificationNote"];
        Check.That(body.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
        var fields = body.EnumerateObject().Select(p => p.Name).ToArray();
        Check.That(fields.Length == allowed.Length && fields.Distinct().Count() == fields.Length && fields.All(allowed.Contains), "validation", "Only confirmation fields are allowed.");
        Check.That(body.GetProperty("version").ValueKind == JsonValueKind.Number && body.GetProperty("version").TryGetInt32(out var _) && body.GetProperty("version").GetInt32() > 0
            && body.GetProperty("clinicAssignmentVersion").ValueKind == JsonValueKind.Number && body.GetProperty("clinicAssignmentVersion").TryGetInt32(out var _) && body.GetProperty("clinicAssignmentVersion").GetInt32() > 0
            && body.GetProperty("clinicLocationId").ValueKind == JsonValueKind.String && body.GetProperty("clinicLocationId").TryGetGuid(out var _)
            && body.GetProperty("attendeeVerified").ValueKind is JsonValueKind.True or JsonValueKind.False
            && body.GetProperty("verificationNote").ValueKind == JsonValueKind.String, "validation", "Invalid confirmation fields.");
        return new(body.GetProperty("version").GetInt32(), body.GetProperty("clinicLocationId").GetGuid(), body.GetProperty("clinicAssignmentVersion").GetInt32(), body.GetProperty("attendeeVerified").GetBoolean(), body.GetProperty("verificationNote").GetString()!);
    }
}
