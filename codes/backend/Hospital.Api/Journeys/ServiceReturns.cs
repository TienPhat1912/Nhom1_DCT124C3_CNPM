using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Reception;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;

public static class ServiceReturns
{
    static async Task<JourneyStep> Subject(Guid visitId, Guid orderId, UserAccount actor, HospitalDb db)
    {
        Check.That(await db.Set<DoctorOrder>().AnyAsync(o => o.Id == orderId && o.VisitId == visitId && o.ConsultationNumber != null),
            "notFound", "Service order not found.", 404);
        var step = await db.Set<JourneyStep>().AsNoTracking().SingleOrDefaultAsync(s => s.DoctorOrderId == orderId && s.Kind == "Service" && s.Authority == "Service")
            ?? throw new ApiException(409, "requestLocked", "Service step is unavailable.");
        // Authorize against the committed destination, never the mutable service catalog.
        Access.Scope(actor, step.DepartmentId);
        Check.That(await db.Set<StaffScope>().AnyAsync(s => s.UserAccountId == actor.Id && s.DepartmentId == step.DepartmentId),
            "outOfScope", "Service assignment changed.", 403);
        return step;
    }

    public static void MapServiceReturns(this WebApplication app)
    {
        var group = app.MapGroup("/api/v2").WithTags("Service completion");
        group.AddEndpointFilter(async (ctx, next) => {
            Check.That(app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "V2 workflow is disabled.", 503);
            return await next(ctx);
        });
        group.MapGet("/service/orders", async (string? status, int? offset, Access access, HospitalDb db) => {
            var actor = await access.Staff("Service");
            status ??= "NotCompleted";
            Check.That(status is "NotCompleted" or "Completed" && (offset ?? 0) >= 0, "validation", "Choose a service status and non-negative offset.");
            var departments = actor.Scopes.Select(s => s.DepartmentId).ToArray();
            var rows = await (from order in db.Set<DoctorOrder>().AsNoTracking()
                join visit in db.Visits on order.VisitId equals visit.Id
                join step in db.Set<JourneyStep>() on order.Id equals step.DoctorOrderId
                where order.ConsultationNumber != null && order.Status == status && visit.Ticket.SnapshotSource == "Captured"
                    && step.Kind == "Service" && step.Authority == "Service" && departments.Contains(step.DepartmentId)
                orderby order.CreatedAt descending, order.Id
                select new { Order = order, VisitId = visit.Id, VisitVersion = visit.Version, visit.Ticket,
                    CanComplete = visit.Status == "Active" && visit.Journey.Status == "Active" && visit.ExamStatus == "InService"
                        && order.Status == "NotCompleted" && order.ConsultationNumber == visit.ConsultationCount && step.Status == "Ready" })
                .Skip(offset ?? 0).Take(100).ToArrayAsync();
            var names = await db.Users.AsNoTracking().Where(u => rows.Select(r => r.Order.CompletedById).Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
            return rows.Select(r => new { r.VisitId, r.VisitVersion, r.CanComplete,
                patientName = JsonSerializer.Deserialize<PatientTicketSnapshot>(r.Ticket.PatientSnapshot!, CommandBus.Json)!.Name,
                ticket = new { r.Ticket.ClinicLocationId, r.Ticket.IssuedOn, r.Ticket.SequenceNumber, r.Ticket.Number },
                order = DoctorConsultations.Order(r.Order, names) });
        });
        group.MapPost("/visits/{id:guid}/orders/{orderId:guid}/complete", async (Guid id, Guid orderId, JsonElement body, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var actor = await access.Staff("Service");
            await Subject(id, orderId, actor, db); // Also before receipt replay.
            Check.That(body.ValueKind == JsonValueKind.Object && body.EnumerateObject().Count() == 2
                && body.TryGetProperty("version", out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var version) && version > 0
                && body.TryGetProperty("orderVersion", out var o) && o.ValueKind == JsonValueKind.Number && o.TryGetInt32(out var orderVersion) && orderVersion > 0,
                "validation", "Only positive Visit and order versions are accepted.");
            var expected = body.GetProperty("version").GetInt32();
            var expectedOrder = body.GetProperty("orderVersion").GetInt32();
            return await bus.Run<object>($"prd-v2:{actor.Id}:service-complete:{id}:{orderId}", new { version = expected, orderVersion = expectedOrder }, async () => {
                await Subject(id, orderId, actor, db);
                var visit = await db.FullVisits().SingleAsync(v => v.Id == id);
                var order = visit.Orders.Single(o => o.Id == orderId);
                Check.Version(visit, expected); Check.Version(order, expectedOrder);
                Check.That(order.Status != "Completed", "orderAlreadyCompleted", "This service was already completed.", 409);
                var step = visit.Journey.Steps.Single(s => s.DoctorOrderId == orderId && s.Kind == "Service");
                Check.That(visit.Status == "Active" && visit.Journey.Status == "Active" && visit.ExamStatus == "InService"
                    && visit.Ticket.SnapshotSource == "Captured" && order.Status == "NotCompleted"
                    && order.ConsultationNumber == visit.ConsultationCount && step.Status == "Ready"
                    && visit.Journey.Steps.Where(s => !Workflow.Resolved(s)).OrderBy(s => s.Sequence).FirstOrDefault()?.Id == step.Id,
                    "requestLocked", "The current service must be ready for completion.", 409);
                workflow.ReturnFromService(visit, order, step, actor.Id);
                db.Entry(visit.Journey).Property(j => j.Version).IsModified = true;
                bus.Audit(actor.Id, "ServiceCompleted", id, order.Id.ToString()); bus.Notify(visit.PatientId, id);
                await db.SaveChangesAsync();
                return await DoctorConsultations.View(visit, db);
            });
        });
    }
}
