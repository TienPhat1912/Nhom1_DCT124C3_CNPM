using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Journeys;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Support;
public record AssistanceInput(string Category, string Description, Guid? VisitId, Guid? RequestId, Guid? StepId);
public record HandleAssistanceInput(string Status, string Resolution, bool Escalate, Guid? DepartmentId, int Version);
public static class SupportEndpoints
{
    public static void MapSupport(this WebApplication app)
    {
        var g = app.MapGroup("/api").WithTags("Navigation, notifications and assistance");
        g.MapGet("/visits/{id:guid}/navigation", async (Guid id, Guid? from, Guid? stepId, string? language, Access access, HospitalDb db) => {
            var v = await access.Visit(id); var step = stepId is {} sid ? v.Journey.Steps.SingleOrDefault(s => s.Id == sid) : v.Journey.Steps.Where(s => !Workflow.Resolved(s)).OrderBy(s => s.Status == "Ready" ? 0 : 1).ThenBy(s => s.Sequence).FirstOrDefault();
            Check.That(step is not null, "noDestination", "No remaining destination.", 404);
            var candidates = from is {} origin ? await db.Set<HospitalRoute>().Where(r => r.FromLocationId == origin && r.ToLocationId == step!.LocationId && r.Active).ToListAsync() : [];
            var route = candidates.FirstOrDefault(r => r.Language == language) ?? candidates.FirstOrDefault(r => r.Language == "en") ?? candidates.FirstOrDefault(r => r.Language == "vi");
            return new { destination = HospitalCatalog.DisplayDestination(step!.DestinationSnapshot), instructions = route?.Instructions, language = route?.Language, fallback = route is null || route.Language != language, availableStarts = await db.Set<Location>().Where(l => l.Active).ToListAsync() };
        });
        g.MapGet("/notifications", async (Access access, HospitalDb db) => {
            var s = await access.Patient(); var q = db.Set<Notification>().Where(n => n.PatientId == s.PatientId);
            if (s.IsGuest) q = q.Where(n => n.VisitId == null || db.Set<AccessGrant>().Any(gr => gr.VisitId == n.VisitId && gr.SessionId == s.Id && gr.ExpiresAt > DateTime.UtcNow));
            return await q.OrderByDescending(n => n.CreatedAt).Take(50).ToListAsync();
        });
        g.MapPost("/notifications/{id:guid}/read", async (Guid id, Access access, HospitalDb db, CommandBus bus) => {
            var s = await access.Patient(); return await bus.Run($"{s.Id}:notification:{id}", new { id }, async () => {
                var n = await db.Set<Notification>().SingleOrDefaultAsync(n => n.Id == id && n.PatientId == s.PatientId) ?? throw new ApiException(404, "notFound", "Notification not found.");
                if (n.VisitId is {} v) await access.Visit(v); n.Read = true; return new { n.Id };
            });
        });
        g.MapGet("/assistance", async (Access access, HospitalDb db) => {
            var s = await access.Current(); var q = db.Set<AssistanceRequest>().AsQueryable();
            if (s.PatientId is {} p) q = q.Where(a => a.PatientId == p && (!s.IsGuest || a.SessionId == s.Id));
            else { var u = await access.Staff("Reception", "Service"); var scope = u.Scopes.Select(sc => sc.DepartmentId).ToArray(); q = q.Where(a => scope.Contains(a.DepartmentId)); }
            return await q.OrderByDescending(a => a.CreatedAt).Take(100).ToListAsync();
        });
        g.MapPost("/assistance", async (AssistanceInput input, Access access, HospitalDb db, CommandBus bus) => {
            var s = await access.Patient(); return await bus.Run($"{s.Id}:assistance", input, async () => {
                Check.That(new[] { "Navigation", "Language", "Reception", "Queue", "Other" }.Contains(input.Category), "validation", "Choose a supported help category.");
                Guid dep;
                Check.That(!(input.VisitId is not null && input.RequestId is not null), "validation", "Use one assistance context.");
                if (input.VisitId is {} vid) {
                    var v = await access.Visit(vid); dep = v.DepartmentId;
                    if (input.StepId is {} stepId) { var step = v.Journey.Steps.SingleOrDefault(st => st.Id == stepId); Check.That(step is not null, "validation", "Step does not belong to this Visit."); dep = step!.DepartmentId; }
                } else if (input.RequestId is {} rid) dep = (await access.Request(rid)).DepartmentId;
                else dep = await db.Set<Department>().Where(d => d.Code == "CONSULT").Select(d => d.Id).SingleAsync();
                Check.That(input.StepId is null || input.VisitId is not null, "validation", "A step needs a Visit context.");
                var a = new AssistanceRequest { PatientId = s.PatientId!.Value, SessionId = s.Id, VisitId = input.VisitId, RegistrationRequestId = input.RequestId, JourneyStepId = input.StepId, DepartmentId = dep,
                    Category = input.Category, Description = Check.Text(input.Description, "description", 0, 2000) }; db.Add(a);
                bus.Audit(s.Id, "AssistanceRequested", input.VisitId, source: "Patient"); return new { a.Id };
            });
        });
        g.MapPut("/assistance/{id:guid}", async (Guid id, HandleAssistanceInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Reception", "Service"); return await bus.Run($"{u.Id}:handle:{id}", input, async () => {
                var a = await db.Set<AssistanceRequest>().SingleOrDefaultAsync(a => a.Id == id) ?? throw new ApiException(404, "notFound", "Assistance request not found.");
                Access.Scope(u, a.DepartmentId); Check.Version(a, input.Version); Check.That(a.Status != "Resolved", "invalidTransition", "Request is already resolved.", 409);
                Check.That((a.Status == "Open" && input.Status == "Acknowledged") || (a.Status == "Acknowledged" && input.Status is "Acknowledged" or "Resolved"), "invalidTransition", "Acknowledge before resolving.", 409);
                a.Status = input.Status; a.HandledBy = u.Id; a.Resolution = Check.Text(input.Resolution, "resolution", input.Status == "Resolved" || input.Escalate ? 3 : 0, 500);
                if (input.Escalate) {
                    Check.That(input.DepartmentId is not null && await db.Set<Department>().AnyAsync(d => d.Id == input.DepartmentId && d.Active), "departmentInvalid", "Select an active receiving department.");
                    a.DepartmentId = input.DepartmentId!.Value; a.Escalated = true; a.Status = "Open";
                }
                bus.Notify(a.PatientId, a.VisitId, "assistanceUpdated"); bus.Audit(u.Id, "AssistanceUpdated", a.VisitId, a.Id.ToString()); return new { a.Id };
            });
        });
    }
}
