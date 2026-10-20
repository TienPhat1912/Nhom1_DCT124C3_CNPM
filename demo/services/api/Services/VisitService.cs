using System.Text.Json;
using HospitalVisitApi.Data;
using HospitalVisitApi.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalVisitApi.Services;

public interface IVisitService
{
    // External adapter simulation
    Task<AppointmentLookupDto?> LookupAppointmentAsync(string appointmentId);

    // Registration (Booked & Walk-in)
    Task<RegistrationResponseDto> CreateRegistrationRequestAsync(CreateRegistrationRequestDto dto, Guid? userId, Guid? guestSessionId);
    Task<RegistrationRequest?> GetRegistrationRequestByIdAsync(Guid requestId);
    Task<RegistrationRequest?> GetRegistrationRequestByQrAsync(string qrToken);
    Task<bool> RequestSupplementAsync(Guid requestId, string question, Guid staffId);
    Task<bool> ProvideSupplementAsync(Guid requestId, string answer, Guid? userId, Guid? guestSessionId);

    // Reception & Ticket Issuance (Single transaction, idempotent)
    Task<ReceptionConfirmationResponseDto> ConfirmReceptionAsync(ConfirmReceptionDto dto, Guid staffId);
    Task<ReprintTicketResponseDto> GetTicketForReprintAsync(Guid visitId);

    // Ticket QR Redemption & Journey Activation
    Task<JourneyResponseDto> RedeemTicketQrAsync(string qrToken, Guid? userId, Guid? guestSessionId);
    Task<JourneyResponseDto> GetCurrentJourneyAsync(Guid visitId, Guid? userId, Guid? guestSessionId);

    // Doctor Orders & Consultation
    Task<DoctorOrderResponseDto> CreateDoctorOrderAsync(CreateDoctorOrderDto dto, Guid doctorId);
    Task<List<DoctorOrder>> GetDoctorOrdersForVisitAsync(Guid visitId);
    Task<bool> UpdateStepStatusAsync(Guid stepId, StepStatus newStatus, Guid staffId, string? reason);

    // Settlement & Closure
    Task<SettlementResponseDto> RecordSettlementAsync(RecordSettlementDto dto, Guid staffId);

    // Pharmacy Completion
    Task<bool> CompletePharmacyGuidanceAsync(Guid visitId, Guid? userId, Guid? guestSessionId);

    // Clinical Content: Diagnosis & Care Instructions
    Task<DiagnosisSummary> SaveDiagnosisDraftAsync(SaveDiagnosisDto dto, Guid doctorId);
    Task<DiagnosisSummary> PublishDiagnosisAsync(Guid diagnosisId, Guid doctorId);
    Task<DiagnosisSummaryDto?> GetPublishedDiagnosisForPatientAsync(Guid visitId, Guid? userId, Guid? guestSessionId, string language = "vi");
    Task<DiagnosisSummary?> GetDiagnosisForDoctorAsync(Guid visitId, Guid doctorId);

    // Follow-up
    Task<FollowUpRecommendation> SaveFollowUpAsync(SaveFollowUpDto dto, Guid doctorId);
    Task<FollowUpRecommendation?> GetFollowUpForVisitAsync(Guid visitId);

    // Assistance
    Task<AssistanceRequest> CreateAssistanceRequestAsync(CreateAssistanceDto dto, Guid? userId, Guid? guestSessionId);
    Task<List<AssistanceRequest>> GetAssistanceRequestsAsync(string? staffScope);
    Task<bool> UpdateAssistanceStatusAsync(Guid assistanceId, AssistanceStatus status, string? resolution, Guid staffId);

    // Notifications
    Task<List<AppNotification>> GetNotificationsAsync(Guid? userId, Guid? guestSessionId);

    // Admin & Workspaces
    Task<List<VisitSummaryDto>> GetVisitsForStaffAsync(UserRole role, Guid staffId, string? staffScope);
    Task<List<Department>> GetDepartmentsAsync();
    Task<List<HospitalService>> GetServicesAsync();
    Task<List<ServiceStepMapping>> GetMappingsAsync();
    Task<List<GuidanceTemplate>> GetTemplatesAsync();
    Task<ServiceStepMapping> SaveMappingAsync(ServiceStepMapping mapping);
}

// === DTOs ===
public record AppointmentLookupDto(string AppointmentId, string PatientName, string PhoneNumber, Guid DepartmentId, string DepartmentNameVi, string DepartmentNameEn, DateTime ScheduledAt, string Notes);
public record CreateRegistrationRequestDto(RegistrationSource Source, string? AppointmentId, Guid? DepartmentId, string? ConditionDescription, string? FullName, string? PhoneNumber, string PreferredLanguage = "vi");
public record RegistrationResponseDto(Guid RequestId, RegistrationSource Source, RegistrationRequestStatus Status, string ReceptionQrToken, string? StaffQuestion, DateTime CreatedAt);
public record ConfirmReceptionDto(Guid RegistrationRequestId, Guid DepartmentId, Guid? AssignedDoctorId, bool RequiresPharmacy = true, string? Notes = null);
public record ReceptionConfirmationResponseDto(Guid VisitId, Guid JourneyId, string TicketNumber, string TicketQrToken, VisitStatus VisitStatus, JourneyStatus JourneyStatus, string AssignedDepartmentVi, string AssignedDepartmentEn, DateTime ConfirmedAt);
public record ReprintTicketResponseDto(Guid VisitId, string TicketNumber, string TicketQrToken, string PatientName, string DepartmentVi, string DepartmentEn, string? DoctorName, DateTime ConfirmedAt);

public record JourneyStepDto(Guid Id, StepType StepType, StepStatus Status, int SortOrder, string? DestinationVi, string? DestinationEn, string? InstructionVi, string? InstructionEn, string? QueueTicket, DateTime? QueueUpdatedAt, string? StatusReason);
public record JourneyResponseDto(Guid VisitId, VisitStatus VisitStatus, Guid JourneyId, JourneyStatus JourneyStatus, JourneyStepDto? CurrentStep, string NextActionVi, string NextActionEn, string DestinationVi, string DestinationEn, string WaitOrProceed, string? QueueTicket, DateTime? QueueUpdatedAt, List<string> AllowedActions, List<JourneyStepDto> Steps, bool RequiresPharmacy, bool CanCompletePharmacy);

public record CreateDoctorOrderDto(Guid VisitId, Guid ServiceId, bool IsRequired = true, string? Notes = null, string? IdempotencyKey = null);
public record DoctorOrderResponseDto(Guid OrderId, Guid VisitId, Guid ServiceId, string ServiceNameVi, string ServiceNameEn, bool IsRequired, List<JourneyStepDto> CreatedSteps);

public record RecordSettlementDto(Guid VisitId, SettlementType Type, decimal? Amount, string IdempotencyKey, string? Notes);
public record SettlementResponseDto(Guid SettlementId, Guid VisitId, SettlementType Type, bool IsVisitClosed, VisitStatus VisitStatus, string Reason);

public record SaveDiagnosisDto(Guid? Id, Guid VisitId, string? DiagnosisVi, string? DiagnosisEn, string? ExplanationVi, string? ExplanationEn, string? CareInstructionsVi, string? CareInstructionsEn, bool EnTranslationApproved);
public record DiagnosisSummaryDto(Guid Id, Guid VisitId, int Version, string? Diagnosis, string? Explanation, string? CareInstructions, string Language, bool IsFallback, string DoctorName, DateTime PublishedAt);
public record SaveFollowUpDto(Guid VisitId, string? RecommendationVi, string? RecommendationEn, string? SuggestedTimeframe);

public record CreateAssistanceDto(Guid? VisitId, string Category, string? Description);
public record VisitSummaryDto(Guid VisitId, string TicketNumber, VisitStatus Status, string PatientName, string DepartmentVi, string DepartmentEn, string? DoctorName, int TotalSteps, int CompletedSteps, DateTime CreatedAt);

public class VisitService : IVisitService
{
    private readonly AppDbContext _db;

    public VisitService(AppDbContext db)
    {
        _db = db;
    }

    // === 1. External Appointment Lookup (Adapter Fixture) ===
    public Task<AppointmentLookupDto?> LookupAppointmentAsync(string appointmentId)
    {
        if (string.IsNullOrWhiteSpace(appointmentId))
            return Task.FromResult<AppointmentLookupDto?>(null);

        // Pre-configured fixture for demo appointment
        if (appointmentId.Equals(SeedData.DemoAppointmentId, StringComparison.OrdinalIgnoreCase) || appointmentId == "1234")
        {
            return Task.FromResult<AppointmentLookupDto?>(new AppointmentLookupDto(
                SeedData.DemoAppointmentId,
                "Lê Hoàng Long",
                "0912345678",
                SeedData.DeptCardiology,
                "Khoa Tim mạch",
                "Cardiology Department",
                DateTime.UtcNow.Date.AddHours(9),
                "Tái khám định kỳ tăng huyết áp"
            ));
        }

        return Task.FromResult<AppointmentLookupDto?>(null);
    }

    // === 2. Registration Request (Walk-in or Booked) - Does NOT create Visit (BR-02) ===
    public async Task<RegistrationResponseDto> CreateRegistrationRequestAsync(CreateRegistrationRequestDto dto, Guid? userId, Guid? guestSessionId)
    {
        if (!Enum.IsDefined(dto.Source) || string.IsNullOrWhiteSpace(dto.FullName) || string.IsNullOrWhiteSpace(dto.PhoneNumber))
            throw new ArgumentException("Name, phone and valid reception source are required");
        if (dto.Source == RegistrationSource.Booked && await LookupAppointmentAsync(dto.AppointmentId ?? "") == null)
            throw new ArgumentException("Booking reference could not be verified");
        // Find or create patient record
        Patient? patient = null;
        if (userId.HasValue)
        {
            patient = await _db.Patients.FirstOrDefaultAsync(p => p.UserId == userId.Value);
            if (patient == null)
            {
                var user = await _db.Users.FindAsync(userId.Value);
                patient = new Patient
                {
                    UserId = userId.Value,
                    FullName = dto.FullName ?? user?.FullName ?? "Bệnh nhân",
                    PhoneNumber = dto.PhoneNumber ?? user?.PhoneNumber,
                    PreferredLanguage = dto.PreferredLanguage
                };
                _db.Patients.Add(patient);
                await _db.SaveChangesAsync();
            }
        }
        else if (guestSessionId.HasValue)
        {
            patient = await _db.Patients.FirstOrDefaultAsync(p => p.GuestSessionId == guestSessionId.Value);
            if (patient == null)
            {
                patient = new Patient
                {
                    GuestSessionId = guestSessionId.Value,
                    FullName = dto.FullName ?? "Khách vãng lai",
                    PhoneNumber = dto.PhoneNumber,
                    PreferredLanguage = dto.PreferredLanguage
                };
                _db.Patients.Add(patient);
                await _db.SaveChangesAsync();
            }
        }
        else throw new UnauthorizedAccessException("Sign in or establish a guest session first");
        if (!string.IsNullOrWhiteSpace(dto.FullName)) patient.FullName = dto.FullName.Trim();
        patient.PhoneNumber = dto.PhoneNumber;
        patient.PreferredLanguage = dto.PreferredLanguage;
        // Retry of the current unconfirmed preparation reuses the persisted request.
        var pending = await _db.RegistrationRequests.FirstOrDefaultAsync(r => r.PatientId == patient.Id &&
            r.Status != RegistrationRequestStatus.Confirmed && r.Status != RegistrationRequestStatus.Rejected &&
            r.Source == dto.Source && r.AppointmentId == dto.AppointmentId);
        if (pending != null)
            return new RegistrationResponseDto(pending.Id, pending.Source, pending.Status, pending.ReceptionQrToken, pending.StaffQuestion, pending.CreatedAt);

        var qrToken = $"REC_{Guid.NewGuid():N}";
        var req = new RegistrationRequest
        {
            PatientId = patient.Id,
            GuestSessionId = guestSessionId,
            Source = dto.Source,
            AppointmentId = dto.AppointmentId,
            DepartmentId = dto.DepartmentId ?? SeedData.DeptGeneral,
            ConditionDescription = dto.ConditionDescription,
            ReceptionQrToken = qrToken,
            Status = RegistrationRequestStatus.Pending
        };

        _db.RegistrationRequests.Add(req);
        await _db.SaveChangesAsync();

        return new RegistrationResponseDto(req.Id, req.Source, req.Status, req.ReceptionQrToken, req.StaffQuestion, req.CreatedAt);
    }

    public async Task<RegistrationRequest?> GetRegistrationRequestByIdAsync(Guid requestId) =>
        await _db.RegistrationRequests
            .Include(r => r.Patient)
            .Include(r => r.Department)
            .FirstOrDefaultAsync(r => r.Id == requestId);

    public async Task<RegistrationRequest?> GetRegistrationRequestByQrAsync(string qrToken) =>
        await _db.RegistrationRequests
            .Include(r => r.Patient)
            .Include(r => r.Department)
            .FirstOrDefaultAsync(r => r.ReceptionQrToken == qrToken);

    public async Task<bool> RequestSupplementAsync(Guid requestId, string question, Guid staffId)
    {
        var req = await _db.RegistrationRequests.FindAsync(requestId);
        if (req == null || req.Status == RegistrationRequestStatus.Confirmed) return false;

        var template = await _db.GuidanceTemplates.FirstOrDefaultAsync(t => t.Status == ContentStatus.Published && (t.ContentVi == question || t.ContentEn == question));
        if (template == null) throw new ArgumentException("Select an approved reception communication template");
        var patient = await _db.Patients.FindAsync(req.PatientId);
        req.StaffQuestion = patient?.PreferredLanguage == "en" ? template.ContentEn : template.ContentVi;
        req.Status = RegistrationRequestStatus.SupplementRequested;
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ProvideSupplementAsync(Guid requestId, string answer, Guid? userId, Guid? guestSessionId)
    {
        var req = await _db.RegistrationRequests.FindAsync(requestId);
        if (req == null || req.Status != RegistrationRequestStatus.SupplementRequested) return false;
        var owner = await _db.Patients.FindAsync(req.PatientId);
        if (!(userId.HasValue && owner?.UserId == userId) && !(guestSessionId.HasValue && req.GuestSessionId == guestSessionId)) throw new UnauthorizedAccessException();
        if (string.IsNullOrWhiteSpace(answer)) throw new ArgumentException("Supplement response required");

        req.SupplementInfo = answer;
        req.Status = RegistrationRequestStatus.SupplementProvided;
        req.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    // === 3. Reception Confirmation (Single Transaction, Idempotent, BR-02, BR-03) ===
    public async Task<ReceptionConfirmationResponseDto> ConfirmReceptionAsync(ConfirmReceptionDto dto, Guid staffId)
    {
        var req = await _db.RegistrationRequests
            .Include(r => r.Patient)
            .FirstOrDefaultAsync(r => r.Id == dto.RegistrationRequestId);

        if (req == null)
            throw new InvalidOperationException("Registration request not found");

        // Idempotency: if already confirmed, return existing Visit & Ticket
        var existingVisit = await _db.Visits
            .Include(v => v.Journey)
            .Include(v => v.Department)
            .FirstOrDefaultAsync(v => v.RegistrationRequestId == req.Id);

        if (existingVisit != null)
        {
            return new ReceptionConfirmationResponseDto(
                existingVisit.Id,
                existingVisit.Journey!.Id,
                existingVisit.TicketNumber,
                existingVisit.TicketQrToken,
                existingVisit.Status,
                existingVisit.Journey.Status,
                existingVisit.Department.NameVi,
                existingVisit.Department.NameEn,
                existingVisit.CreatedAt
            );
        }

        if (req.Status is RegistrationRequestStatus.SupplementRequested or RegistrationRequestStatus.Rejected)
            throw new InvalidOperationException("Reception information is not ready for confirmation");
        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == dto.DepartmentId && d.IsActive)
            ?? throw new ArgumentException("Active department required");
        var doctorId = dto.AssignedDoctorId ?? SeedData.UserDoctor;
        var doctor = await _db.Users.FindAsync(doctorId);
        if (doctor?.Role != UserRole.Doctor || !AccessPolicy.InScope(doctor, dept.Id))
            throw new ArgumentException("Assigned doctor is outside the department scope");

        var ticketNumber = $"T-{Guid.NewGuid():N}";
        var ticketQr = $"TKT_{Guid.NewGuid():N}";

        using var tx = await _db.Database.BeginTransactionAsync();

        req.Status = RegistrationRequestStatus.Confirmed;
        req.UpdatedAt = DateTime.UtcNow;

        var visit = new Visit
        {
            PatientId = req.PatientId,
            UserId = req.Patient.UserId,
            GuestSessionId = req.GuestSessionId,
            RegistrationRequestId = req.Id,
            DepartmentId = dept.Id,
            AssignedDoctorId = doctorId,
            ConfirmedByStaffId = staffId,
            Status = VisitStatus.Active,
            TicketNumber = ticketNumber,
            TicketQrToken = ticketQr,
            RequiresPharmacy = dto.RequiresPharmacy,
            ClinicalReadiness = false,
            FinalSettlementConfirmed = false
        };
        _db.Visits.Add(visit);
        await _db.SaveChangesAsync();

        var journey = new Journey
        {
            VisitId = visit.Id,
            Status = JourneyStatus.PendingActivation // BR-04, BR-16
        };
        _db.Journeys.Add(journey);
        await _db.SaveChangesAsync();

        // Initial Consultation Step (Ready)
        var firstStep = new JourneyStep
        {
            JourneyId = journey.Id,
            StepType = StepType.Consultation,
            Status = StepStatus.Ready,
            SortOrder = 1,
            DestinationDepartmentId = dept.Id,
            DestinationVi = $"{dept.NameVi} - Tầng {dept.Floor}, Phòng {dept.Room}",
            DestinationEn = $"{dept.NameEn} - Floor {dept.Floor}, Room {dept.Room}",
            InstructionVi = "Vui lòng di chuyển đến phòng khám và chờ gọi tên",
            InstructionEn = "Please proceed to the consultation room and wait for your call",
            QueueTicket = ticketNumber,
            QueueUpdatedAt = DateTime.UtcNow
        };
        _db.JourneySteps.Add(firstStep);
        _db.JourneySteps.Add(new JourneyStep {
            JourneyId = journey.Id, StepType = StepType.Payment, Status = StepStatus.Waiting, SortOrder = 10000,
            DestinationDepartmentId = SeedData.DeptCashier, DestinationVi = "Quầy thu ngân - Tầng 1", DestinationEn = "Cashier - Floor 1",
            InstructionVi = "Đến quầy thu ngân hoàn tất thủ tục", InstructionEn = "Proceed to the cashier for settlement"
        });
        if (visit.RequiresPharmacy) _db.JourneySteps.Add(new JourneyStep {
            JourneyId = journey.Id, StepType = StepType.Pharmacy, Status = StepStatus.Waiting, SortOrder = 10001,
            DestinationDepartmentId = SeedData.DeptPharmacy, DestinationVi = "Nhà thuốc - Tầng 1", DestinationEn = "Pharmacy - Floor 1",
            InstructionVi = "Đến nhà thuốc nhận hướng dẫn", InstructionEn = "Proceed to the pharmacy for guidance"
        });

        _db.VisitEvents.Add(new VisitEvent
        {
            VisitId = visit.Id,
            EventType = "ReceptionConfirmed",
            Source = "ReceptionDesk",
            ActorId = staffId,
            Details = $"Confirmed ticket {ticketNumber} at {dept.NameVi}"
        });

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new ReceptionConfirmationResponseDto(
            visit.Id,
            journey.Id,
            visit.TicketNumber,
            visit.TicketQrToken,
            visit.Status,
            journey.Status,
            dept.NameVi,
            dept.NameEn,
            visit.CreatedAt
        );
    }

    public async Task<ReprintTicketResponseDto> GetTicketForReprintAsync(Guid visitId)
    {
        var visit = await _db.Visits
            .Include(v => v.Patient)
            .Include(v => v.Department)
            .Include(v => v.AssignedDoctor)
            .FirstOrDefaultAsync(v => v.Id == visitId);

        if (visit == null) throw new InvalidOperationException("Visit not found");

        return new ReprintTicketResponseDto(
            visit.Id,
            visit.TicketNumber,
            visit.TicketQrToken,
            visit.Patient.FullName,
            visit.Department.NameVi,
            visit.Department.NameEn,
            visit.AssignedDoctor?.FullName,
            visit.CreatedAt
        );
    }

    // === 4. Ticket QR Redemption & Journey Activation (BR-02, BR-16) ===
    public async Task<JourneyResponseDto> RedeemTicketQrAsync(string qrToken, Guid? userId, Guid? guestSessionId)
    {
        if (qrToken.StartsWith("REC_"))
            throw new InvalidOperationException("Invalid QR purpose: Reception QR cannot activate journey (Use staff scanning)");

        var visit = await _db.Visits
            .Include(v => v.Journey)
            .Include(v => v.Patient)
            .Include(v => v.Department)
            .FirstOrDefaultAsync(v => v.TicketQrToken == qrToken);

        if (visit == null)
            throw new InvalidOperationException("Invalid or expired examination ticket QR");

        await AccessPolicy.CheckVisitAsync(_db, visit.Id, userId, guestSessionId);
        var issuedAt = await _db.VisitEvents.Where(e => e.VisitId == visit.Id && e.EventType == "TicketReissued")
            .Select(e => (DateTime?)e.CreatedAt).MaxAsync() ?? visit.CreatedAt;
        if (issuedAt.AddDays(7) <= DateTime.UtcNow) throw new InvalidOperationException("Ticket access code expired; ask reception for verified reissue");

        var journey = visit.Journey ?? throw new InvalidOperationException("Journey not found");

        // Activate if PendingActivation (BR-16)
        if (journey.Status == JourneyStatus.PendingActivation)
        {
            journey.Status = JourneyStatus.Active;
            journey.ActivatedAt = DateTime.UtcNow;
            journey.UpdatedAt = DateTime.UtcNow;

            _db.VisitEvents.Add(new VisitEvent
            {
                VisitId = visit.Id,
                EventType = "JourneyActivated",
                Source = "PatientScan",
                Details = "Patient scanned examination ticket and activated journey"
            });

            await _db.SaveChangesAsync();
        }

        return await BuildJourneyResponseAsync(visit.Id);
    }

    public async Task<JourneyResponseDto> GetCurrentJourneyAsync(Guid visitId, Guid? userId, Guid? guestSessionId)
    {
        var visit = await _db.Visits.FindAsync(visitId);
        if (visit == null) throw new InvalidOperationException("Visit not found");

        await AccessPolicy.CheckVisitAsync(_db, visit.Id, userId, guestSessionId);

        return await BuildJourneyResponseAsync(visitId);
    }

    private async Task<JourneyResponseDto> BuildJourneyResponseAsync(Guid visitId)
    {
        var visit = await _db.Visits
            .Include(v => v.Department)
            .Include(v => v.Journey)
                .ThenInclude(j => j!.Steps.OrderBy(s => s.SortOrder))
            .FirstOrDefaultAsync(v => v.Id == visitId);

        if (visit == null || visit.Journey == null)
            throw new InvalidOperationException("Visit or journey record missing");

        var templates = await _db.GuidanceTemplates.Where(t => t.Status == ContentStatus.Published).ToListAsync();
        foreach (var step in visit.Journey.Steps.Where(s => s.Status is StepStatus.Ready or StepStatus.InProgress))
        {
            var key = step.StepType switch { StepType.Laboratory => "lab_instruction", StepType.Imaging => "imaging_instruction",
                StepType.ReturnConsultation => "return_consultation", StepType.Payment => "payment_instruction", StepType.Pharmacy => "pharmacy_instruction", _ => "" };
            var template = templates.Where(t => t.TemplateKey == key).OrderByDescending(t => t.Version).FirstOrDefault();
            if (template != null) { step.InstructionVi = template.ContentVi; step.InstructionEn = template.ContentEn; }
        }
        var steps = visit.Journey.Steps.Select(s => new JourneyStepDto(
            s.Id,
            s.StepType,
            s.Status,
            s.SortOrder,
            s.DestinationVi,
            s.DestinationEn,
            s.InstructionVi,
            s.InstructionEn,
            s.QueueTicket,
            s.QueueUpdatedAt,
            s.StatusReason
        )).ToList();

        // Find current step: first Ready or InProgress, or Waiting
        var current = visit.Journey.Steps
            .FirstOrDefault(s => s.Status == StepStatus.InProgress)
            ?? visit.Journey.Steps.FirstOrDefault(s => s.Status == StepStatus.Ready)
            ?? visit.Journey.Steps.FirstOrDefault(s => s.Status == StepStatus.Waiting);

        JourneyStepDto? currentDto = current != null ? new JourneyStepDto(
            current.Id,
            current.StepType,
            current.Status,
            current.SortOrder,
            current.DestinationVi,
            current.DestinationEn,
            current.InstructionVi,
            current.InstructionEn,
            current.QueueTicket,
            current.QueueUpdatedAt,
            current.StatusReason
        ) : null;

        var waitOrProceed = current?.Status == StepStatus.Ready || current?.Status == StepStatus.InProgress ? "Proceed" : "Wait";
        var nextActionVi = current?.InstructionVi ?? (visit.Status == VisitStatus.Closed ? "Lượt khám đã hoàn tất" : "Chờ hướng dẫn tiếp theo");
        var nextActionEn = current?.InstructionEn ?? (visit.Status == VisitStatus.Closed ? "Visit completed" : "Waiting for next instruction");
        var destVi = current?.DestinationVi ?? visit.Department.NameVi;
        var destEn = current?.DestinationEn ?? visit.Department.NameEn;

        var allowedActions = new List<string> { "Listen", "Navigate", "RequestAssistance" };

        // Can complete pharmacy? (BR-09, BR-11: Visit Closed, Journey Active, Pharmacy step present)
        var pharmacyStep = visit.Journey.Steps.FirstOrDefault(s => s.StepType == StepType.Pharmacy && s.Status != StepStatus.Completed);
        bool canCompletePharmacy = visit.Status == VisitStatus.Closed &&
                                   visit.Journey.Status == JourneyStatus.Active &&
                                   pharmacyStep != null;

        if (canCompletePharmacy)
        {
            allowedActions.Add("CompletePharmacy");
        }

        return new JourneyResponseDto(
            visit.Id,
            visit.Status,
            visit.Journey.Id,
            visit.Journey.Status,
            currentDto,
            nextActionVi,
            nextActionEn,
            destVi,
            destEn,
            waitOrProceed,
            current?.QueueTicket,
            current?.QueueUpdatedAt,
            allowedActions,
            steps,
            visit.RequiresPharmacy,
            canCompletePharmacy
        );
    }

    // === 5. Doctor Orders (UC-07, BR-06, BR-25) ===
    public async Task<DoctorOrderResponseDto> CreateDoctorOrderAsync(CreateDoctorOrderDto dto, Guid doctorId)
    {
        var visit = await _db.Visits
            .Include(v => v.Journey)
                .ThenInclude(j => j!.Steps)
            .FirstOrDefaultAsync(v => v.Id == dto.VisitId);

        if (visit == null) throw new InvalidOperationException("Visit not found");
        if (visit.Status == VisitStatus.Closed) throw new InvalidOperationException("Cannot add orders to a closed visit");

        await AccessPolicy.CheckVisitAsync(_db, visit.Id, doctorId, null);
        using var tx = await _db.Database.BeginTransactionAsync();
        var service = await _db.HospitalServices.FindAsync(dto.ServiceId);
        if (service == null || !service.IsActive) throw new InvalidOperationException("Active service not found");

        if (dto.IdempotencyKey != null)
        {
            var prior = await _db.VisitEvents.FirstOrDefaultAsync(e => e.Source == "DoctorOrder" && e.SourceEventId == dto.IdempotencyKey);
            if (prior != null)
            {
                if (prior.VisitId != dto.VisitId || !Guid.TryParse(prior.Details, out var priorId)) throw new InvalidOperationException("Order event key conflict");
                var previous = await _db.DoctorOrders.Include(o => o.LinkedSteps).FirstAsync(o => o.Id == priorId);
                if (previous.ServiceId != dto.ServiceId || previous.IsRequired != dto.IsRequired) throw new InvalidOperationException("Order retry differs from original request");
                return new DoctorOrderResponseDto(previous.Id, visit.Id, service.Id, service.NameVi, service.NameEn, previous.IsRequired,
                    previous.LinkedSteps.Select(step => new JourneyStepDto(step.Id, step.StepType, step.Status, step.SortOrder, step.DestinationVi, step.DestinationEn, step.InstructionVi, step.InstructionEn, step.QueueTicket, step.QueueUpdatedAt, step.StatusReason)).ToList());
            }
        }
        // Validate service-to-step mapping (BR-25: Missing mapping rejects order before commit)
        var mapping = await _db.ServiceStepMappings
            .FirstOrDefaultAsync(m => m.ServiceId == service.Id && m.IsActive);

        if (mapping == null)
            throw new InvalidOperationException($"Service '{service.NameVi}' has no validated step mapping. Order rejected per rule BR-25.");

        // New work invalidates settlement for the previous work set.
        visit.ClinicalReadiness = false;
        visit.FinalSettlementConfirmed = false;
        foreach (var settlement in await _db.SettlementRecords.Where(r => r.VisitId == visit.Id && r.Type != SettlementType.Intermediate).ToListAsync())
            settlement.IsCurrentlyValid = false;
        var payment = visit.Journey!.Steps.FirstOrDefault(s => s.StepType == StepType.Payment);
        if (payment != null && payment.Status == StepStatus.Completed) payment.SortOrder = 9999;
        if (payment?.Status == StepStatus.Completed) _db.JourneySteps.Add(new JourneyStep {
            JourneyId = visit.Journey.Id, StepType = StepType.Payment, Status = StepStatus.Waiting, SortOrder = 10000,
            DestinationVi = "Quầy thu ngân - Tầng 1", DestinationEn = "Cashier - Floor 1",
            InstructionVi = "Hoàn tất thủ tục cho chỉ định mới", InstructionEn = "Settle the updated work"
        });
        var prerequisiteServices = JsonSerializer.Deserialize<Guid[]>(mapping.PrerequisiteServiceIds ?? "[]") ?? [];
        var requiredSteps = new List<JourneyStep>();
        foreach (var prerequisite in prerequisiteServices)
        {
            var prerequisiteStep = prerequisite == SeedData.SvcConsultation ? visit.Journey!.Steps.FirstOrDefault(s => s.StepType == StepType.Consultation) :
                visit.Journey!.Steps.LastOrDefault(s => s.ServiceId == prerequisite);
            if (prerequisiteStep == null) throw new InvalidOperationException("Required prerequisite service has not been ordered");
            requiredSteps.Add(prerequisiteStep);
        }
        var order = new DoctorOrder
        {
            VisitId = visit.Id,
            DoctorId = doctorId,
            ServiceId = service.Id,
            IsRequired = dto.IsRequired,
            Notes = dto.Notes
        };
        _db.DoctorOrders.Add(order);
        await _db.SaveChangesAsync();

        var journey = visit.Journey!;
        int maxOrder = journey.Steps.Where(s => s.StepType != StepType.Payment && s.StepType != StepType.Pharmacy).Select(s => s.SortOrder).DefaultIfEmpty(1).Max();

        var createdSteps = new List<JourneyStepDto>();

        // Service step
        var serviceStep = new JourneyStep
        {
            JourneyId = journey.Id,
            DoctorOrderId = order.Id,
            PrerequisiteStepIds = JsonSerializer.Serialize(requiredSteps.Select(s => s.Id)),
            ServiceId = service.Id,
            DestinationDepartmentId = mapping.DestinationDepartmentId,
            StepType = mapping.StepType,
            Status = journey.Steps.Any(s => s.StepType == StepType.Consultation && !Resolved(s)) ? StepStatus.Waiting : StepStatus.Ready,
            SortOrder = maxOrder + 1,
            DestinationVi = mapping.DestinationVi ?? $"{service.NameVi}",
            DestinationEn = mapping.DestinationEn ?? $"{service.NameEn}",
            InstructionVi = $"Vui lòng đến {mapping.DestinationVi ?? service.NameVi} để thực hiện chỉ định",
            InstructionEn = $"Please proceed to {mapping.DestinationEn ?? service.NameEn} for your order",
            QueueTicket = $"{visit.TicketNumber}-S{maxOrder + 1}",
            QueueUpdatedAt = DateTime.UtcNow
        };
        _db.JourneySteps.Add(serviceStep);
        await _db.SaveChangesAsync();

        createdSteps.Add(new JourneyStepDto(
            serviceStep.Id, serviceStep.StepType, serviceStep.Status, serviceStep.SortOrder,
            serviceStep.DestinationVi, serviceStep.DestinationEn, serviceStep.InstructionVi,
            serviceStep.InstructionEn, serviceStep.QueueTicket, serviceStep.QueueUpdatedAt, null
        ));

        // Add Return Consultation if not already waiting/ready
        bool hasReturnConsult = journey.Steps.Any(s => s.StepType == StepType.ReturnConsultation && s.Status != StepStatus.Completed);
        if (!hasReturnConsult)
        {
            var returnDept = await _db.Departments.FindAsync(visit.DepartmentId);
            var returnStep = new JourneyStep
            {
                JourneyId = journey.Id,
                StepType = StepType.ReturnConsultation,
                Status = StepStatus.Waiting, // Waiting until service is completed
                SortOrder = maxOrder + 2,
                DestinationVi = $"{returnDept?.NameVi ?? "Phòng khám"} - Bác sĩ xem kết quả",
                DestinationEn = $"{returnDept?.NameEn ?? "Consultation Room"} - Doctor Review",
                InstructionVi = "Chờ hoàn thành cận lâm sàng trước khi quay lại gặp bác sĩ",
                InstructionEn = "Wait for test results before returning to doctor",
                QueueTicket = $"{visit.TicketNumber}-R",
                QueueUpdatedAt = DateTime.UtcNow
            };
            _db.JourneySteps.Add(returnStep);
            await _db.SaveChangesAsync();

            createdSteps.Add(new JourneyStepDto(
                returnStep.Id, returnStep.StepType, returnStep.Status, returnStep.SortOrder,
                returnStep.DestinationVi, returnStep.DestinationEn, returnStep.InstructionVi,
                returnStep.InstructionEn, returnStep.QueueTicket, returnStep.QueueUpdatedAt, null
            ));
        }

        // Add Payment step if not present
        bool hasPaymentStep = journey.Steps.Any(s => s.StepType == StepType.Payment && s.Status != StepStatus.Completed);
        if (!hasPaymentStep)
        {
            var paymentStep = new JourneyStep
            {
                JourneyId = journey.Id,
                StepType = StepType.Payment,
                Status = StepStatus.Waiting,
                SortOrder = maxOrder + 3,
                DestinationVi = "Quầy thu ngân - Tầng 1",
                DestinationEn = "Cashier Counter - Floor 1",
                InstructionVi = "Đến quầy thu ngân để hoàn tất thủ tục thanh toán",
                InstructionEn = "Proceed to cashier counter for payment settlement",
                QueueTicket = $"{visit.TicketNumber}-P",
                QueueUpdatedAt = DateTime.UtcNow
            };
            _db.JourneySteps.Add(paymentStep);
            await _db.SaveChangesAsync();
        }

        // Add Pharmacy step if visit requires pharmacy
        if (visit.RequiresPharmacy && !journey.Steps.Any(s => s.StepType == StepType.Pharmacy && s.Status != StepStatus.Completed))
        {
            var pharmacyStep = new JourneyStep
            {
                JourneyId = journey.Id,
                StepType = StepType.Pharmacy,
                Status = StepStatus.Waiting,
                SortOrder = maxOrder + 4,
                DestinationVi = "Nhà thuốc bệnh viện - Tầng 1",
                DestinationEn = "Hospital Pharmacy - Floor 1",
                InstructionVi = "Nhận thuốc và nghe hướng dẫn sử dụng thuốc",
                InstructionEn = "Collect medication and listen to usage guidance",
                QueueTicket = $"{visit.TicketNumber}-Rx",
                QueueUpdatedAt = DateTime.UtcNow
            };
            _db.JourneySteps.Add(pharmacyStep);
            await _db.SaveChangesAsync();
        }

        _db.VisitEvents.Add(new VisitEvent
        {
            VisitId = visit.Id,
            EventType = "DoctorOrderCreated",
            Source = "DoctorWorkspace",
            ActorId = doctorId,
            Details = $"Ordered service {service.NameVi}"
        });
        foreach (var review in journey.Steps.Where(s => s.StepType == StepType.ReturnConsultation && !Resolved(s)))
        {
            review.Status = StepStatus.Waiting;
            review.SortOrder = maxOrder + 2;
        }
        _db.VisitEvents.Add(new VisitEvent { VisitId = visit.Id, EventType = "OrderRequest", Source = "DoctorOrder", SourceEventId = dto.IdempotencyKey, ActorId = doctorId, Details = order.Id.ToString() });
        Notify(visit, NotificationType.JourneyStepChange, "Chỉ định đã cập nhật", "Service orders updated");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new DoctorOrderResponseDto(order.Id, visit.Id, service.Id, service.NameVi, service.NameEn, order.IsRequired, createdSteps);
    }

    public async Task<List<DoctorOrder>> GetDoctorOrdersForVisitAsync(Guid visitId) =>
        await _db.DoctorOrders
            .Include(o => o.Service)
            .Include(o => o.Doctor)
            .Where(o => o.VisitId == visitId)
            .ToListAsync();

    // === 6. Update Step Status (Consultation / Lab / Imaging / Service Progress, UC-17) ===
    private static bool Resolved(JourneyStep s) => s.Status is StepStatus.Completed or StepStatus.Skipped or StepStatus.Cancelled;
    private static bool Clinical(JourneyStep s) => s.StepType is not (StepType.Payment or StepType.Pharmacy);

    public async Task<bool> UpdateStepStatusAsync(Guid stepId, StepStatus newStatus, Guid staffId, string? reason)
    {
        var step = await _db.JourneySteps.Include(s => s.Service).Include(s => s.Journey).ThenInclude(j => j.Steps)
            .FirstOrDefaultAsync(s => s.Id == stepId) ?? throw new KeyNotFoundException("Step not found");
        var visit = await _db.Visits.FindAsync(step.Journey.VisitId) ?? throw new KeyNotFoundException("Visit not found");
        var staff = await _db.Users.FindAsync(staffId) ?? throw new UnauthorizedAccessException();
        bool consultation = step.StepType is StepType.Consultation or StepType.ReturnConsultation;
        if (consultation ? staff.Role != UserRole.Doctor || visit.AssignedDoctorId != staffId || !AccessPolicy.InScope(staff, visit.DepartmentId)
            : staff.Role != UserRole.ServiceStaff || step.Service == null || !AccessPolicy.InScope(staff, step.Service.DepartmentId))
            throw new UnauthorizedAccessException("Actor cannot complete this step");
        if (step.Status == newStatus) return true;
        if (visit.Status != VisitStatus.Active || Resolved(step)) throw new InvalidOperationException("Completed facts cannot be reset");
        if (!Enum.IsDefined(newStatus) || newStatus is StepStatus.Waiting or StepStatus.Ready)
            throw new InvalidOperationException("Readiness is controlled by workflow prerequisites");
        if (step.Status == StepStatus.Waiting && newStatus != StepStatus.Cancelled)
            throw new InvalidOperationException("Prerequisites remain unresolved");
        if (newStatus == StepStatus.Cancelled && step.Status == StepStatus.InProgress)
            throw new InvalidOperationException("Started service requires an authorized resolution");
        if (newStatus is StepStatus.Cancelled or StepStatus.Skipped && string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Resolution reason required");
        using var tx = await _db.Database.BeginTransactionAsync();
        step.Status = newStatus;
        step.StatusReason = reason;
        step.UpdatedAt = DateTime.UtcNow;
        step.QueueUpdatedAt = DateTime.UtcNow;
        if (newStatus == StepStatus.InProgress) step.StartedAt = DateTime.UtcNow;
        if (Resolved(step)) { step.CompletedAt = DateTime.UtcNow; step.CompletedByStaffId = staffId; }
        await ReevaluateAsync(visit, step.Journey);
        _db.VisitEvents.Add(new VisitEvent { VisitId = visit.Id, EventType = "StepStatusChanged", Source = "Staff", ActorId = staffId,
            Details = $"{step.Id}: {newStatus}; {reason}" });
        Notify(visit, NotificationType.JourneyStepChange, "Lộ trình đã cập nhật", "Journey updated");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return true;
    }

    private async Task ReevaluateAsync(Visit visit, Journey journey)
    {
        var unresolvedInitial = journey.Steps.Any(s => s.StepType == StepType.Consultation && !Resolved(s));
        foreach (var service in journey.Steps.Where(s => s.DoctorOrderId.HasValue && s.Status == StepStatus.Waiting))
        {
            var prerequisites = JsonSerializer.Deserialize<Guid[]>(service.PrerequisiteStepIds ?? "[]") ?? [];
            if (!unresolvedInitial && prerequisites.All(id => journey.Steps.Any(s => s.Id == id && Resolved(s)))) service.Status = StepStatus.Ready;
        }
        bool unresolvedServices = journey.Steps.Any(s => s.DoctorOrderId.HasValue && !Resolved(s));
        foreach (var review in journey.Steps.Where(s => s.StepType == StepType.ReturnConsultation && !Resolved(s)))
            review.Status = unresolvedServices || unresolvedInitial ? StepStatus.Waiting : StepStatus.Ready;
        visit.ClinicalReadiness = !journey.Steps.Any(s => Clinical(s) && !Resolved(s));
        foreach (var payment in journey.Steps.Where(s => s.StepType == StepType.Payment && !Resolved(s)))
            payment.Status = visit.ClinicalReadiness ? StepStatus.Ready : StepStatus.Waiting;
        if (visit.ClinicalReadiness && visit.FinalSettlementConfirmed && visit.Status == VisitStatus.Active)
            await CloseVisitInternalAsync(visit, journey, "Current final settlement and required work resolved");
    }

    private void Notify(Visit visit, NotificationType type, string vi, string en) => _db.AppNotifications.Add(new AppNotification {
        UserId = visit.UserId, GuestSessionId = visit.GuestSessionId, RelatedVisitId = visit.Id,
        Type = type, TitleVi = vi, TitleEn = en
    });

    // === 7. Settlement & Visit Closure (UC-18, BR-10, BR-11, BR-17, BR-19) ===
    public async Task<SettlementResponseDto> RecordSettlementAsync(RecordSettlementDto dto, Guid staffId)
    {
        var visit = await _db.Visits
            .Include(v => v.Journey)
                .ThenInclude(j => j!.Steps)
            .FirstOrDefaultAsync(v => v.Id == dto.VisitId);

        if (visit == null) throw new InvalidOperationException("Visit not found");

        // Idempotency: check if idempotency key already exists
        var existingSettlement = await _db.SettlementRecords.FirstOrDefaultAsync(s => s.IdempotencyKey == dto.IdempotencyKey);
        if (string.IsNullOrWhiteSpace(dto.IdempotencyKey) || dto.IdempotencyKey.Length > 100 || !Enum.IsDefined(dto.Type) || dto.Amount < 0)
            throw new ArgumentException("Valid settlement type, amount and event key required");
        if (existingSettlement != null)
        {
            if (existingSettlement.VisitId != dto.VisitId || existingSettlement.Type != dto.Type || existingSettlement.Amount != dto.Amount)
                throw new InvalidOperationException("Settlement event key conflicts with an earlier request");
            return new SettlementResponseDto(
                existingSettlement.Id,
                visit.Id,
                existingSettlement.Type,
                visit.Status == VisitStatus.Closed,
                visit.Status,
                "Settlement already processed with this idempotency key"
            );
        }

        if (visit.Status == VisitStatus.Closed) throw new InvalidOperationException("Visit is already closed");
        using var tx = await _db.Database.BeginTransactionAsync();
        var settlement = new SettlementRecord
        {
            VisitId = visit.Id,
            Type = dto.Type,
            RecordedByStaffId = staffId,
            IdempotencyKey = dto.IdempotencyKey,
            Amount = dto.Amount,
            Notes = dto.Notes
        };
        _db.SettlementRecords.Add(settlement);

        // Mark payment step completed in Journey
        var payStep = visit.Journey?.Steps.FirstOrDefault(s => s.StepType == StepType.Payment && s.Status != StepStatus.Completed);
        if (payStep != null)
        {
            payStep.Status = StepStatus.Completed;
            payStep.CompletedAt = DateTime.UtcNow;
            payStep.CompletedByStaffId = staffId;
        }

        string reason;
        bool closed = false;

        if (dto.Type == SettlementType.Intermediate)
        {
            // Intermediate payment does NOT close Visit (BR-06)
            reason = "Intermediate payment recorded. Visit remains active.";
        }
        else // Final or NoPaymentRequired
        {
            visit.FinalSettlementConfirmed = true;
            visit.SettlementType = dto.Type;

            // Evaluate clinical readiness
            var pendingClinical = visit.Journey?.Steps.Any(s =>
                Clinical(s) && !Resolved(s)) ?? false;

            visit.ClinicalReadiness = !pendingClinical;

            if (visit.ClinicalReadiness)
            {
                // CLOSE VISIT (BR-10, BR-17)
                await CloseVisitInternalAsync(visit, visit.Journey!, dto.Notes ?? "Final settlement confirmed");
                closed = true;
                reason = "All clinical requirements resolved and final settlement confirmed. Visit closed.";
            }
            else
            {
                // Early settlement - hold event, do not close visit yet (BR-07)
                reason = "Final settlement confirmed, but clinical examinations are still pending. Visit remains active until clinical resolution.";
            }
        }

        _db.VisitEvents.Add(new VisitEvent { VisitId = visit.Id, EventType = "SettlementRecorded", Source = "Cashier", SourceEventId = dto.IdempotencyKey, ActorId = staffId, Details = dto.Type.ToString() });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new SettlementResponseDto(
            settlement.Id,
            visit.Id,
            settlement.Type,
            closed,
            visit.Status,
            reason
        );
    }

    private Task CloseVisitInternalAsync(Visit visit, Journey journey, string closureReason)
    {
        visit.Status = VisitStatus.Closed;
        visit.ClosedAt = DateTime.UtcNow;
        visit.ClosureReason = closureReason;
        visit.UpdatedAt = DateTime.UtcNow;

        _db.VisitEvents.Add(new VisitEvent
        {
            VisitId = visit.Id,
            EventType = "VisitClosed",
            Source = "System",
            Details = closureReason
        });

        // BR-11, BR-12: If no pharmacy required, Journey auto-completes. If pharmacy required, Journey stays Active for patient confirmation.
        if (!visit.RequiresPharmacy || !journey.Steps.Any(s => s.StepType == StepType.Pharmacy))
        {
            journey.Status = JourneyStatus.Completed;
            journey.CompletedAt = DateTime.UtcNow;
            journey.CompletionSource = "System (No Pharmacy)";
            journey.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            // Ensure pharmacy step is Ready
            var pharmacyStep = journey.Steps.FirstOrDefault(s => s.StepType == StepType.Pharmacy);
            if (pharmacyStep != null)
            {
                pharmacyStep.Status = StepStatus.Ready;
                pharmacyStep.InstructionVi = "Vui lòng đến nhà thuốc nhận thuốc và nghe hướng dẫn";
                pharmacyStep.InstructionEn = "Please proceed to pharmacy to receive medication and guidance";
                pharmacyStep.UpdatedAt = DateTime.UtcNow;
            }
        }
        return Task.CompletedTask;
    }

    // === 8. Pharmacy Completion by Patient (UC-19, BR-09, BR-11) ===
    public async Task<bool> CompletePharmacyGuidanceAsync(Guid visitId, Guid? userId, Guid? guestSessionId)
    {
        var visit = await _db.Visits
            .Include(v => v.Journey)
                .ThenInclude(j => j!.Steps)
            .FirstOrDefaultAsync(v => v.Id == visitId);

        if (visit == null || visit.Journey == null) return false;

        // Bệnh nhân chỉ được xác nhận bước hướng dẫn nhà thuốc sau khi Visit đóng và Journey đã được kích hoạt (BR-09)
        if (visit.Status != VisitStatus.Closed)
            throw new InvalidOperationException("Pharmacy guidance cannot be completed before Visit is closed");

        if (visit.Journey.Status != JourneyStatus.Active)
            throw new InvalidOperationException("Journey must be Active to complete pharmacy step");

        var rxStep = visit.Journey.Steps.FirstOrDefault(s => s.StepType == StepType.Pharmacy);
        if (rxStep != null)
        {
            rxStep.Status = StepStatus.Completed;
            rxStep.CompletedAt = DateTime.UtcNow;
            rxStep.CompletedByPatientId = userId;
        }

        visit.Journey.Status = JourneyStatus.Completed;
        visit.Journey.CompletedAt = DateTime.UtcNow;
        visit.Journey.CompletionSource = "Patient (Pharmacy Guidance Confirmed)";
        visit.Journey.UpdatedAt = DateTime.UtcNow;

        _db.VisitEvents.Add(new VisitEvent
        {
            VisitId = visit.Id,
            EventType = "PharmacyGuidanceCompleted",
            Source = "Patient",
            ActorId = userId,
            Details = "Patient confirmed completion of pharmacy guidance"
        });

        await _db.SaveChangesAsync();
        return true;
    }

    // === 9. Clinical Content: Diagnosis & Care Instructions (UC-20, UC-21, BR-21, BR-22) ===
    public async Task<DiagnosisSummary> SaveDiagnosisDraftAsync(SaveDiagnosisDto dto, Guid doctorId)
    {
        await AccessPolicy.CheckVisitAsync(_db, dto.VisitId, doctorId, null);
        var diag = dto.Id.HasValue ? await _db.DiagnosisSummaries.FindAsync(dto.Id) :
            await _db.DiagnosisSummaries.FirstOrDefaultAsync(d => d.VisitId == dto.VisitId && d.Status == ContentStatus.Draft);
        if (diag != null && (diag.VisitId != dto.VisitId || diag.DoctorId != doctorId)) throw new UnauthorizedAccessException();
        if (diag == null || diag.Status == ContentStatus.Published)
        {
            diag = new DiagnosisSummary { VisitId = dto.VisitId, DoctorId = doctorId, Status = ContentStatus.Draft,
                Version = (await _db.DiagnosisSummaries.Where(d => d.VisitId == dto.VisitId).MaxAsync(d => (int?)d.Version) ?? 0) + 1 };
            _db.DiagnosisSummaries.Add(diag);
        }
        diag.DiagnosisVi = dto.DiagnosisVi; diag.DiagnosisEn = dto.DiagnosisEn;
        diag.ExplanationVi = dto.ExplanationVi; diag.ExplanationEn = dto.ExplanationEn;
        diag.CareInstructionsVi = dto.CareInstructionsVi; diag.CareInstructionsEn = dto.CareInstructionsEn;
        diag.EnTranslationApproved = dto.EnTranslationApproved;
        diag.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return diag;
    }

    public async Task<DiagnosisSummary> PublishDiagnosisAsync(Guid diagnosisId, Guid doctorId)
    {
        var diag = await _db.DiagnosisSummaries.FindAsync(diagnosisId) ?? throw new KeyNotFoundException("Diagnosis not found");
        await AccessPolicy.CheckVisitAsync(_db, diag.VisitId, doctorId, null);
        if (diag.DoctorId != doctorId) throw new UnauthorizedAccessException();
        if (diag.Status == ContentStatus.Published) return diag; // Retried publish returns the same version.
        if (string.IsNullOrWhiteSpace(diag.DiagnosisVi) || string.IsNullOrWhiteSpace(diag.CareInstructionsVi))
            throw new ArgumentException("Reviewed source diagnosis and care instructions required");
        if (diag.EnTranslationApproved && (string.IsNullOrWhiteSpace(diag.DiagnosisEn) || string.IsNullOrWhiteSpace(diag.CareInstructionsEn)))
            throw new ArgumentException("Approved translation must include diagnosis and care instructions");
        diag.Status = ContentStatus.Published;
        diag.PublishedAt = diag.UpdatedAt = DateTime.UtcNow;
        var visit = await _db.Visits.FindAsync(diag.VisitId);
        Notify(visit!, NotificationType.ContentPublished, "Thông tin bác sĩ đã công bố", "Doctor information published");
        await _db.SaveChangesAsync();
        return diag;
    }

    public async Task<DiagnosisSummaryDto?> GetPublishedDiagnosisForPatientAsync(Guid visitId, Guid? userId, Guid? guestSessionId, string language = "vi")
    {
        await AccessPolicy.CheckVisitAsync(_db, visitId, userId, guestSessionId);
        // BR-21: Draft is hidden from patients! Return only Published, highest version
        var diag = await _db.DiagnosisSummaries
            .Include(d => d.Doctor)
            .Where(d => d.VisitId == visitId && d.Status == ContentStatus.Published)
            .OrderByDescending(d => d.Version)
            .FirstOrDefaultAsync();

        if (diag == null) return null;

        bool useEn = !language.Equals("vi", StringComparison.OrdinalIgnoreCase) && diag.EnTranslationApproved;
        bool isFallback = !language.Equals(useEn ? "en" : "vi", StringComparison.OrdinalIgnoreCase);

        var diagText = useEn ? diag.DiagnosisEn : diag.DiagnosisVi;
        var explText = useEn ? diag.ExplanationEn : diag.ExplanationVi;
        var careText = useEn ? diag.CareInstructionsEn : diag.CareInstructionsVi;

        return new DiagnosisSummaryDto(
            diag.Id,
            diag.VisitId,
            diag.Version,
            diagText,
            explText,
            careText,
            useEn ? "en" : "vi",
            isFallback,
            diag.Doctor.FullName,
            diag.PublishedAt ?? diag.CreatedAt
        );
    }

    public async Task<DiagnosisSummary?> GetDiagnosisForDoctorAsync(Guid visitId, Guid doctorId) =>
        await _db.DiagnosisSummaries
            .Where(d => d.VisitId == visitId)
            .OrderByDescending(d => d.Version)
            .FirstOrDefaultAsync();

    // === 10. Follow-up Recommendations (UC-11, BR-23) ===
    public async Task<FollowUpRecommendation> SaveFollowUpAsync(SaveFollowUpDto dto, Guid doctorId)
    {
        var existing = await _db.FollowUpRecommendations.FirstOrDefaultAsync(f => f.VisitId == dto.VisitId);
        if (existing == null)
        {
            existing = new FollowUpRecommendation
            {
                VisitId = dto.VisitId,
                DoctorId = doctorId,
                RecommendationVi = dto.RecommendationVi,
                RecommendationEn = dto.RecommendationEn,
                SuggestedTimeframe = dto.SuggestedTimeframe,
                IsBookingConfirmed = false // BR-23: Khuyến nghị tái khám không phải một appointment đã đặt
            };
            _db.FollowUpRecommendations.Add(existing);
        }
        else
        {
            existing.RecommendationVi = dto.RecommendationVi;
            existing.RecommendationEn = dto.RecommendationEn;
            existing.SuggestedTimeframe = dto.SuggestedTimeframe;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<FollowUpRecommendation?> GetFollowUpForVisitAsync(Guid visitId) =>
        await _db.FollowUpRecommendations.FirstOrDefaultAsync(f => f.VisitId == visitId);

    // === 11. Assistance Requests (UC-09, FR-AST) ===
    public async Task<AssistanceRequest> CreateAssistanceRequestAsync(CreateAssistanceDto dto, Guid? userId, Guid? guestSessionId)
    {
        Patient? patient = null;
        if (userId.HasValue)
            patient = await _db.Patients.FirstOrDefaultAsync(p => p.UserId == userId.Value);
        else if (guestSessionId.HasValue)
            patient = await _db.Patients.FirstOrDefaultAsync(p => p.GuestSessionId == guestSessionId.Value);

        if (dto.VisitId.HasValue) await AccessPolicy.CheckVisitAsync(_db, dto.VisitId.Value, userId, guestSessionId);
        if (string.IsNullOrWhiteSpace(dto.Category) || string.IsNullOrWhiteSpace(dto.Description) || dto.Description.Length > 1000)
            throw new ArgumentException("Assistance category and description (up to 1000 characters) required");
        if (patient == null && guestSessionId.HasValue)
        {
            var guest = await _db.GuestSessions.FindAsync(guestSessionId.Value) ?? throw new UnauthorizedAccessException();
            patient = new Patient { GuestSessionId = guest.Id, FullName = guest.DisplayName ?? "Guest", PreferredLanguage = guest.PreferredLanguage };
            _db.Patients.Add(patient);
        }
        if (patient == null) throw new UnauthorizedAccessException("Patient access required");
        var req = new AssistanceRequest
        {
            PatientId = patient?.Id,
            VisitId = dto.VisitId,
            GuestSessionId = guestSessionId,
            Category = dto.Category,
            Description = dto.Description,
            Status = AssistanceStatus.Open
        };

        _db.AssistanceRequests.Add(req);
        await _db.SaveChangesAsync();
        return req;
    }

    public async Task<List<AssistanceRequest>> GetAssistanceRequestsAsync(string? staffScope)
    {
        var query = _db.AssistanceRequests.AsQueryable();
        if (staffScope != null)
        {
            var departments = staffScope.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Select(Guid.Parse).ToArray();
            query = query.Where(a => a.Visit != null
                ? departments.Contains(a.Visit.DepartmentId) || a.Visit.Journey!.Steps.Any(s => s.Service != null && departments.Contains(s.Service.DepartmentId))
                : departments.Contains(SeedData.DeptGeneral));
        }
        return await query
            .Include(a => a.Patient)
            .Include(a => a.Visit)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> UpdateAssistanceStatusAsync(Guid assistanceId, AssistanceStatus status, string? resolution, Guid staffId)
    {
        var req = await _db.AssistanceRequests.FindAsync(assistanceId);
        if (req == null) return false;

        req.Status = status;
        req.Resolution = resolution;
        req.AssignedStaffId = staffId;
        req.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }

    // === 12. In-App Notifications ===
    public async Task<List<AppNotification>> GetNotificationsAsync(Guid? userId, Guid? guestSessionId) =>
        await _db.AppNotifications
            .Where(n => (userId.HasValue && n.UserId == userId.Value) ||
                        (guestSessionId.HasValue && n.GuestSessionId == guestSessionId.Value))
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

    // === 13. Workspaces & Admin ===
    public async Task<List<VisitSummaryDto>> GetVisitsForStaffAsync(UserRole role, Guid staffId, string? staffScope)
    {
        var query = _db.Visits
            .Include(v => v.Patient)
            .Include(v => v.Department)
            .Include(v => v.AssignedDoctor)
            .Include(v => v.Journey)
                .ThenInclude(j => j!.Steps)
            .AsQueryable();

        if (role == UserRole.Doctor)
        {
            query = query.Where(v => v.AssignedDoctorId == staffId);
        }

        if (role == UserRole.ServiceStaff)
        {
            var departmentIds = (staffScope ?? "").Split(',').Where(x => Guid.TryParse(x, out _)).Select(Guid.Parse).ToArray();
            query = query.Where(v => v.Journey!.Steps.Any(s => s.Service != null && departmentIds.Contains(s.Service.DepartmentId)));
        }
        if (role == UserRole.Receptionist)
        {
            var departmentIds = (staffScope ?? "").Split(',').Where(x => Guid.TryParse(x, out _)).Select(Guid.Parse).ToArray();
            query = query.Where(v => departmentIds.Contains(v.DepartmentId));
        }
        var list = await query.OrderByDescending(v => v.CreatedAt).Take(50).ToListAsync();

        return list.Select(v => new VisitSummaryDto(
            v.Id,
            v.TicketNumber,
            v.Status,
            v.Patient.FullName,
            v.Department.NameVi,
            v.Department.NameEn,
            v.AssignedDoctor?.FullName,
            v.Journey?.Steps.Count ?? 0,
            v.Journey?.Steps.Count(s => s.Status == StepStatus.Completed) ?? 0,
            v.CreatedAt
        )).ToList();
    }

    public async Task<List<Department>> GetDepartmentsAsync() =>
        await _db.Departments.Where(d => d.IsActive).ToListAsync();

    public async Task<List<HospitalService>> GetServicesAsync() =>
        await _db.HospitalServices.Include(s => s.Department).Where(s => s.IsActive).ToListAsync();

    public async Task<List<ServiceStepMapping>> GetMappingsAsync() =>
        await _db.ServiceStepMappings.Include(m => m.Service).Where(m => m.IsActive).ToListAsync();

    public async Task<List<GuidanceTemplate>> GetTemplatesAsync() =>
        await _db.GuidanceTemplates.Where(t => t.Status == ContentStatus.Published).ToListAsync();

    public async Task<ServiceStepMapping> SaveMappingAsync(ServiceStepMapping mapping)
    {
        mapping.Service = null!; // Do not accept navigation objects as configuration writes.
        var service = await _db.HospitalServices.FindAsync(mapping.ServiceId);
        if (service == null || !service.IsActive || mapping.StepType != service.StepType || string.IsNullOrWhiteSpace(mapping.DestinationVi) || string.IsNullOrWhiteSpace(mapping.DestinationEn) ||
            !mapping.DestinationDepartmentId.HasValue || !await _db.Departments.AnyAsync(d => d.Id == mapping.DestinationDepartmentId && d.IsActive))
            throw new ArgumentException("Mapping requires an active service, matching step type and valid destinations");
        Guid[] prerequisites;
        try { prerequisites = JsonSerializer.Deserialize<Guid[]>(mapping.PrerequisiteServiceIds ?? "[]") ?? []; }
        catch (JsonException) { throw new ArgumentException("Invalid prerequisite list"); }
        if (prerequisites.Contains(mapping.ServiceId) || prerequisites.Distinct().Count() != prerequisites.Length) throw new ArgumentException("Cyclic or duplicate prerequisites");
        var graph = await _db.ServiceStepMappings.Where(m => m.IsActive && m.Id != mapping.Id).ToListAsync();
        var visited = new HashSet<Guid>();
        bool Reaches(Guid node)
        {
            if (node == mapping.ServiceId) return true;
            if (!visited.Add(node)) return false;
            return graph.Where(m => m.ServiceId == node).SelectMany(m => JsonSerializer.Deserialize<Guid[]>(m.PrerequisiteServiceIds ?? "[]") ?? []).Any(Reaches);
        }
        foreach (var prerequisite in prerequisites)
            if (!await _db.HospitalServices.AnyAsync(s => s.Id == prerequisite && s.IsActive) || Reaches(prerequisite)) throw new ArgumentException("Unknown or cyclic prerequisite");
        if (mapping.IsActive && await _db.ServiceStepMappings.AnyAsync(m => m.ServiceId == mapping.ServiceId && m.IsActive && m.Id != mapping.Id)) throw new ArgumentException("Service already has an active mapping; edit that mapping");
        if (mapping.Id == Guid.Empty || !await _db.ServiceStepMappings.AnyAsync(m => m.Id == mapping.Id))
        {
            mapping.Id = Guid.NewGuid();
            _db.ServiceStepMappings.Add(mapping);
        }
        else
        {
            _db.ServiceStepMappings.Update(mapping);
        }
        await _db.SaveChangesAsync();
        return mapping;
    }
}
