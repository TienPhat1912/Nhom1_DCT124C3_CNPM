using Hospital.Api.Content;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Journeys;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Support;
public record AssistanceInput(string Category, string Description, Guid? VisitId, Guid? RequestId, Guid? StepId, string? SourceLanguage = null);
public record HandleAssistanceInput(string Status, string Resolution, bool Escalate, Guid? DepartmentId, int Version);
public static class SupportEndpoints
{
    public static void MapSupport(this WebApplication app)
    {
        var g = app.MapGroup("/api").AddEndpointFilter<LocalizedResponseFilter>().WithTags("Navigation, notifications and assistance");
        g.MapGet("/visits/{id:guid}/navigation", async (Guid id, Guid? from, Guid? stepId, string? language, Access access, HospitalDb db) => {
            var v = await access.Visit(id); var step = stepId is {} sid ? v.Journey.Steps.SingleOrDefault(s => s.Id == sid) : v.Journey.Steps.Where(s => !Workflow.Resolved(s)).OrderBy(s => s.Status == "Ready" ? 0 : 1).ThenBy(s => s.Sequence).FirstOrDefault();
            Check.That(step is not null, "noDestination", "No remaining destination.", 404);
            var candidates = from is {} origin ? await db.Set<HospitalRoute>().Where(r => r.FromLocationId == origin && r.ToLocationId == step!.LocationId && r.Active).ToListAsync() : [];
            var route = candidates.FirstOrDefault(r => r.Language == "vi");
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
        var assistance = app.MapGroup("/api/assistance").WithTags("Assistance");
        assistance.MapGet("", async (Access access, HospitalDb db) => {
            var s = await access.Current(); var q = db.Set<AssistanceRequest>().AsQueryable();
            if (s.PatientId is {} p) q = q.Where(a => a.PatientId == p && (!s.IsGuest || a.SessionId == s.Id));
            else { var u = await access.Staff("Reception"); var scope = u.Scopes.Select(sc => sc.DepartmentId).ToArray(); q = q.Where(a => scope.Contains(a.DepartmentId)); }
            return await q.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Id).Take(100).Select(a => new {
                a.Id, a.Version, a.CreatedAt, a.PatientId, a.VisitId, a.RegistrationRequestId, a.JourneyStepId,
                a.DepartmentId, a.Category, a.Description, a.SourceLanguage, a.Status, a.Resolution, a.Escalated,
                PatientName = db.Patients.Where(p => p.Id == a.PatientId).Select(p => p.Name).FirstOrDefault(),
                LocationId = db.Set<JourneyStep>().Where(st => st.Id == a.JourneyStepId).Select(st => (Guid?)st.LocationId).FirstOrDefault(),
                DestinationSnapshot = db.Set<JourneyStep>().Where(st => st.Id == a.JourneyStepId).Select(st => st.DestinationSnapshot).FirstOrDefault()
            }).ToListAsync();
        });
        assistance.MapGet("/{id:guid}", async (Guid id, Access access, HospitalDb db, ITranslationService translations, CancellationToken ct) => {
            var user = await access.Staff("Reception");
            var a = await db.Set<AssistanceRequest>().SingleOrDefaultAsync(a => a.Id == id, ct)
                ?? throw new ApiException(404, "notFound", "Assistance request not found.");
            Access.Scope(user, a.DepartmentId);
            var translation = a.SourceLanguage == null
                ? new TextTranslation(a.Description, "", "vi", a.Version, "Unavailable", null, true)
                : await translations.Translate(new(a.Description, a.SourceLanguage, "vi", a.Version, $"Assistance:{a.Id}:Description"), ct);
            return new { a.Id, a.Version, translation };
        });
        assistance.MapPost("", async (AssistanceInput input, Access access, HospitalDb db, CommandBus bus) => {
            var s = await access.Patient(); return await bus.Run($"{s.Id}:assistance", input, async () => {
                Check.That(new[] { "Navigation", "Language", "Reception", "Queue", "Other" }.Contains(input.Category), "validation", "Choose a supported help category.");
                Guid dep;
                Check.That(!(input.VisitId is not null && input.RequestId is not null), "validation", "Use one assistance context.");
                if (input.VisitId is {} vid) {
                    var v = await access.Visit(vid); dep = v.DepartmentId;
                    if (input.StepId is {} stepId) {
                        Check.That(v.Journey.Steps.Any(st => st.Id == stepId), "validation", "Step does not belong to this Visit.");
                        // Keep Reception routing; Step/Location remain context, not authority.
                    }
                } else if (input.RequestId is {} rid) dep = (await access.Request(rid)).DepartmentId;
                else dep = await db.Set<Department>().Where(d => d.Code == "CONSULT").Select(d => d.Id).SingleAsync();
                Check.That(input.StepId is null || input.VisitId is not null, "validation", "A step needs a Visit context.");
                var a = new AssistanceRequest { PatientId = s.PatientId!.Value, SessionId = s.Id, VisitId = input.VisitId, RegistrationRequestId = input.RequestId, JourneyStepId = input.StepId, DepartmentId = dep,
                    Category = input.Category, Description = input.Description, SourceLanguage = input.SourceLanguage };
                Check.That(input.Description is not null && input.Description.Length <= 2000, "validation", "Description must be at most 2000 characters.");
                Check.That(input.SourceLanguage == null || new[] { "vi", "en", "zh", "ja" }.Contains(input.SourceLanguage), "validation", "Choose vi, en, zh or ja.");
                Check.That(!app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled") || input.SourceLanguage != null, "validation", "Explicit source language is required.");
                db.Add(a);
                bus.Audit(s.Id, "AssistanceRequested", input.VisitId, source: "Patient"); return new { a.Id };
            });
        });
        assistance.MapPut("/{id:guid}", async (Guid id, HandleAssistanceInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Reception"); return await bus.Run($"{u.Id}:handle:{id}", input, async () => {
                var a = await db.Set<AssistanceRequest>().SingleOrDefaultAsync(a => a.Id == id) ?? throw new ApiException(404, "notFound", "Assistance request not found.");
                Access.Scope(u, a.DepartmentId); Check.Version(a, input.Version); Check.That(a.Status != "Resolved", "invalidTransition", "Request is already resolved.", 409);
                Check.That((a.Status == "Open" && input.Status == "Acknowledged") || (a.Status == "Acknowledged" && input.Status is "Acknowledged" or "Resolved"), "invalidTransition", "Acknowledge before resolving.", 409);
                Check.That(!input.Escalate, "validation", "Assistance is handled by the assigned Reception department.");
                a.Status = input.Status; a.HandledBy = u.Id; a.Resolution = Check.Text(input.Resolution, "resolution", input.Status == "Resolved" ? 3 : 0, 500);
                bus.Notify(a.PatientId, a.VisitId, "assistanceUpdated"); bus.Audit(u.Id, "AssistanceUpdated", a.VisitId, a.Id.ToString()); return new { a.Id };
            });
        });
    }
}
