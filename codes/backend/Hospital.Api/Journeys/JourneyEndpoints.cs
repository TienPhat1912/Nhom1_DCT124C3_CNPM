using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Integrations;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;
public record OrderInput(Guid ServiceId, string Note, int Version);
public record ChangeOrderInput(string Action, Guid? ServiceId, string Reason, int Version);
public record ProgressInput(string Status, string Reason, int Version, string Source = "Staff");
public record QueueInput(string Number, string Status, int Version, string Source = "Staff");
public record SettlementInput(string Outcome, int WorkRevision, int Version, string Source = "Staff");
public record PharmacyInput(bool Required, int Version);
public record CompleteInput(int Version);

public class JourneyReader(HospitalDb db, Access access)
{
    public async Task<object> Read(Visit v, string language)
    {
        var session = await access.Current(); var role = session.UserAccount?.Role ?? "Patient";
        var keys = v.Journey.Steps.Select(s => s.TemplateKey).Distinct().ToArray();
        var templates = await db.Set<GuidanceTemplate>().Where(t => keys.Contains(t.Key) && t.Published).OrderByDescending(t => t.Revision).ToListAsync();
        var current = v.Journey.Steps.Where(s => !Workflow.Resolved(s)).OrderBy(s => s.Status == "InProgress" ? 0 : s.Status == "Ready" ? 1 : 2).ThenBy(s => s.Sequence).FirstOrDefault();
        var doctor = await db.Users.FindAsync(v.DoctorId);
        var department = await db.Set<Department>().FindAsync(v.DepartmentId);
        return new {
            doctorName = doctor?.Name, departmentNameVi = department?.NameVi, departmentNameEn = department?.NameEn,
            doctorSpecialties = HospitalCatalog.Specialties(v.DoctorId),
            v.Id, v.Version, v.Status, v.WorkRevision, v.FinalSettlementRevision, v.FinalSettlementOutcome, v.CreatedAt, v.ClosedAt,
            patientName = v.Patient.Name, v.DepartmentId, v.DoctorId,
            ticketNumber = v.Ticket.Number, journeyId = v.Journey.Id, journeyStatus = v.Journey.Status, journeyVersion = v.Journey.Version, v.Journey.CompletionSource,
            currentStepId = current?.Id, clinicallyReady = Workflow.ReadyForSettlement(v), updatedAt = DateTime.UtcNow,
            steps = v.Journey.Steps.OrderBy(s => s.Sequence).Select(s => {
                var variants = templates.Where(t => t.Key == s.TemplateKey).ToList();
                var t = variants.FirstOrDefault(t => t.Language == language) ?? variants.FirstOrDefault(t => t.Language == "en") ?? variants.FirstOrDefault(t => t.Language == "vi") ?? variants.FirstOrDefault();
                bool canProgress = v.Status == "Active" && (s.Status is "Ready" or "InProgress") && ((role == "Doctor" && s.Authority == "Doctor" && v.DoctorId == session.UserAccountId)
                    || (role == "Service" && s.Authority == "Service" && session.UserAccount!.Scopes.Any(sc => sc.DepartmentId == s.DepartmentId)));
                return new { s.Id, s.Version, s.Kind, s.Status, s.Authority, s.DoctorOrderId, s.MappingVersion, s.Sequence, s.LocationId, s.DepartmentId,
                    destination = JsonSerializer.Deserialize<JsonElement>(s.DestinationSnapshot), s.QueueNumber, s.QueueStatus, s.QueueUpdatedAt, s.ResolutionReason, s.CompletedAt,
                    prerequisites = s.Dependencies.Select(d => d.PrerequisiteStepId), text = t?.Text, contentLanguage = t?.Language, fallback = t?.Language != language, templateVersion = t?.Revision,
                    canProgress, canCompleteGuidance = role == "Patient" && v.Status == "Closed" && v.Journey.Status == "Active" && s.Kind == "Pharmacy" && s.Status == "Ready" };
            }),
            orders = v.Orders.Select(o => new { o.Id, o.Version, o.HospitalServiceId, o.Status, o.Note, o.MappingVersion })
        };
    }
}
public static class JourneyEndpoints
{
    public static void MapJourneys(this WebApplication app)
    {
        var g = app.MapGroup("/api").WithTags("Visits and Journey");
        g.MapGet("/visits", async (int? offset, int? limit, Access access, HospitalDb db) => {
            Check.That((offset ?? 0) >= 0 && (limit ?? 100) is >= 1 and <= 100, "validation", "Use non-negative offset and a page size from 1 to 100.");
            var s = await access.Current(); var q = db.Visits.AsQueryable();
            if (s.PatientId is {} p)
            {
                q = q.Where(v => v.PatientId == p);
                if (s.IsGuest) q = q.Where(v => db.Set<AccessGrant>().Any(gr => gr.SessionId == s.Id && gr.VisitId == v.Id && gr.ExpiresAt > DateTime.UtcNow));
            }
            else {
                var u = await access.Staff("Reception", "Doctor", "Service", "Cashier"); var departments = u.Scopes.Select(sc => sc.DepartmentId).ToArray();
                q = u.Role == "Service" ? q.Where(v => v.Journey.Steps.Any(st => st.Authority == "Service" && departments.Contains(st.DepartmentId))) : q.Where(v => departments.Contains(v.DepartmentId));
                if (u.Role == "Doctor") q = q.Where(v => v.DoctorId == u.Id);
            }
            return await q.OrderByDescending(v => v.CreatedAt).ThenBy(v => v.Id).Skip(offset ?? 0).Take(limit ?? 100).Select(v => new { v.Id, v.Version, v.Status, v.CreatedAt, v.ClosedAt, patientName = v.Patient.Name, ticketNumber = v.Ticket.Number, journeyStatus = v.Journey.Status, v.WorkRevision }).ToListAsync();
        });
        g.MapGet("/visits/{id:guid}", async (Guid id, string? language, Access access, JourneyReader reader) => await reader.Read(await access.Visit(id), language ?? "vi"));
        g.MapPost("/visits/{id:guid}/orders", async (Guid id, OrderInput input, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var u = await access.Staff("Doctor"); return await bus.Run($"{u.Id}:order:{id}", input, async () => {
                var v = await access.DoctorVisit(id); Check.Version(v, input.Version); Active(v);
                var service = await db.Set<HospitalService>().SingleOrDefaultAsync(s => s.Id == input.ServiceId && s.Active);
                Check.That(service is not null, "serviceUnavailable", "Select an active service.");
                var order = new DoctorOrder { VisitId = id, HospitalServiceId = input.ServiceId, OrderedBy = u.Id, Note = Check.Text(input.Note, "note", 0, 500) };
                await workflow.GenerateOrderSteps(v, order, service!); v.Orders.Add(order); workflow.WorkChanged(v);
                bus.Audit(u.Id, "OrderCreated", id, order.Id.ToString()); return new { order.Id };
            });
        });
        g.MapPut("/visits/{id:guid}/orders/{orderId:guid}", async (Guid id, Guid orderId, ChangeOrderInput input, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var u = await access.Staff("Doctor"); return await bus.Run($"{u.Id}:orderChange:{orderId}", input, async () => {
                var v = await access.DoctorVisit(id); Active(v); var order = v.Orders.SingleOrDefault(o => o.Id == orderId) ?? throw new ApiException(404, "notFound", "Order not found.");
                Check.Version(order, input.Version); Check.Text(input.Reason, "reason", 3, 500);
                var steps = v.Journey.Steps.Where(s => s.DoctorOrderId == orderId).ToList();
                Check.That(steps.All(s => s.Status is "Waiting" or "Ready" or "Cancelled"), "serviceStarted", "Started or completed services require authorized service resolution. Recorded facts are retained.", 409);
                Check.That(order.Status == "Ordered", "orderResolved", "This order is already resolved.", 409);
                Check.That(input.Action is "Cancel" or "Update", "validation", "Choose Update or Cancel.");
                foreach (var step in steps) { step.Status = "Cancelled"; step.ResolutionReason = input.Reason; }
                if (input.Action == "Cancel") order.Status = "Cancelled";
                else {
                    var service = await db.Set<HospitalService>().SingleOrDefaultAsync(s => s.Id == input.ServiceId && s.Active);
                    Check.That(service is not null, "serviceUnavailable", "Select an active service."); order.HospitalServiceId = service!.Id; order.Note = input.Reason;
                    await workflow.GenerateOrderSteps(v, order, service);
                }
                // Explicitly mark order modified when only its generated steps changed.
                db.Entry(order).Property(o => o.Note).IsModified = true;
                workflow.WorkChanged(v); bus.Audit(u.Id, "Order" + input.Action, id, input.Reason); return new { order.Id };
            });
        });
        g.MapPost("/visits/{id:guid}/steps/{stepId:guid}/progress", async (Guid id, Guid stepId, ProgressInput input, Access access, HospitalDb db, CommandBus bus, Workflow workflow, IOperationalAdapter adapter, HttpContext http) => {
            var u = await access.Staff("Doctor", "Service");
            var source = input.Source;
            if (source == "Simulation") { var e = await adapter.Validate(new(source, http.Request.Headers["Idempotency-Key"].ToString(), id, stepId, input.Status, input.Version, input.Reason), http.RequestAborted); source = e.Source; }
            else Check.That(source == "Staff", "sourceInvalid", "Unsupported event source.");
            return await bus.Run($"{u.Id}:progress:{stepId}", input, async () => {
                var v = await access.Visit(id); Active(v); var step = v.Journey.Steps.SingleOrDefault(s => s.Id == stepId) ?? throw new ApiException(404, "notFound", "Step not found.");
                Check.Version(step, input.Version);
                Check.That((u.Role == "Doctor" && step.Authority == "Doctor" && v.DoctorId == u.Id) || (u.Role == "Service" && step.Authority == "Service"), "forbidden", "You cannot complete this type of step.", 403);
                Access.Scope(u, step.DepartmentId);
                Check.That(step.Status is "Ready" or "InProgress", "invalidTransition", "Prerequisites must be completed first.", 409);
                Check.That(input.Status is "InProgress" or "Completed" or "Skipped", "invalidTransition", "Unsupported progress transition.");
                Check.That(!(input.Status == "InProgress" && step.Status == "InProgress"), "invalidTransition", "Step is already in progress.", 409);
                if (input.Status == "Skipped") { Check.That(u.Role == "Service", "forbidden", "Only service resolution supports a skip.", 403); step.ResolutionReason = Check.Text(input.Reason, "reason", 3, 500); }
                step.Status = input.Status; if (Workflow.Resolved(step)) step.CompletedAt = DateTime.UtcNow;
                db.Entry(v).Property(v => v.WorkRevision).IsModified = true;
                workflow.Evaluate(v); bus.Audit(u.Id, "Step" + input.Status, id, $"step:{stepId}; reason:{input.Reason}", source); bus.Notify(v.PatientId, id); return new { visitId = id };
            });
        });
        g.MapPost("/visits/{id:guid}/steps/{stepId:guid}/queue", async (Guid id, Guid stepId, QueueInput input, Access access, CommandBus bus, IOperationalAdapter adapter, HttpContext http) => {
            var u = await access.Staff("Doctor", "Service");
            if (input.Source == "Simulation") await adapter.Validate(new("Simulation", http.Request.Headers["Idempotency-Key"].ToString(), id, stepId, input.Status, input.Version, "Queue"), http.RequestAborted);
            else Check.That(input.Source == "Staff", "sourceInvalid", "Unsupported event source.");
            return await bus.Run($"{u.Id}:queue:{stepId}", input, async () => {
                var v = await access.Visit(id); Active(v); var s = v.Journey.Steps.SingleOrDefault(s => s.Id == stepId) ?? throw new ApiException(404, "notFound", "Step not found.");
                Check.Version(s, input.Version); Access.Scope(u, s.DepartmentId); Check.That(s.Authority == u.Role, "forbidden", "Queue is outside your assignment.", 403);
                Check.That(!Workflow.Resolved(s) && input.Status is "Waiting" or "Called" or "Serving", "invalidTransition", "Unsupported queue state.");
                s.QueueNumber = Check.Text(input.Number, "number", 1, 30); s.QueueStatus = input.Status; s.QueueUpdatedAt = DateTime.UtcNow;
                bus.Notify(v.PatientId, id, "queueUpdated"); bus.Audit(u.Id, "QueueUpdated", id, stepId.ToString(), input.Source); return new { s.Id };
            });
        });
        g.MapPost("/visits/{id:guid}/settlement", async (Guid id, SettlementInput input, Access access, HospitalDb db, CommandBus bus, Workflow workflow, ISettlementAdapter adapter, HttpContext http) => {
            var u = await access.Staff("Cashier");
            if (input.Source == "Simulation") await adapter.Validate(new("Simulation", http.Request.Headers["Idempotency-Key"].ToString(), id, input.Outcome, input.WorkRevision), http.RequestAborted);
            else Check.That(input.Source == "Staff", "sourceInvalid", "Unsupported event source.");
            return await bus.Run($"{u.Id}:settlement:{id}", input, async () => {
                var v = await access.Visit(id); Check.Version(v, input.Version); Active(v);
                Check.That(v.WorkRevision == input.WorkRevision, "settlementStale", "Settlement does not match the current required work.", 409);
                Check.That(input.Outcome is "Intermediate" or "Final" or "NoPaymentRequired", "validation", "Invalid settlement outcome.");
                if (input.Outcome == "Intermediate")
                {
                    var p = v.Journey.Steps.Where(s => s.Kind == "IntermediatePayment" && s.Status == "Ready").OrderBy(s => s.Sequence).FirstOrDefault();
                    if (p is not null) { p.Status = "Completed"; p.CompletedAt = DateTime.UtcNow; }
                }
                else { v.FinalSettlementRevision = input.WorkRevision; v.FinalSettlementOutcome = input.Outcome; }
                db.Entry(v).Property(v => v.WorkRevision).IsModified = true;
                workflow.Evaluate(v); bus.Audit(u.Id, "Settlement" + input.Outcome, id, $"revision:{input.WorkRevision}", input.Source); bus.Notify(v.PatientId, id); return new { visitId = id, v.Status, journeyStatus = v.Journey.Status };
            });
        });
        g.MapPost("/visits/{id:guid}/pharmacy", async (Guid id, PharmacyInput input, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var u = await access.Staff("Doctor"); return await bus.Run($"{u.Id}:pharmacy:{id}", input, async () => {
                var v = await access.DoctorVisit(id); Check.Version(v, input.Version); Active(v);
                var step = v.Journey.Steps.SingleOrDefault(s => s.Kind == "Pharmacy" && !Workflow.Resolved(s));
                if (input.Required && step is null) {
                    var location = await workflow.DefaultDestination("PHARMACY");
                    workflow.MakeStep(v.Journey, location, "Pharmacy", "Patient", "pharmacy", 10000);
                }
                if (!input.Required && step is not null) { step.Status = "Cancelled"; step.ResolutionReason = "Doctor confirmed pharmacy guidance not required"; }
                db.Entry(v).Property(v => v.WorkRevision).IsModified = true;
                workflow.Evaluate(v); bus.Audit(u.Id, "PharmacyGuidanceConfigured", id, input.Required.ToString()); return new { visitId = id };
            });
        });
        g.MapPost("/visits/{id:guid}/complete-guidance", async (Guid id, CompleteInput input, Access access, CommandBus bus) => {
            var s = await access.Patient(); return await bus.Run($"{s.Id}:complete:{id}", input, async () => {
                var v = await access.Visit(id); Check.Version(v.Journey, input.Version);
                Check.That(v.Status == "Closed" && v.Journey.Status == "Active", "notEligible", "Guidance can only be completed after Visit closure and ticket activation.", 409);
                var remaining = v.Journey.Steps.Where(st => !Workflow.Resolved(st)).ToArray();
                Check.That(remaining.Length == 1 && remaining[0].Kind == "Pharmacy" && remaining[0].Status == "Ready", "notEligible", "Only the final pharmacy guidance step can be confirmed.", 409);
                remaining[0].Status = "Completed"; remaining[0].CompletedAt = DateTime.UtcNow; Workflow.Complete(v.Journey, "PatientGuidanceConfirmation");
                bus.Audit(s.Id, "GuidanceCompleted", id, "Guidance only; not medication dispensing", "Patient"); return new { visitId = id, journeyStatus = v.Journey.Status };
            });
        });
    }
    static void Active(Visit v) => Check.That(v.Status == "Active", "visitClosed", "This Visit is closed. A later attendance requires a new reception.", 409);
}
