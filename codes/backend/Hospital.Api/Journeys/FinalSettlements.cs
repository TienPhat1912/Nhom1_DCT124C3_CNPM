using System.Linq.Expressions;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Reception;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;

public static class FinalSettlements
{
    // Shared by the SQL queue, detail capability and command. Cancelled/Skipped
    // work is historical evidence, never completed clinical work in V2.
    public static readonly Expression<Func<Visit, bool>> Ready = v =>
        v.Ticket.SnapshotSource == "Captured" && v.Status == "Active" && v.Journey.Status == "Active"
        && v.ExamStatus == "Completed" && v.ExaminationCompletedAt != null
        && v.Orders.All(o => o.Status == "Completed")
        && v.Journey.Steps.Any(s => s.Kind == "Consultation" && s.Status == "Completed")
        && v.Journey.Steps.All(s => s.Kind == "Settlement"
            || ((s.Kind == "Consultation" || s.Kind == "ReturnConsultation" || s.Kind == "Service") && s.Status == "Completed"))
        && v.Journey.Steps.Count(s => s.Kind == "Settlement") == 1
        && v.Journey.Steps.Any(s => s.Kind == "Settlement" && s.Authority == "Cashier" && s.Status == "Ready");

    public static IQueryable<Visit> Eligible(HospitalDb db) => db.Visits.Where(Ready)
        .Where(v => db.Set<ClinicalRecord>().Any(r => r.VisitId == v.Id
            && r.ConfirmedAt <= r.PublishedAt && r.ConfirmedAt <= v.ExaminationCompletedAt));

    static async Task Subject(Guid id, UserAccount actor, HospitalDb db)
    {
        var v = await db.Visits.AsNoTracking().SingleOrDefaultAsync(v => v.Id == id)
            ?? throw new ApiException(404, "notFound", "Visit not found.");
        Access.Scope(actor, v.DepartmentId);
        Check.That(await db.Set<StaffScope>().AsNoTracking().AnyAsync(s => s.UserAccountId == actor.Id && s.DepartmentId == v.DepartmentId)
            && await db.Users.AsNoTracking().AnyAsync(u => u.Id == actor.Id && u.Active && u.Role == "Cashier"),
            "outOfScope", "Cashier scope changed. Refresh your session.", 403);
        Check.That(v.ExamStatus != null, "legacyCommandDisabled", "Use the historical Visit workflow.", 410);
    }

    public static void MapFinalSettlements(this WebApplication app)
    {
        var group = app.MapGroup("/api/v2").WithTags("Final settlement");
        group.AddEndpointFilter(async (ctx, next) => {
            Check.That(app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "V2 workflow is disabled.", 503);
            return await next(ctx);
        });
        group.MapGet("/cashier/visits", async (int? offset, Access access, HospitalDb db) => {
            var actor = await access.Staff("Cashier");
            Check.That((offset ?? 0) >= 0, "validation", "Use a non-negative offset.");
            var scopes = actor.Scopes.Select(s => s.DepartmentId).ToArray();
            var ids = await Eligible(db).Where(v => scopes.Contains(v.DepartmentId))
                .OrderBy(v => v.ExaminationCompletedAt).ThenBy(v => v.Id)
                .Skip(offset ?? 0).Take(100).Select(v => v.Id).ToArrayAsync();
            // Retain the SQL-filtered order while using the same snapshot reader.
            var visits = await db.FullVisits().Where(v => ids.Contains(v.Id)).ToListAsync();
            var rows = new List<object>();
            foreach (var id in ids) {
                var v = visits.Single(v => v.Id == id); var ticket = ReceptionConfirmation.Ticket(v);
                rows.Add(new { contractVersion = "prd-v2", v.Id, v.Version, v.Status, journeyStatus = v.Journey.Status,
                    v.ExamStatus, patientName = ticket.PatientSnapshot.Name, v.ClinicLocationId, clinic = ticket.ClinicSnapshot,
                    v.DoctorId, doctor = ticket.DoctorSnapshot, ticket = new { ticket.ClinicLocationId, ticket.IssuedOn, ticket.SequenceNumber, ticket.Number },
                    v.ConsultationCount, examinationCompletedAt = v.ExaminationCompletedAt is {} at ? (DateTime?)DateTime.SpecifyKind(at, DateTimeKind.Utc) : null, v.ClosedAt, v.WorkRevision, v.CreatedAt });
            }
            return rows;
        });
        group.MapPost("/visits/{id:guid}/settlement", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus) => {
            var actor = await access.Staff("Cashier");
            await Subject(id, actor, db); // Authorization must also precede receipt replay.
            Check.That(body.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
            var names = body.EnumerateObject().Select(p => p.Name).ToArray();
            Check.That(names.Length == 3 && names.Distinct().Count() == 3
                && names.All(n => n is "version" or "workRevision" or "outcome"), "validation", "Only version, workRevision and outcome are accepted.");
            int Positive(string field) {
                var p = body.GetProperty(field);
                Check.That(p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var _) && p.GetInt32() > 0, "validation", "Positive integer required.");
                return p.GetInt32();
            }
            var version = Positive("version"); var workRevision = Positive("workRevision");
            var value = body.GetProperty("outcome");
            Check.That(value.ValueKind == JsonValueKind.String && value.GetString() is "Final" or "NoPaymentRequired", "validation", "Choose a final settlement outcome.");
            var outcome = value.GetString()!;
            return await bus.Run<object>($"prd-v2:{actor.Id}:settlement:{id}", new { version, workRevision, outcome }, async () => {
                await Subject(id, actor, db);
                var visit = await db.FullVisits().SingleAsync(v => v.Id == id);
                Check.Version(visit, version);
                Check.That(visit.Status == "Active" && visit.Journey.Status == "Active", "visitNotActive", "This Visit is already closed.", 409);
                Check.That(visit.WorkRevision == workRevision, "workRevisionConflict", "Required work changed. Review the Visit again.", 409);
                Check.That(visit.ExamStatus == "Completed" && visit.ExaminationCompletedAt != null
                    && await db.Set<ClinicalRecord>().AnyAsync(r => r.VisitId == id && r.ConfirmedAt <= r.PublishedAt && r.ConfirmedAt <= visit.ExaminationCompletedAt),
                    "examinationNotCompleted", "Confirm and publish the examination before settlement.", 409);
                Check.That(visit.Orders.All(o => o.Status == "Completed")
                    && visit.Journey.Steps.Where(Workflow.Clinical).All(s => s.Status == "Completed"),
                    "servicesNotCompleted", "Complete all clinical work before settlement.", 409);
                Check.That(await Eligible(db).AnyAsync(v => v.Id == id), "invalidExamStatus", "The settlement workflow is not ready.", 409);
                var now = DateTime.UtcNow;
                visit.FinalSettlementRevision = workRevision; visit.FinalSettlementOutcome = outcome;
                visit.Status = "Closed"; visit.ClosedAt = now;
                var step = visit.Journey.Steps.Single(s => s.Kind == "Settlement");
                step.Status = "Completed"; step.CompletedAt = now;
                visit.Journey.Status = "Completed"; visit.Journey.CompletedAt = now; visit.Journey.CompletionSource = "FinalSettlement";
                bus.Audit(actor.Id, "Settlement" + outcome, id, $"revision:{workRevision}");
                bus.Audit(actor.Id, "VisitClosed", id, $"revision:{workRevision}"); bus.Notify(visit.PatientId, id);
                await db.SaveChangesAsync();
                return await DoctorConsultations.View(visit, db);
            });
        });
    }
}
