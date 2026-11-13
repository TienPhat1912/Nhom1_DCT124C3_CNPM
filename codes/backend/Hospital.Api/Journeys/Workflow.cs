using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;

public class Workflow(HospitalDb db, CommandBus bus)
{
    public async Task<Location> DefaultDestination(string departmentCode)
    {
        var location = await db.Set<Location>().Where(l => l.Active && db.Set<Department>().Any(d => d.Id == l.DepartmentId && d.Active && d.Code == departmentCode)).OrderBy(l => l.Room).ThenBy(l => l.Id).FirstOrDefaultAsync();
        Check.That(location is not null, "destinationInvalid", "Configure an active destination for this operational department before continuing.", 409);
        return location!;
    }
    public static bool Resolved(JourneyStep s) => s.Status is "Completed" or "Skipped" or "Cancelled";
    public static bool Clinical(JourneyStep s) => s.Kind is "Consultation" or "ReturnConsultation" or "Service";
    public static bool ReadyForSettlement(Visit v) => v.Journey.Steps.Where(s => Clinical(s) || s.Kind == "IntermediatePayment").All(Resolved);
    public JourneyStep MakeStep(PatientJourney journey, Location location, string kind, string authority, string template, int sequence, DoctorOrder? order = null, int mapping = 0)
    {
        var s = new JourneyStep { PatientJourneyId = journey.Id, LocationId = location.Id, DepartmentId = location.DepartmentId,
            DestinationSnapshot = JsonSerializer.Serialize(new { location.Id, location.DepartmentId, location.NameVi, nameEn = location.NameVi, location.Building, location.Floor, location.Room }, CommandBus.Json),
            Kind = kind, Authority = authority, TemplateKey = template, Sequence = sequence, DoctorOrderId = order?.Id,
            HospitalServiceId = order?.HospitalServiceId, MappingVersion = mapping };
        journey.Steps.Add(s); return s;
    }
    public static void Depends(JourneyStep target, JourneyStep prerequisite)
    {
        if (target.Id != prerequisite.Id && target.Dependencies.All(d => d.PrerequisiteStepId != prerequisite.Id))
            target.Dependencies.Add(new StepDependency { JourneyStepId = target.Id, PrerequisiteStepId = prerequisite.Id });
    }
    public void Evaluate(Visit visit)
    {
        var j = visit.Journey;
        var byId = j.Steps.ToDictionary(s => s.Id);
        foreach (var s in j.Steps.Where(s => s.Status is "Waiting" or "Ready"))
        {
            var ready = s.Dependencies.All(d => byId.TryGetValue(d.PrerequisiteStepId, out var pre) && Resolved(pre));
            if (s.Kind == "Settlement") ready = ReadyForSettlement(visit);
            if (s.Kind == "Pharmacy") ready = visit.Status == "Closed";
            s.Status = ready ? "Ready" : "Waiting";
        }
        if (visit.Status == "Active" && ReadyForSettlement(visit) && visit.FinalSettlementRevision == visit.WorkRevision)
        {
            visit.Status = "Closed"; visit.ClosedAt = DateTime.UtcNow;
            foreach (var s in j.Steps.Where(s => s.Kind == "Settlement" && !Resolved(s))) { s.Status = "Completed"; s.CompletedAt = DateTime.UtcNow; }
            bus.Audit(Guid.Empty, "VisitClosed", visit.Id, $"workRevision:{visit.WorkRevision}", "Workflow");
        }
        if (visit.Status == "Closed")
        {
            var pharmacy = j.Steps.SingleOrDefault(s => s.Kind == "Pharmacy" && !Resolved(s));
            if (pharmacy is not null) pharmacy.Status = "Ready";
            else if (j.Status != "Completed") Complete(j, "WorkflowNoPharmacy");
        }
        foreach (var order in visit.Orders.Where(o => o.Status != "Cancelled"))
            if (j.Steps.Where(s => s.DoctorOrderId == order.Id).All(Resolved)) order.Status = "Resolved";
    }
    public static void Complete(PatientJourney j, string source)
    { j.Status = "Completed"; j.CompletedAt = DateTime.UtcNow; j.CompletionSource = source; }
    public async Task<MappingNode[]> ValidateMapping(WorkflowMapping map)
    {
        MappingNode[] nodes;
        try { nodes = JsonSerializer.Deserialize<MappingNode[]>(map.StepsJson, CommandBus.Json) ?? []; }
        catch (JsonException) { throw new ApiException(422, "mappingInvalid", "Invalid workflow mapping."); }
        Check.That(nodes.Length is > 0 and <= 12 && nodes.Select(n => n.Key).Distinct().Count() == nodes.Length, "mappingInvalid", "Mapping requires 1–12 unique steps.");
        var seen = new HashSet<string>();
        foreach (var n in nodes)
        {
            Check.Text(n.Key, "key", 1, 60);
            Check.That(n.Authority is "Service" or "Cashier", "mappingInvalid", "Service steps require Service or Cashier authority.");
            Check.That(n.DependsOn.All(seen.Contains), "mappingCycle", "Prerequisites must refer to earlier steps; cycles are forbidden.");
            Check.That(await db.Set<Location>().AnyAsync(l => l.Id == n.LocationId && l.Active), "mappingInvalid", "Mapping destination is missing or disabled.");
            Check.That(await db.Set<Location>().AnyAsync(l => l.Id == n.LocationId && db.Set<Department>().Any(d => d.Id == l.DepartmentId && d.Active)), "mappingInvalid", "Mapping department is disabled.");
            Check.That(await db.Set<GuidanceTemplate>().AnyAsync(t => t.Key == n.TemplateKey && t.Published), "mappingInvalid", "Approved guidance is required.");
            seen.Add(n.Key);
        }
        return nodes;
    }
    public async Task GenerateOrderSteps(Visit visit, DoctorOrder order, HospitalService service)
    {
        var map = await db.Set<WorkflowMapping>().Where(m => m.HospitalServiceId == service.Id && m.Published).OrderByDescending(m => m.Revision).FirstOrDefaultAsync();
        Check.That(map is not null, "mappingMissing", "No published workflow mapping. Ask an administrator before placing this order.", 409);
        var nodes = await ValidateMapping(map!);
        order.MappingVersion = map!.Revision;
        var consult = visit.Journey.Steps.Where(s => s.Kind is "Consultation" or "ReturnConsultation").OrderBy(s => s.Sequence).LastOrDefault(s => s.Status is "Completed" or "InProgress")
            ?? visit.Journey.Steps.Single(s => s.Kind == "Consultation");
        var generated = new Dictionary<string, JourneyStep>();
        var sequence = Math.Max(20, visit.Journey.Steps.Where(s => s.Sequence < 9000).Select(s => s.Sequence).DefaultIfEmpty(10).Max() + 10);
        foreach (var node in nodes)
        {
            var location = await db.Set<Location>().SingleAsync(l => l.Id == node.LocationId);
            var s = MakeStep(visit.Journey, location, node.Authority == "Cashier" ? "IntermediatePayment" : "Service", node.Authority, node.TemplateKey, sequence++, order, map.Revision);
            Depends(s, consult);
            foreach (var key in node.DependsOn) Depends(s, generated[key]);
            generated[node.Key] = s;
        }
        if (service.ReturnRequired)
        {
            var ret = visit.Journey.Steps.LastOrDefault(s => s.Kind == "ReturnConsultation" && s.Status is "Waiting" or "Ready");
            if (ret is null)
            {
                var loc = await db.Set<Location>().SingleAsync(l => l.Id == consult.LocationId);
                ret = MakeStep(visit.Journey, loc, "ReturnConsultation", "Doctor", "return", sequence + 10);
            }
            foreach (var s in visit.Journey.Steps.Where(s => s.Kind is "Service" or "IntermediatePayment")) Depends(ret, s);
            Depends(ret, consult);
        }
        // All pending returns wait for every service required by the current work.
        foreach (var ret in visit.Journey.Steps.Where(s => s.Kind == "ReturnConsultation" && s.Id != consult.Id && s.Status is "Waiting" or "Ready"))
            foreach (var s in generated.Values) Depends(ret, s);
    }
    public void WorkChanged(Visit visit)
    {
        visit.WorkRevision++;
        Evaluate(visit);
        bus.Notify(visit.PatientId, visit.Id);
    }
}
