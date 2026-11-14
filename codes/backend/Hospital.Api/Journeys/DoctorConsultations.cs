using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Reception;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;

public static class DoctorConsultations
{
    public static async Task Authorize(HospitalDb db, Guid doctorId, Guid clinicId)
    {
        var valid = await (from room in db.Set<ClinicRoom>()
            join location in db.Set<Location>() on room.ClinicLocationId equals location.Id
            join department in db.Set<Department>() on location.DepartmentId equals department.Id
            join doctor in db.Users on room.ActiveDoctorId equals doctor.Id
            where room.ClinicLocationId == clinicId && doctor.Id == doctorId && doctor.Active && doctor.Role == "Doctor"
                && doctor.PasswordHash != "" && location.Active && department.Active
                && doctor.Scopes.Any(s => s.DepartmentId == department.Id)
                && db.Set<ClinicDoctor>().Any(a => a.ClinicLocationId == clinicId && a.DoctorId == doctorId)
            select room.Id).AnyAsync();
        Check.That(valid, "outOfScope", "This clinic requires its active assigned doctor.", 403);
    }

    public static void MapDoctorConsultations(this WebApplication app)
    {
        var group = app.MapGroup("/api/v2").WithTags("Doctor consultation");
        group.AddEndpointFilter(async (ctx, next) => {
            Check.That(app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "V2 workflow is not enabled.", 503);
            return await next(ctx);
        });
        group.MapGet("/clinics/{clinicId:guid}/queue", async (Guid clinicId, int? offset, Access access, HospitalDb db) => {
            var doctor = await access.Staff("Doctor"); await Authorize(db, doctor.Id, clinicId);
            Check.That((offset ?? 0) >= 0, "validation", "Use a non-negative offset.");
            var query = db.Visits.AsNoTracking().Where(v => v.Status == "Active" && v.ClinicLocationId == clinicId && v.Ticket.SnapshotSource == "Captured"
                && v.DoctorId == doctor.Id && v.Journey.Status == "Active");
            var current = await query.Where(v => v.ExamStatus == "InConsultation").Select(v => (Guid?)v.Id).SingleOrDefaultAsync();
            var waiting = await query.Where(v => v.ExamStatus == "Waiting").OrderBy(v => v.Ticket.IssuedOn)
                .ThenBy(v => v.Ticket.SequenceNumber).ThenBy(v => v.Id).Skip(offset ?? 0).Take(100)
                .Select(v => new { v.Id, v.Version, patientSnapshot = v.Ticket.PatientSnapshot, number = v.Ticket.Number,
                    issuedOn = v.Ticket.IssuedOn, v.ClinicLocationId, v.ExamStatus }).ToArrayAsync();
            var inService = await query.Where(v => v.ExamStatus == "InService").OrderByDescending(v => v.CreatedAt).ThenBy(v => v.Id).Take(100)
                .Select(v => new { v.Id, patientSnapshot = v.Ticket.PatientSnapshot, number = v.Ticket.Number }).ToArrayAsync();
            return new { clinicLocationId = clinicId, currentVisitId = current,
                inService = inService.Select(v => new { v.Id, v.number, patientName = JsonSerializer.Deserialize<PatientTicketSnapshot>(v.patientSnapshot!, CommandBus.Json)!.Name }),
                waiting = waiting.Select(v => new {
                v.Id, v.Version, patientName = JsonSerializer.Deserialize<PatientTicketSnapshot>(v.patientSnapshot!, CommandBus.Json)!.Name,
                v.number, v.issuedOn, v.ClinicLocationId, v.ExamStatus }) };
        });
        group.MapGet("/doctor/clinics", async (Access access, HospitalDb db) => {
            var doctor = await access.Staff("Doctor");
            var ids = await db.Set<ClinicRoom>().Where(r => r.ActiveDoctorId == doctor.Id).Select(r => r.ClinicLocationId).ToListAsync();
            var allowed = new List<object>();
            foreach (var id in ids) {
                try { await Authorize(db, doctor.Id, id); }
                catch (ApiException e) when (e.Status == 403) { continue; }
                var room = await db.Set<Location>().AsNoTracking().SingleAsync(l => l.Id == id);
                allowed.Add(new { clinicLocationId = id, room.NameVi, room.Room });
            }
            return allowed;
        });
        group.MapPost("/visits/{id:guid}/consultations/accept", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus) => {
            var actor = await access.Staff("Doctor");
            Check.That(body.ValueKind == JsonValueKind.Object && body.EnumerateObject().Count() == 1
                && body.TryGetProperty("version", out var property) && property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var version) && version > 0,
                "validation", "Only a positive Visit version is accepted.");
            var expected = body.GetProperty("version").GetInt32();
            // Recheck authorization before receipt replay too. Never return an old response after scope revocation.
            var subject = await db.Visits.AsNoTracking().SingleOrDefaultAsync(v => v.Id == id)
                ?? throw new ApiException(404, "notFound", "Visit not found.");
            Check.That(subject.DoctorId == actor.Id && subject.ClinicLocationId != null, "outOfScope", "Visit is not assigned to you.", 403);
            await Authorize(db, actor.Id, subject.ClinicLocationId!.Value);
            return await bus.Run<object>($"prd-v2:{actor.Id}:consultation:{id}", new { version = expected }, async () => {
                await Authorize(db, actor.Id, subject.ClinicLocationId.Value);
                var visit = await db.FullVisits().SingleAsync(v => v.Id == id);
                Check.That(visit.DoctorId == actor.Id && visit.ClinicLocationId == subject.ClinicLocationId, "outOfScope", "Assignment changed.", 403);
                Check.Version(visit, expected);
                Check.That(visit.Status == "Active" && visit.Journey.Status == "Active" && visit.ExamStatus == "Waiting", "requestLocked", "Visit must be waiting for consultation.", 409);
                Check.That(!await db.Visits.AnyAsync(v => v.ClinicLocationId == visit.ClinicLocationId && v.Status == "Active" && v.ExamStatus == "InConsultation"),
                    "clinicBusy", "The clinic already has a consultation in progress.", 409);
                var step = visit.Journey.Steps.Where(s => s.Kind is "Consultation" or "ReturnConsultation")
                    .Where(s => s.Status == "Ready").OrderBy(s => s.Sequence).FirstOrDefault();
                Check.That(step != null && visit.ConsultationCount != null && visit.Ticket.SnapshotSource == "Captured", "requestLocked", "Consultation is not ready.", 409);
                visit.ExamStatus = "InConsultation"; visit.ConsultationCount++;
                step!.Status = "InProgress"; step.ConsultationNumber = visit.ConsultationCount;
                db.Entry(visit.Journey).Property(j => j.Version).IsModified = true;
                var ticket = ReceptionConfirmation.Ticket(visit);
                var call = new ConsultationCall { VisitId = id, ClinicLocationId = visit.ClinicLocationId!.Value,
                    DoctorId = actor.Id, ConsultationNumber = visit.ConsultationCount!.Value };
                call.PayloadJson = JsonSerializer.Serialize(new { call.Id, visitId = id, call.ConsultationNumber,
                    occurredAt = call.CreatedAt, call.ContentRevision,
                    ticket = new { ticket.ClinicLocationId, ticket.IssuedOn, ticket.SequenceNumber, ticket.Number },
                    clinic = ticket.ClinicSnapshot, doctor = ticket.DoctorSnapshot }, CommandBus.Json);
                db.Add(call); bus.Audit(actor.Id, "ConsultationAccepted", id, call.Id.ToString());
                bus.Notify(visit.PatientId, id, "consultationCalled");
                await db.SaveChangesAsync();
                return await View(visit, db, call, canOrder: !visit.Orders.Any(o => o.Status is "NotCompleted" or "Ordered"));
            });
        });
        group.MapGet("/visits/{id:guid}", async (Guid id, Access access, HospitalDb db) => {
            var visit = await access.Visit(id);
            Check.That(visit.ExamStatus != null && visit.Ticket.SnapshotSource == "Captured", "legacyRecord", "Use the historical Visit contract.", 409);
            var session = await access.Current();
            bool canAccept = false;
            if (session.UserAccount?.Role == "Doctor") {
                await Authorize(db, session.UserAccount.Id, visit.ClinicLocationId!.Value);
                canAccept = visit.Status == "Active" && visit.Journey.Status == "Active" && visit.ExamStatus == "Waiting"
                    && visit.Journey.Steps.Any(s => (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") && s.Status == "Ready")
                    && !await db.Visits.AnyAsync(v => v.ClinicLocationId == visit.ClinicLocationId && v.Status == "Active" && v.ExamStatus == "InConsultation");
            }
            var canOrder = session.UserAccount?.Role == "Doctor" && visit.Status == "Active" && visit.Journey.Status == "Active"
                && visit.ExamStatus == "InConsultation" && visit.ConsultationCount > 0
                && visit.Journey.Steps.Count(s => (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") && s.Status == "InProgress") == 1
                && !visit.Orders.Any(o => o.Status is "NotCompleted" or "Ordered");
            var canComplete = session.UserAccount?.Role == "Service" && visit.Status == "Active" && visit.Journey.Status == "Active"
                && visit.ExamStatus == "InService" && visit.Journey.Steps.Any(s => s.Kind == "Service" && s.Authority == "Service"
                    && s.Status == "Ready" && session.UserAccount.Scopes.Any(sc => sc.DepartmentId == s.DepartmentId)
                    && visit.Orders.Any(o => o.Id == s.DoctorOrderId && o.Status == "NotCompleted" && o.ConsultationNumber == visit.ConsultationCount));
            return await View(visit, db, canAccept: canAccept, canOrder: canOrder, canComplete: canComplete, canExam: canOrder, canView: visit.ExamStatus == "Completed" && (session.PatientId != null || session.UserAccount?.Role == "Doctor"));
        });
    }

    public static async Task<object> View(Visit v, HospitalDb db, ConsultationCall? call = null, bool canAccept = false, bool canOrder = false, bool canComplete = false, bool canExam = false, bool canView = false)
    {
        call ??= await db.Set<ConsultationCall>().AsNoTracking().Where(c => c.VisitId == v.Id).OrderByDescending(c => c.ConsultationNumber).FirstOrDefaultAsync();
        var ticket = ReceptionConfirmation.Ticket(v);
        var step = v.Journey.Steps.Where(s => !Workflow.Resolved(s)).OrderBy(s => s.Sequence).FirstOrDefault();
        var completedIds = v.Orders.Where(o => o.CompletedById != null).Select(o => o.CompletedById!.Value).ToArray();
        var names = await db.Users.AsNoTracking().Where(u => completedIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
        return new { contractVersion = "prd-v2", v.Id, v.Version, createdAt = DateTime.SpecifyKind(v.CreatedAt, DateTimeKind.Utc), v.Status, journeyStatus = v.Journey.Status,
            v.ExamStatus, patientName = ticket.PatientSnapshot.Name, v.ClinicLocationId, clinic = ticket.ClinicSnapshot,
            v.DoctorId, doctor = ticket.DoctorSnapshot, ticket = new { ticket.ClinicLocationId, ticket.IssuedOn, ticket.SequenceNumber, ticket.Number },
            v.ConsultationCount, examinationCompletedAt = v.ExaminationCompletedAt is {} completedAt ? (DateTime?)DateTime.SpecifyKind(completedAt, DateTimeKind.Utc) : null, v.ClosedAt, v.WorkRevision, v.DepartmentId,
            journeyId = v.Journey.Id, journeyVersion = v.Journey.Version, updatedAt = DateTime.UtcNow,
            v.FinalSettlementRevision, v.FinalSettlementOutcome, currentStepId = step?.Id,
            currentStep = step == null ? null : Step(step, v.ConsultationCount), latestConsultationCall = call == null ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(call.PayloadJson),
            capabilities = new { canAcceptConsultation = canAccept, canConfirmOrder = canOrder, canCompleteService = canComplete,
                canPreviewExamination = canExam || canOrder, canCompleteExamination = canExam || canOrder, canSettle = false, canViewResults = canView },
            steps = v.Journey.Steps.OrderBy(s => s.Sequence).Select(s => Step(s, v.ConsultationCount)),
            orders = v.Orders.Where(o => o.ConsultationNumber != null).OrderBy(o => o.ConsultationNumber).Select(o => Order(o, names)) };
    }
    public static object Order(DoctorOrder o, Dictionary<Guid, string> names) => new {
        o.Id, o.Version, createdAt = DateTime.SpecifyKind(o.CreatedAt, DateTimeKind.Utc), o.HospitalServiceId, o.Status, o.ConsultationNumber, o.Note,
        serviceSnapshot = JsonSerializer.Deserialize<JsonElement>(o.ServiceSnapshot!),
        destinationSnapshot = JsonSerializer.Deserialize<JsonElement>(o.DestinationSnapshot!),
        orderedBy = JsonSerializer.Deserialize<JsonElement>(o.OrderedBySnapshot!),
        completedBy = o.CompletedById is {} id ? new { id, name = names.GetValueOrDefault(id, "") } : null,
        completedAt = o.CompletedAt is {} at ? (DateTime?)DateTime.SpecifyKind(at, DateTimeKind.Utc) : null };
    static object Step(JourneyStep s, int? count) => new { s.Id, s.Version, createdAt = DateTime.SpecifyKind(s.CreatedAt, DateTimeKind.Utc), s.Kind, s.Status, s.Sequence,
        consultationNumber = s.ConsultationNumber ?? (s.Status == "InProgress" && (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") ? count : null),
        s.DoctorOrderId, destination = JsonSerializer.Deserialize<JsonElement>(s.DestinationSnapshot),
        completedAt = s.CompletedAt is {} at ? (DateTime?)DateTime.SpecifyKind(at, DateTimeKind.Utc) : null };
}
