using System.Security.Claims;
using HospitalVisitApi.Data;
using HospitalVisitApi.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalVisitApi.Services;

public static class AdditionalEndpoints
{
    public static void MapAdditionalEndpoints(this RouteGroupBuilder routes)
    {
        static Guid Caller(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
        routes.MapPost("/api/reception/requests/{id:guid}/booking", async (Guid id, BookingVerificationDto dto, ClaimsPrincipal user, AppDbContext db, IVisitService service) =>
        {
            var request = await db.RegistrationRequests.FindAsync(id) ?? throw new KeyNotFoundException();
            var staff = await db.Users.FindAsync(Caller(user));
            if (staff == null || !AccessPolicy.InScope(staff, request.DepartmentId ?? SeedData.DeptGeneral)) return Results.Forbid();
            if (!dto.AttendeeVerified || request.Status == RegistrationRequestStatus.Confirmed) throw new ArgumentException("Verify the attendee before ticket issuance");
            var appointment = await service.LookupAppointmentAsync(dto.Reference) ?? throw new KeyNotFoundException("Booking not found");
            request.AppointmentId = appointment.AppointmentId; request.Source = RegistrationSource.Booked; request.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(); return Results.Ok(request);
        });
        routes.MapGet("/api/patient/follow-up/{visitId:guid}/booking", (Guid visitId, IConfiguration config) =>
        {
            var target = config["Booking:HandoffUrl"];
            var available = Uri.TryCreate(target, UriKind.Absolute, out var url) && url.Scheme == "https" && string.IsNullOrEmpty(url.UserInfo);
            return Results.Ok(new { available, url = available ? target : null });
        });

        routes.MapGet("/api/patient/assistance", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var id = Caller(user);
            Guid.TryParse(user.FindFirstValue("guestSessionId"), out var guestId);
            return Results.Ok(await db.AssistanceRequests.Where(a =>
                (id != Guid.Empty && a.Patient != null && a.Patient.UserId == id) ||
                (guestId != Guid.Empty && a.Patient != null && a.Patient.GuestSessionId == guestId && a.Patient.UserId == null))
                .OrderByDescending(a => a.CreatedAt).Select(a => new { a.Id, a.Category, a.Description, a.Status, a.Resolution, a.CreatedAt }).ToListAsync());
        });

        routes.MapPost("/api/auth/guest-continuation", async (ContinuationDto dto, ClaimsPrincipal user, AppDbContext db) =>
        {
            if (!Guid.TryParse(user.FindFirstValue("guestSessionId"), out var guestId)) return Results.Forbid();
            if (dto.ReturnTarget == null || !dto.ReturnTarget.StartsWith('/') || dto.ReturnTarget.StartsWith("//")) throw new ArgumentException("Local return target required");
            var context = new GuestConversionContext { GuestSessionId = guestId, ReturnTarget = dto.ReturnTarget,
                ContinuationToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)), ExpiresAt = DateTime.UtcNow.AddMinutes(30) };
            db.GuestConversionContexts.Add(context); await db.SaveChangesAsync();
            return Results.Ok(new { context.ContinuationToken, context.ReturnTarget, context.ExpiresAt });
        });

        routes.MapPost("/api/appointments/link", async (ExternalLinkDto dto, ClaimsPrincipal user, AppDbContext db) =>
        {
            var callerId = Caller(user);
            var patient = await db.Patients.FirstOrDefaultAsync(p => p.UserId == callerId);
            if (patient == null) return Results.Forbid();
            // Explicit external identity adapter fixture; never infer identity from a booking reference.
            if (dto.ExternalAccount != "demo-patient-001" || dto.Password != "AppointmentDemo@123")
                return Results.BadRequest(new { message = "External demo identity verification failed" });
            var existing = await db.ExternalIdentities.FirstOrDefaultAsync(i => i.Provider == "DemoAppointment" && i.Subject == dto.ExternalAccount);
            if (existing != null && existing.PatientId != patient.Id)
                return Results.Conflict(new { message = "External identity is already linked; reception verification required" });
            if (existing == null) db.ExternalIdentities.Add(new ExternalIdentity { PatientId = patient.Id, Subject = dto.ExternalAccount });
            await db.SaveChangesAsync();
            return Results.Ok(new { verified = true, provider = "Simulated appointment source" });
        });
        routes.MapGet("/api/appointments", async (ClaimsPrincipal user, AppDbContext db, IVisitService service) =>
        {
            var id = Caller(user);
            if (!await db.ExternalIdentities.AnyAsync(i => i.Patient.UserId == id)) return Results.Forbid();
            return Results.Ok(new[] { await service.LookupAppointmentAsync(SeedData.DemoAppointmentId) });
        });

        routes.MapGet("/api/admin/configuration/{kind}", async (string kind, AppDbContext db) =>
        {
            return kind switch {
                "departments" => Results.Ok(await db.Departments.ToListAsync()),
                "services" => Results.Ok(await db.HospitalServices.ToListAsync()),
                "mappings" => Results.Ok(await db.ServiceStepMappings.ToListAsync()),
                "templates" => Results.Ok(await db.GuidanceTemplates.ToListAsync()),
                "staff" => Results.Ok(await db.Users.Where(u => u.Role != UserRole.Patient).Select(u => new { u.Id, u.FullName, u.Role, u.StaffScope }).ToListAsync()),
                _ => Results.NotFound()
            };
        });

        routes.MapPut("/api/patient/profile", async (ProfileDto dto, ClaimsPrincipal user, AppDbContext db) =>
        {
            var account = await db.Users.FindAsync(Caller(user));
            if (account?.Role != UserRole.Patient) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(dto.FullName) || dto.FullName.Length > 100 || dto.PhoneNumber?.Length > 20) return Results.BadRequest();
            account.FullName = dto.FullName; account.PhoneNumber = dto.PhoneNumber; account.PreferredLanguage = dto.Language;
            var patient = await db.Patients.FirstAsync(p => p.UserId == account.Id);
            patient.FullName = dto.FullName; patient.PhoneNumber = dto.PhoneNumber; patient.PreferredLanguage = dto.Language;
            await db.SaveChangesAsync();
            return Results.Ok(new UserDto(account.Id, account.Email, account.FullName, account.Role.ToString(), account.PreferredLanguage, patient.Id, account.PhoneNumber));
        });

        routes.MapPut("/api/doctor/orders/{id:guid}", async (Guid id, OrderChangeDto dto, ClaimsPrincipal user, AppDbContext db) =>
        {
            var order = await db.DoctorOrders.Include(o => o.LinkedSteps).Include(o => o.Visit).ThenInclude(v => v.Journey).ThenInclude(j => j!.Steps)
                .FirstOrDefaultAsync(o => o.Id == id) ?? throw new KeyNotFoundException("Order not found");
            await AccessPolicy.CheckVisitAsync(db, order.VisitId, Caller(user), null);
            if (order.Visit.Status == VisitStatus.Closed) throw new InvalidOperationException("Closed visit");
            if (order.IsCancelled && dto.Cancel) return Results.Ok(new { order.Id, order.IsCancelled });
            if (order.LinkedSteps.Any(s => s.Status is StepStatus.InProgress or StepStatus.Completed))
                throw new InvalidOperationException("Started or completed services require staff resolution; recorded facts are preserved");
            if (dto.Cancel && string.IsNullOrWhiteSpace(dto.Reason)) throw new ArgumentException("Cancellation reason required");
            using var tx = await db.Database.BeginTransactionAsync();
            order.Notes = dto.Notes; order.IsRequired = dto.IsRequired; order.UpdatedAt = DateTime.UtcNow;
            if (dto.Cancel)
            {
                order.IsCancelled = true; order.CancellationReason = dto.Reason;
                foreach (var step in order.LinkedSteps) { step.Status = StepStatus.Cancelled; step.StatusReason = dto.Reason; step.CompletedByStaffId = Caller(user); step.UpdatedAt = DateTime.UtcNow; }
            }
            order.Visit.ClinicalReadiness = false; order.Visit.FinalSettlementConfirmed = false;
            foreach (var payment in await db.SettlementRecords.Where(s => s.VisitId == order.VisitId && s.Type != SettlementType.Intermediate).ToListAsync()) payment.IsCurrentlyValid = false;
            foreach (var review in order.Visit.Journey!.Steps.Where(s => s.StepType == StepType.ReturnConsultation && s.Status is StepStatus.Waiting or StepStatus.Ready))
                review.Status = order.Visit.Journey.Steps.Any(s => s.DoctorOrderId.HasValue && s.Status is not (StepStatus.Completed or StepStatus.Skipped or StepStatus.Cancelled)) ? StepStatus.Waiting : StepStatus.Ready;
            db.VisitEvents.Add(new VisitEvent { VisitId = order.VisitId, EventType = dto.Cancel ? "OrderCancelled" : "OrderUpdated", Source = "Doctor", ActorId = Caller(user), Details = dto.Reason ?? dto.Notes });
            await db.SaveChangesAsync(); await tx.CommitAsync();
            return Results.Ok(new { order.Id, order.IsCancelled });
        });

        routes.MapPost("/api/reception/reissue/{visitId:guid}", async (Guid visitId, RecoveryDto dto, AppDbContext db) =>
        {
            if (!dto.IdentityVerified) throw new ArgumentException("Reception must verify the attendee before reissue");
            var visit = await db.Visits.Include(v => v.Patient).FirstAsync(v => v.Id == visitId);
            if (dto.GuestSessionId.HasValue)
            {
                if (visit.UserId.HasValue) throw new InvalidOperationException("Account-owned visits require matching account sign-in");
                var guest = await db.GuestSessions.FindAsync(dto.GuestSessionId);
                if (guest == null || guest.IsConsumed || guest.ExpiresAt <= DateTime.UtcNow) throw new ArgumentException("A current guest context is required");
                if (await db.Patients.AnyAsync(p => p.GuestSessionId == guest.Id && p.Id != visit.PatientId)) throw new InvalidOperationException("Guest context already belongs to another patient");
                var previousGuest = visit.Patient.GuestSessionId;
                visit.Patient.GuestSessionId = guest.Id;
                foreach (var record in await db.Visits.Where(v => v.PatientId == visit.PatientId).ToListAsync()) record.GuestSessionId = guest.Id;
                foreach (var record in await db.RegistrationRequests.Where(r => r.PatientId == visit.PatientId).ToListAsync()) record.GuestSessionId = guest.Id;
                if (previousGuest.HasValue && await db.GuestSessions.FindAsync(previousGuest) is { } previous) previous.IsConsumed = true;
            }
            visit.TicketQrToken = $"TKT_{Guid.NewGuid():N}";
            db.VisitEvents.Add(new VisitEvent { VisitId = visit.Id, EventType = "TicketReissued", Source = "ReceptionDesk", Details = "Attendee verified; existing visit and journey retained" });
            await db.SaveChangesAsync();
            return Results.Ok(new { visit.Id, visit.TicketNumber, visit.TicketQrToken });
        });

        routes.MapPut("/api/admin/departments/{id:guid}", async (Guid id, DepartmentDto dto, AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.NameVi) || string.IsNullOrWhiteSpace(dto.NameEn)) throw new ArgumentException("Both department names required");
            var item = await db.Departments.FindAsync(id);
            if (item == null) { item = new Department { Id = id }; db.Departments.Add(item); }
            item.NameVi = dto.NameVi; item.NameEn = dto.NameEn; item.Floor = dto.Floor; item.Room = dto.Room; item.Building = dto.Building; item.IsActive = dto.IsActive;
            await db.SaveChangesAsync(); return Results.Ok(item);
        });
        routes.MapPut("/api/admin/services/{id:guid}", async (Guid id, ServiceDto dto, AppDbContext db) =>
        {
            if (!await db.Departments.AnyAsync(d => d.Id == dto.DepartmentId && d.IsActive) || string.IsNullOrWhiteSpace(dto.NameVi) || string.IsNullOrWhiteSpace(dto.NameEn) || !Enum.IsDefined(dto.StepType))
                throw new ArgumentException("Names, valid step type and active department required");
            var item = await db.HospitalServices.FindAsync(id);
            if (item == null) { item = new HospitalService { Id = id }; db.HospitalServices.Add(item); }
            item.NameVi = dto.NameVi; item.NameEn = dto.NameEn; item.DepartmentId = dto.DepartmentId; item.StepType = dto.StepType; item.IsActive = dto.IsActive;
            await db.SaveChangesAsync(); return Results.Ok(item);
        });
        routes.MapPut("/api/admin/templates/{id:guid}", async (Guid id, TemplateDto dto, AppDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(dto.TemplateKey) || string.IsNullOrWhiteSpace(dto.ContentVi) || string.IsNullOrWhiteSpace(dto.ContentEn)) throw new ArgumentException("Template key and approved language texts required");
            var item = await db.GuidanceTemplates.FindAsync(id);
            if (item == null) { item = new GuidanceTemplate { Id = id }; db.GuidanceTemplates.Add(item); }
            item.TemplateKey = dto.TemplateKey; item.ContentVi = dto.ContentVi; item.ContentEn = dto.ContentEn;
            item.Status = dto.Publish ? ContentStatus.Published : ContentStatus.Draft; item.Version++;
            if (dto.Publish) item.PublishedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(); return Results.Ok(item);
        });
        routes.MapGet("/api/admin/staff", async (AppDbContext db) => Results.Ok(await db.Users.Where(u => u.Role != UserRole.Patient)
            .Select(u => new { u.Id, u.FullName, u.Email, u.Role, u.StaffScope }).ToListAsync()));
        routes.MapPut("/api/admin/staff/{id:guid}", async (Guid id, StaffPermissionDto dto, ClaimsPrincipal user, AppDbContext db) =>
        {
            if (id == Caller(user)) throw new InvalidOperationException("Use another administrator to change your permissions");
            var staff = await db.Users.FindAsync(id);
            if (staff == null || staff.Role == UserRole.Patient || dto.Role == UserRole.Patient || !Enum.IsDefined(dto.Role)) throw new ArgumentException("Existing staff and valid staff role required");
            foreach (var scope in (dto.StaffScope ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                if (!Guid.TryParse(scope, out var department) || !await db.Departments.AnyAsync(d => d.Id == department)) throw new ArgumentException("Unknown department scope");
            staff.Role = dto.Role; staff.StaffScope = dto.StaffScope;
            await db.SaveChangesAsync(); return Results.Ok(new { staff.Id, staff.Role, staff.StaffScope });
        });
    }
}

public record ProfileDto(string FullName, string? PhoneNumber, string Language);
public record OrderChangeDto(bool Cancel, string? Reason, string? Notes, bool IsRequired = true);
public record RecoveryDto(bool IdentityVerified, Guid? GuestSessionId);
public record DepartmentDto(string NameVi, string NameEn, string? Floor, string? Room, string? Building, bool IsActive = true);
public record ServiceDto(string NameVi, string NameEn, Guid DepartmentId, StepType StepType, bool IsActive = true);
public record TemplateDto(string TemplateKey, string ContentVi, string ContentEn, bool Publish);
public record StaffPermissionDto(UserRole Role, string? StaffScope);
public record ExternalLinkDto(string ExternalAccount, string Password);
public record ContinuationDto(string? ReturnTarget);
public record BookingVerificationDto(string Reference, bool AttendeeVerified);
