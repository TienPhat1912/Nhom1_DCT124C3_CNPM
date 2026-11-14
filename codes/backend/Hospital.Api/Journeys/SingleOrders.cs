using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Reception;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;

public static class SingleOrders
{
    public record Input(int Version, Guid ServiceId, string Note);
    record Configuration(HospitalService Service, Location Location, Department Department, WorkflowMapping Mapping, GuidanceTemplate Template);
    static Input Parse(JsonElement body, bool confirm)
    {
        string[] fields = confirm ? ["version", "serviceId", "note", "previewId"] : ["version", "serviceId", "note"];
        Check.That(body.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
        var names = body.EnumerateObject().Select(p => p.Name).ToArray();
        Check.That(names.Length == fields.Length && names.Distinct().Count() == fields.Length && names.All(fields.Contains), "validation", "Only order input fields are allowed.");
        Check.That(body.GetProperty("version").ValueKind == JsonValueKind.Number && body.GetProperty("version").TryGetInt32(out var _) && body.GetProperty("version").GetInt32() > 0
            && body.GetProperty("serviceId").ValueKind == JsonValueKind.String && body.GetProperty("serviceId").TryGetGuid(out var _)
            && body.GetProperty("note").ValueKind == JsonValueKind.String, "validation", "Invalid order fields.");
        return new(body.GetProperty("version").GetInt32(), body.GetProperty("serviceId").GetGuid(), Check.Text(body.GetProperty("note").GetString(), "note", 0, 500));
    }
    static async Task<Visit> Subject(Guid id, UserAccount actor, HospitalDb db)
    {
        var v = await db.Visits.AsNoTracking().SingleOrDefaultAsync(v => v.Id == id) ?? throw new ApiException(404, "notFound", "Visit not found.");
        Check.That(v.DoctorId == actor.Id && v.ClinicLocationId != null, "outOfScope", "This Visit is not assigned to you.", 403);
        await DoctorConsultations.Authorize(db, actor.Id, v.ClinicLocationId!.Value);
        return v;
    }
    static void Ready(Visit v, int version)
    {
        Check.Version(v, version);
        Check.That(v.Status == "Active" && v.Journey.Status == "Active" && v.ExamStatus == "InConsultation"
            && v.ConsultationCount > 0 && v.Ticket.SnapshotSource == "Captured"
            && v.Journey.Steps.Count(s => (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") && s.Status == "InProgress") == 1,
            "requestLocked", "Accept the patient for consultation first.", 409);
        Check.That(!v.Orders.Any(o => o.Status is "NotCompleted" or "Ordered"), "orderImmutable", "Complete the existing service before another consultation/order.", 409);
    }
    static async Task<Configuration> Capture(Guid serviceId, HospitalDb db, Workflow workflow)
    {
        // Hold configuration rows/ranges until the preview/confirm transaction commits,
        // including catalog updates from another process outside CommandBus.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM HospitalService WITH (UPDLOCK,HOLDLOCK) WHERE Id={serviceId}; SELECT Id FROM WorkflowMapping WITH (UPDLOCK,HOLDLOCK) WHERE HospitalServiceId={serviceId};");
        var service = await db.Set<HospitalService>().AsNoTracking().SingleOrDefaultAsync(s => s.Id == serviceId && s.Active);
        Check.That(service != null, "serviceUnavailable", "Choose an active service.", 409);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM Location WITH (UPDLOCK,HOLDLOCK) WHERE Id={service!.LocationId}; SELECT Id FROM Department WITH (UPDLOCK,HOLDLOCK) WHERE Id={service.DepartmentId};");
        var location = await db.Set<Location>().AsNoTracking().SingleOrDefaultAsync(l => l.Id == service!.LocationId && l.Active);
        Check.That(location != null && location.DepartmentId == service!.DepartmentId, "destinationInvalid", "Service destination is unavailable.", 409);
        var department = await db.Set<Department>().AsNoTracking().SingleOrDefaultAsync(d => d.Id == location!.DepartmentId && d.Active);
        Check.That(department != null, "destinationInvalid", "Service department is unavailable.", 409);
        var mapping = await db.Set<WorkflowMapping>().AsNoTracking().Where(m => m.HospitalServiceId == serviceId && m.Published).OrderByDescending(m => m.Revision).ThenBy(m => m.Id).FirstOrDefaultAsync();
        Check.That(mapping != null, "mappingMissing", "Configure a published service mapping.", 409);
        var nodes = await workflow.ValidateMapping(mapping!);
        Check.That(nodes.Length == 1 && nodes[0].Authority == "Service" && nodes[0].LocationId == location!.Id && nodes[0].DependsOn.Length == 0,
            "mappingInvalid", "V2 requires one direct Service destination; legacy multi-step mappings remain legacy only.", 409);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT Id FROM GuidanceTemplate WITH (UPDLOCK,HOLDLOCK) WHERE [Key]={nodes[0].TemplateKey};");
        var template = await db.Set<GuidanceTemplate>().AsNoTracking().Where(t => t.Key == nodes[0].TemplateKey && t.Published && t.Language == "vi")
            .OrderByDescending(t => t.Revision).ThenBy(t => t.Id).FirstOrDefaultAsync();
        Check.That(template != null, "mappingInvalid", "Configure an approved Vietnamese guidance template.", 409);
        return new(service!, location!, department!, mapping!, template!);
    }
    static string Hash(Configuration c) => Crypto.Hash(JsonSerializer.Serialize(c, CommandBus.Json));
    static object Destination(Location l) => new { l.Id, l.DepartmentId, l.NameVi, nameEn = l.NameVi, l.Building, l.Floor, l.Room };
    public static void MapSingleOrders(this WebApplication app)
    {
        var group = app.MapGroup("/api/v2").WithTags("Single service order");
        group.AddEndpointFilter(async (ctx, next) => { Check.That(app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "V2 workflow is disabled.", 503); return await next(ctx); });
        group.MapGet("/order-services", async (Access access, HospitalDb db) => {
            await access.Staff("Doctor");
            return await db.Set<HospitalService>().Where(s => s.Active).OrderBy(s => s.Code).Select(s => new { s.Id, s.Code, s.NameVi }).ToArrayAsync();
        });
        group.MapPost("/visits/{id:guid}/orders/preview", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var actor = await access.Staff("Doctor"); await Subject(id, actor, db); var input = Parse(body, false);
            return await bus.Run<object>($"prd-v2:{actor.Id}:order-preview:{id}", input, async () => {
                await Subject(id, actor, db);
                var visit = await db.FullVisits().SingleAsync(v => v.Id == id); Ready(visit, input.Version);
                var configuration = await Capture(input.ServiceId, db, workflow);
                var preview = new OrderPreview { VisitId = id, DoctorId = actor.Id, VisitVersion = input.Version, ServiceId = input.ServiceId,
                    Note = input.Note, ConfigurationHash = Hash(configuration), ExpiresAt = DateTime.UtcNow.AddMinutes(5) };
                db.Add(preview);
                return new { previewId = preview.Id, visitId = id, visitVersion = input.Version, preview.ExpiresAt,
                    service = new { configuration.Service.Id, configuration.Service.Code, configuration.Service.NameVi },
                    destination = Destination(configuration.Location), input.Note };
            });
        });
        group.MapPost("/visits/{id:guid}/orders", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var actor = await access.Staff("Doctor"); await Subject(id, actor, db); var input = Parse(body, true);
            Check.That(body.GetProperty("previewId").ValueKind == JsonValueKind.String && body.GetProperty("previewId").TryGetGuid(out var _), "validation", "A valid previewId is required.");
            var previewId = body.GetProperty("previewId").GetGuid();
            return await bus.Run<object>($"prd-v2:{actor.Id}:single-order:{id}", new { input.Version, input.ServiceId, input.Note, previewId }, async () => {
                await Subject(id, actor, db);
                var visit = await db.FullVisits().SingleAsync(v => v.Id == id); Ready(visit, input.Version);
                var preview = await db.Set<OrderPreview>().AsNoTracking().SingleOrDefaultAsync(p => p.Id == previewId && p.VisitId == id && p.DoctorId == actor.Id);
                Check.That(preview != null && preview.VisitVersion == input.Version && preview.ServiceId == input.ServiceId && preview.Note == input.Note
                    && preview.ExpiresAt > DateTime.UtcNow, "previewStale", "Review the order again before confirming.", 409);
                var configuration = await Capture(input.ServiceId, db, workflow);
                Check.That(Hash(configuration) == preview!.ConfigurationHash, "previewStale", "Service configuration changed. Review again.", 409);
                var consult = visit.Journey.Steps.SingleOrDefault(s => (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") && s.Status == "InProgress");
                Check.That(consult != null, "requestLocked", "No consultation in progress.", 409);
                consult!.Status = "Completed"; consult.CompletedAt = DateTime.UtcNow; consult.ConsultationNumber = visit.ConsultationCount;
                var order = new DoctorOrder { VisitId = id, HospitalServiceId = input.ServiceId, OrderedBy = actor.Id, Status = "NotCompleted", Note = input.Note,
                    ConsultationNumber = visit.ConsultationCount, MappingVersion = configuration.Mapping.Revision,
                    ServiceSnapshot = JsonSerializer.Serialize(new { configuration.Service.Code, configuration.Service.NameVi, nameEn = configuration.Service.NameVi }, CommandBus.Json),
                    DestinationSnapshot = JsonSerializer.Serialize(Destination(configuration.Location), CommandBus.Json),
                    OrderedBySnapshot = JsonSerializer.Serialize(new DoctorTicketSnapshot(actor.Id, actor.Name), CommandBus.Json) };
                visit.Orders.Add(order);
                var sequence = Math.Max(20, visit.Journey.Steps.Where(s => s.Sequence < 9000).Select(s => s.Sequence).DefaultIfEmpty(10).Max() + 10);
                var serviceStep = workflow.MakeStep(visit.Journey, configuration.Location, "Service", "Service", configuration.Template.Key, sequence, order, configuration.Mapping.Revision);
                serviceStep.ConsultationNumber = visit.ConsultationCount; serviceStep.Status = "Ready"; Workflow.Depends(serviceStep, consult);
                foreach (var settlement in visit.Journey.Steps.Where(s => s.Kind == "Settlement" && !Workflow.Resolved(s))) Workflow.Depends(settlement, serviceStep);
                visit.ExamStatus = "InService"; visit.WorkRevision++;
                db.Entry(visit.Journey).Property(j => j.Version).IsModified = true;
                bus.Audit(actor.Id, "SingleOrderConfirmed", id, order.Id.ToString()); bus.Notify(visit.PatientId, id);
                await db.SaveChangesAsync(); return await DoctorConsultations.View(visit, db);
            });
        });
    }
}
