using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Integrations;
using Hospital.Api.Journeys;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Reception;
public record RequestInput(string Name, string Contact, string Description, string Requests, Guid DepartmentId, int Version = 0);
public record CodeInput(string Code);
public record ConfirmInput(int Version, Guid DepartmentId, Guid LocationId, Guid DoctorId, bool AttendeeVerified, string VerificationNote);
public record MessageInput(Guid TemplateId, int Version);
public record SupplementInput(RequestInput Information, Guid? MessageId, string Response);
public record VerifyInput(string Reference, string Proof);
public record AppointmentInput(Guid AppointmentId);
public record BookingInput(string Reference, bool AttendeeVerified, string VerificationNote);
public record RecoveryIssue(bool AttendeeVerified, string VerificationNote);

public static class ReceptionEndpoints
{
    public static void MapReception(this WebApplication app)
    {
        var g = app.MapGroup("/api").WithTags("Reception and QR");
        g.MapGet("/entry", () => new { purpose = "Hospital", languages = new[] { "vi", "en" }, createsVisit = false });
        g.MapGet("/requests", async (int? offset, int? limit, Access access, HospitalDb db) => {
            Check.That((offset ?? 0) >= 0 && (limit ?? 100) is >= 1 and <= 100, "validation", "Use non-negative offset and a page size from 1 to 100.");
            var s = await access.Current(); var q = db.Requests.AsQueryable();
            if (s.PatientId is {} p) q = q.Where(r => r.PatientId == p && (!s.IsGuest || r.SessionId == s.Id));
            else { var u = await access.Staff("Reception"); var deps = u.Scopes.Select(sc => sc.DepartmentId); q = q.Where(r => deps.Contains(r.DepartmentId)); }
            return await q.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id).Skip(offset ?? 0).Take(limit ?? 100).Select(r => new { r.Id, r.Name, r.Status, r.Version, r.DepartmentId, r.AppointmentId, r.CreatedAt }).ToListAsync();
        });
        g.MapGet("/requests/{id:guid}", async (Guid id, Access access, HospitalDb db, QrService qr) => {
            var r = await access.Request(id); var code = await qr.Current("Reception", id);
            var reception = await db.Set<ReceptionRecord>().SingleOrDefaultAsync(x => x.RegistrationRequestId == id);
            var visitId = reception is null ? (Guid?)null : await db.Visits.Where(v => v.ReceptionRecordId == reception.Id).Select(v => (Guid?)v.Id).SingleOrDefaultAsync();
            return new { r.Id, r.Version, r.Name, r.Contact, r.Description, r.Requests, r.Status, r.DepartmentId, r.AppointmentId, r.Messages,
                code = qr.Reveal(code), qrExpiresAt = code.ExpiresAt, visitId };
        });
        g.MapPost("/requests", async (RequestInput input, Access access, HospitalDb db, CommandBus bus, QrService qr) => {
            var s = await access.Patient();
            return await bus.Run($"{s.Id}:request", input, async () => {
                if (s.IsGuest) Check.That(!await db.Requests.AnyAsync(r => r.SessionId == s.Id && r.Status != "Withdrawn"), "requestExists", "Resume the existing guest request.", 409);
                var p = await db.Patients.SingleAsync(p => p.Id == s.PatientId);
                var r = new RegistrationRequest { PatientId = p.Id, SessionId = s.Id };
                await Apply(input, r, db); p.Name = r.Name; p.Contact = r.Contact;
                db.Add(r); qr.Create("Reception", r.Id); bus.Audit(s.Id, "RequestSubmitted", detail: r.Id.ToString(), source: "Patient");
                return new { r.Id };
            });
        });
        g.MapPut("/requests/{id:guid}", async (Guid id, SupplementInput input, Access access, HospitalDb db, CommandBus bus) => {
            var s = await access.Patient();
            return await bus.Run($"{s.Id}:supplement:{id}", input, async () => {
                var r = await access.Request(id); Check.Version(r, input.Information.Version);
                Check.That(r.Status is "Submitted" or "NeedsInformation", "requestLocked", "This request can no longer be edited.", 409);
                await Apply(input.Information, r, db); r.Status = "Submitted";
                if (input.MessageId is {} mid) { var message = r.Messages.SingleOrDefault(m => m.Id == mid); Check.That(message is not null, "validation", "Unknown message."); message!.Response = Check.Text(input.Response, "response"); }
                // Keep the profile used by Visit displays in sync with the corrected request.
                r.Patient.Name = r.Name; r.Patient.Contact = r.Contact;
                bus.Audit(s.Id, "RequestSupplemented", detail: r.Id.ToString(), source: "Patient"); return new { r.Id };
            });
        });
        g.MapPost("/requests/{id:guid}/withdraw", async (Guid id, Access access, CommandBus bus) => {
            var s = await access.Patient(); return await bus.Run($"{s.Id}:withdraw:{id}", new { id }, async () => {
                var r = await access.Request(id); Check.That(r.Status != "Confirmed", "requestLocked", "Confirmed reception cannot be withdrawn.", 409); r.Status = "Withdrawn"; return new { r.Id };
            });
        });
        g.MapPost("/requests/{id:guid}/refresh-qr", async (Guid id, Access access, QrService qr, CommandBus bus) => {
            var s = await access.Current(); return await bus.Run($"{s.Id}:refresh:{id}", new { id }, async () => { await access.Request(id); await qr.Replace("Reception", id); return new { id }; });
        });
        g.MapPost("/reception/scan", async (CodeInput input, Access access, QrService qr) => {
            await access.Staff("Reception"); var code = await qr.Validate(input.Code, "Reception"); var r = await access.Request(code.RegistrationRequestId!.Value); return new { r.Id };
        });
        g.MapPost("/requests/{id:guid}/message", async (Guid id, MessageInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Reception"); return await bus.Run($"{u.Id}:message:{id}", input, async () => {
                var r = await access.Request(id); Check.Version(r, input.Version); Check.That(r.Status != "Confirmed" && r.Status != "Withdrawn", "requestLocked", "Request is closed.", 409);
                var selected = await db.Set<GuidanceTemplate>().SingleOrDefaultAsync(t => t.Id == input.TemplateId && t.Category == "Reception" && t.Published);
                Check.That(selected is not null, "templateUnavailable", "An approved reception template is required.");
                var variants = await db.Set<GuidanceTemplate>().Where(t => t.Key == selected!.Key && t.Published).OrderByDescending(t => t.Revision).ToListAsync();
                var template = variants.FirstOrDefault(t => t.Language == r.Patient.Language) ?? variants.FirstOrDefault(t => t.Language == "en") ?? variants.FirstOrDefault(t => t.Language == "vi") ?? selected!;
                r.Messages.Add(new ReceptionMessage { TemplateId = template.Id, Text = template.Text, Language = template.Language, ActorId = u.Id }); r.Status = "NeedsInformation";
                bus.Notify(r.PatientId, null, "receptionMessage"); bus.Audit(u.Id, "ReceptionMessage", detail: r.Id.ToString()); return new { r.Id };
            });
        });
        g.MapPost("/requests/{id:guid}/confirm", async (Guid id, ConfirmInput input, Access access, HospitalDb db, CommandBus bus, QrService qr, Workflow workflow) => {
            var u = await access.Staff("Reception"); return await bus.Run($"{u.Id}:confirm:{id}", input, async () => {
                var r = await access.Request(id);
                var existing = await db.Set<ReceptionRecord>().SingleOrDefaultAsync(rec => rec.RegistrationRequestId == id);
                if (existing is not null) return new { visitId = await db.Visits.Where(v => v.ReceptionRecordId == existing.Id).Select(v => v.Id).SingleAsync() };
                Check.Version(r, input.Version); Check.That(r.Status == "Submitted", "notReady", "Resolve missing information before confirming reception.", 409);
                Check.That(input.AttendeeVerified, "verificationRequired", "Verify the attendee before ticket issuance.");
                Access.Scope(u, input.DepartmentId);
                Check.That(await db.Set<Department>().AnyAsync(d => d.Id == input.DepartmentId && d.Active), "departmentInvalid", "Select an active department.");
                var loc = await db.Set<Location>().SingleOrDefaultAsync(l => l.Id == input.LocationId && l.DepartmentId == input.DepartmentId && l.Active);
                Check.That(loc is not null, "destinationInvalid", "Select an active destination in this department.");
                var doctor = await db.Users.Include(x => x.Scopes).SingleOrDefaultAsync(x => x.Id == input.DoctorId && x.Role == "Doctor" && x.Active);
                Check.That(doctor is not null && doctor.Scopes.Any(sc => sc.DepartmentId == input.DepartmentId), "doctorInvalid", "Choose an assigned doctor.");
                if (r.Appointment is not null) Check.That(r.Appointment.PatientId == r.PatientId && r.Appointment.Status == "Confirmed", "bookingInvalid", "Booking is no longer valid.");
                var rec = new ReceptionRecord { RegistrationRequestId = r.Id, PatientId = r.PatientId, ConfirmedBy = u.Id, VerificationNote = Check.Text(input.VerificationNote, "verificationNote", 3, 500) };
                var profile = HospitalCatalog.Clinician(input.DoctorId);
                Check.That(profile is null || profile.ClinicIds.Contains(input.LocationId), "doctorInvalid", "This doctor is not listed for the selected clinic in the imported directory.");
                var v = new Visit { PatientId = r.PatientId, ReceptionRecordId = rec.Id, AppointmentId = r.AppointmentId, DepartmentId = input.DepartmentId, DoctorId = input.DoctorId };
                v.Journey = new PatientJourney { VisitId = v.Id }; v.Ticket = new ExaminationTicket { VisitId = v.Id, Number = "H-" + v.Id.ToString("N")[..8].ToUpperInvariant() };
                var consult = workflow.MakeStep(v.Journey, loc!, "Consultation", "Doctor", "consultation", 10); consult.QueueNumber = v.Ticket.Number;
                var cashier = await workflow.DefaultDestination("CASHIER");
                var settlement = workflow.MakeStep(v.Journey, cashier, "Settlement", "Cashier", "settlement", 9000); Workflow.Depends(settlement, consult);
                r.Status = "Confirmed"; r.DepartmentId = input.DepartmentId;
                db.AddRange(rec, v); qr.Create("Ticket", v.Ticket.Id);
                var originalSession = await db.Sessions.SingleAsync(s => s.Id == r.SessionId);
                if (originalSession.IsGuest) db.Add(new AccessGrant { SessionId = originalSession.Id, VisitId = v.Id, ExpiresAt = originalSession.ExpiresAt });
                workflow.Evaluate(v); bus.Audit(u.Id, "ReceptionConfirmed", v.Id); bus.Notify(v.PatientId, v.Id, "ticketIssued");
                return new { visitId = v.Id };
            });
        });
        g.MapGet("/visits/{id:guid}/ticket", async (Guid id, Access access, QrService qr, HospitalDb db) => {
            var v = await access.Visit(id); var s = await access.Current();
            Check.That(s.PatientId is not null || s.UserAccount?.Role == "Reception", "forbidden", "Ticket access requires patient or reception authority.", 403);
            var doctor = await db.Users.FindAsync(v.DoctorId);
            var department = await db.Set<Department>().FindAsync(v.DepartmentId);
            var code = await qr.Current("Ticket", v.Ticket.Id); return new { doctorName = doctor?.Name, departmentNameVi = department?.NameVi, departmentNameEn = department?.NameEn, v.Ticket.Id, v.Ticket.Number, visitId = v.Id, journeyId = v.Journey.Id, code = qr.Reveal(code), code.ExpiresAt };
        });
        g.MapPost("/tickets/redeem", async (CodeInput input, Access access, HospitalDb db, QrService qr, CommandBus bus) => {
            var s = await access.Patient(); return await bus.Run($"{s.Id}:redeem", input, async () => {
                var code = await qr.Validate(input.Code, "Ticket");
                var ticket = await db.Set<ExaminationTicket>().SingleAsync(t => t.Id == code.ExaminationTicketId);
                var v = await access.Visit(ticket.VisitId);
                if (v.Journey.Status == "PendingActivation") { v.Journey.Status = "Active"; v.Journey.ActivatedAt = DateTime.UtcNow; }
                bus.Audit(s.Id, "TicketRedeemed", v.Id, source: "Patient"); return new { visitId = v.Id, journeyId = v.Journey.Id };
            });
        });
        g.MapPost("/visits/{id:guid}/reissue", async (Guid id, RecoveryIssue input, Access access, QrService qr, CommandBus bus) => {
            var u = await access.Staff("Reception"); return await bus.Run($"{u.Id}:reissue:{id}", input, async () => {
                var v = await access.Visit(id); VerifyAttendee(input); await qr.Replace("Ticket", v.Ticket.Id); bus.Audit(u.Id, "TicketReissued", id, input.VerificationNote); return new { visitId = id };
            });
        });
        g.MapPost("/visits/{id:guid}/recovery", async (Guid id, RecoveryIssue input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Reception"); return await bus.Run($"{u.Id}:recovery:{id}", input, async () => {
                var v = await access.Visit(id); VerifyAttendee(input);
                Check.That(!await db.Users.AnyAsync(a => a.PatientId == v.PatientId), "signInRequired", "Patient has an account; use sign-in recovery.", 409);
                var token = Crypto.Token(); db.Add(new RecoveryClaim { PatientId = v.PatientId, VisitId = id, Hash = Crypto.Hash(token), ExpiresAt = DateTime.UtcNow.AddMinutes(10) });
                bus.Audit(u.Id, "VerifiedRecoveryIssued", id, input.VerificationNote); return new { recoveryCode = token };
            }, false);
        });
        MapAppointments(g);
    }
    static void VerifyAttendee(RecoveryIssue input) { Check.That(input.AttendeeVerified, "verificationRequired", "Verify the attendee first."); Check.Text(input.VerificationNote, "verificationNote", 3, 500); }
    static async Task Apply(RequestInput input, RegistrationRequest r, HospitalDb db)
    {
        r.Name = Check.Text(input.Name, "name", 2, 120); r.Contact = Check.Text(input.Contact, "contact", 5, 80);
        r.Description = Check.Text(input.Description, "description", 0); r.Requests = Check.Text(input.Requests, "requests", 0);
        Check.That(await db.Set<Department>().AnyAsync(d => d.Id == input.DepartmentId && d.Active && d.Code == "CONSULT"), "departmentInvalid", "Use the configured reception department; staff will confirm routing."); r.DepartmentId = input.DepartmentId;
    }
    static void MapAppointments(RouteGroupBuilder g)
    {
        g.MapPost("/external/link", async (VerifyInput input, Access access, HospitalDb db, CommandBus bus, IIdentityAdapter provider, CancellationToken ct) => {
            var s = await access.Patient(); Check.That(!s.IsGuest, "accountRequired", "Sign in to link an external account.");
            var verified = await provider.Verify(input.Reference, input.Proof, ct);
            return await bus.Run($"{s.Id}:external", input, async () => {
                var old = await db.Set<ExternalIdentity>().SingleOrDefaultAsync(e => e.Provider == verified.Provider && e.Reference == verified.Reference);
                Check.That(old is null || old.PatientId == s.PatientId, "identityConflict", "External identity belongs to another patient. Staff resolution required.", 409);
                if (old is null) db.Add(new ExternalIdentity { PatientId = s.PatientId!.Value, Provider = verified.Provider, Reference = verified.Reference }); return new { linked = true, verified.Provider };
            });
        });
        g.MapGet("/appointments", async (Access access, HospitalDb db, IAppointmentAdapter provider, CancellationToken ct) => {
            var s = await access.Patient(); Check.That(!s.IsGuest, "accountRequired", "Sign in to retrieve linked appointments.");
            var links = await db.Set<ExternalIdentity>().Where(e => e.PatientId == s.PatientId).ToListAsync(); var result = new List<Booking>();
            foreach (var link in links) result.AddRange(await provider.List(link.Reference, ct)); return result;
        });
        g.MapPost("/appointments/prepare", async (BookingInput input, Access access, HospitalDb db, CommandBus bus, QrService qr, IAppointmentAdapter provider, CancellationToken ct) => {
            var s = await access.Patient(); Check.That(!s.IsGuest, "accountRequired", "Guests can ask reception to verify a booking reference.");
            var booking = await provider.Lookup(input.Reference, ct);
            Check.That(await db.Set<ExternalIdentity>().AnyAsync(e => e.PatientId == s.PatientId && e.Reference == booking.IdentityReference && e.Provider == "Simulation"), "bookingMismatch", "Booking does not match your verified identity.", 403);
            return await bus.Run($"{s.Id}:prepareBooking", input, () => PrepareBooking(db, qr, s, booking));
        });
        g.MapPost("/requests/{id:guid}/verify-booking", async (Guid id, BookingInput input, Access access, HospitalDb db, CommandBus bus, IAppointmentAdapter provider, CancellationToken ct) => {
            var u = await access.Staff("Reception"); VerifyAttendee(new(input.AttendeeVerified, input.VerificationNote)); var booking = await provider.Lookup(input.Reference, ct);
            return await bus.Run($"{u.Id}:verifyBooking:{id}", input, async () => {
                var r = await access.Request(id); Check.That(r.Status != "Confirmed" && r.Status != "Withdrawn", "requestLocked", "Request is closed.", 409);
                var old = await db.Set<Appointment>().SingleOrDefaultAsync(a => a.Reference == booking.Reference && a.Provider == "Simulation");
                Check.That(old is null || old.PatientId == r.PatientId, "bookingMismatch", "Booking already belongs to another patient.", 409);
                var linked = await db.Set<ExternalIdentity>().SingleOrDefaultAsync(e => e.Reference == booking.IdentityReference && e.Provider == "Simulation");
                Check.That(linked is null || linked.PatientId == r.PatientId, "bookingMismatch", "External identity mismatch requires resolution.", 409);
                var a = old ?? new Appointment { PatientId = r.PatientId, Reference = booking.Reference, ScheduledAt = booking.ScheduledAt, DepartmentId = r.DepartmentId };
                if (old is null) db.Add(a);
                Check.That(!await db.Requests.AnyAsync(x => x.Id != id && x.AppointmentId == a.Id), "bookingUsed", "Resume the existing reception for this booking.", 409);
                r.AppointmentId = a.Id; bus.Audit(u.Id, "BookingVerified", detail: input.VerificationNote); return new { r.Id };
            });
        });
    }
    static async Task<object> PrepareBooking(HospitalDb db, QrService qr, Session s, Booking b)
    {
        Check.That(b.Status == "Confirmed", "bookingInvalid", "Booking is not confirmed.");
        var dep = await db.Set<Department>().SingleAsync(d => d.Code == b.DepartmentCode);
        var a = await db.Set<Appointment>().SingleOrDefaultAsync(a => a.Provider == "Simulation" && a.Reference == b.Reference);
        if (a is null) { a = new Appointment { PatientId = s.PatientId!.Value, Reference = b.Reference, ScheduledAt = b.ScheduledAt, DepartmentId = dep.Id }; db.Add(a); }
        Check.That(a.PatientId == s.PatientId, "bookingMismatch", "Booking identity mismatch.", 403);
        var existing = await db.Requests.SingleOrDefaultAsync(r => r.AppointmentId == a.Id); if (existing is not null) return new { existing.Id };
        var p = await db.Patients.SingleAsync(p => p.Id == s.PatientId);
        Check.Text(p.Name, "name", 2, 120); Check.Text(p.Contact, "contact", 5, 80);
        var r = new RegistrationRequest { PatientId = p.Id, SessionId = s.Id, AppointmentId = a.Id, Name = p.Name, Contact = p.Contact, DepartmentId = dep.Id };
        db.Add(r); qr.Create("Reception", r.Id); return new { r.Id };
    }
}
