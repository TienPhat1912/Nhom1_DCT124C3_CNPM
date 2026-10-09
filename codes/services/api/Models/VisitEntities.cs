using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVisitApi.Models;

/// <summary>
/// Registration request from patient (walk-in or booked appointment).
/// This is NOT a Visit - Visit is only created at reception confirmation (BR-02, BR-03).
/// </summary>
public class RegistrationRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public Guid? GuestSessionId { get; set; }
    public GuestSession? GuestSession { get; set; }

    [Required]
    public RegistrationSource Source { get; set; }

    public RegistrationRequestStatus Status { get; set; } = RegistrationRequestStatus.Pending;

    /// <summary>External appointment ID if booked</summary>
    [MaxLength(100)]
    public string? AppointmentId { get; set; }

    /// <summary>Selected department/service</summary>
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    /// <summary>Patient's condition description</summary>
    [MaxLength(2000)]
    public string? ConditionDescription { get; set; }

    /// <summary>Supplementary information from patient</summary>
    [MaxLength(2000)]
    public string? SupplementInfo { get; set; }

    /// <summary>Staff question template for supplement</summary>
    [MaxLength(2000)]
    public string? StaffQuestion { get; set; }

    /// <summary>Opaque QR token for reception scanning</summary>
    [Required, MaxLength(200)]
    public string ReceptionQrToken { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// An Active or Closed hospital Visit. Created ONLY when reception confirms attendance (BR-03).
/// One Visit per confirmed attendance. A follow-up is a separate Visit (BR-05).
/// </summary>
public class Visit
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    /// <summary>The user account if patient has one</summary>
    public Guid? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>The guest session if patient is a guest</summary>
    public Guid? GuestSessionId { get; set; }
    public GuestSession? GuestSession { get; set; }

    public Guid RegistrationRequestId { get; set; }
    public RegistrationRequest RegistrationRequest { get; set; } = null!;

    [Required]
    public VisitStatus Status { get; set; } = VisitStatus.Active;

    /// <summary>Department/service assigned at reception</summary>
    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    /// <summary>Assigned doctor (if any)</summary>
    public Guid? AssignedDoctorId { get; set; }
    public User? AssignedDoctor { get; set; }

    /// <summary>Receptionist who confirmed</summary>
    public Guid ConfirmedByStaffId { get; set; }

    /// <summary>Examination ticket number</summary>
    [Required, MaxLength(50)]
    public string TicketNumber { get; set; } = string.Empty;

    /// <summary>Opaque ticket QR token for Journey activation</summary>
    [Required, MaxLength(200)]
    public string TicketQrToken { get; set; } = string.Empty;

    /// <summary>Whether clinical readiness conditions are met</summary>
    public bool ClinicalReadiness { get; set; }

    /// <summary>Whether final settlement is confirmed</summary>
    public bool FinalSettlementConfirmed { get; set; }

    /// <summary>Settlement type if confirmed</summary>
    public SettlementType? SettlementType { get; set; }

    /// <summary>Whether pharmacy guidance is required for this visit</summary>
    public bool RequiresPharmacy { get; set; }

    [MaxLength(500)]
    public string? ClosureReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Journey? Journey { get; set; }
    public ICollection<DoctorOrder> DoctorOrders { get; set; } = new List<DoctorOrder>();
    public ICollection<VisitEvent> Events { get; set; } = new List<VisitEvent>();
    public ICollection<DiagnosisSummary> DiagnosisSummaries { get; set; } = new List<DiagnosisSummary>();
    public ICollection<SettlementRecord> Settlements { get; set; } = new List<SettlementRecord>();
}

/// <summary>
/// One Patient Journey per Visit (BR-04). Created at ticket issuance as PendingActivation.
/// Activated when patient scans the ticket QR (BR-16).
/// </summary>
public class Journey
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    [Required]
    public JourneyStatus Status { get; set; } = JourneyStatus.PendingActivation;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Source of completion: Patient (pharmacy confirm), System (auto no-pharmacy)</summary>
    [MaxLength(50)]
    public string? CompletionSource { get; set; }

    // Navigation
    public ICollection<JourneyStep> Steps { get; set; } = new List<JourneyStep>();
}

/// <summary>
/// A step in the patient Journey with prerequisites, destination, and status transitions.
/// </summary>
public class JourneyStep
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid JourneyId { get; set; }
    public Journey Journey { get; set; } = null!;

    [Required]
    public StepType StepType { get; set; }

    [Required]
    public StepStatus Status { get; set; } = StepStatus.Waiting;

    public int SortOrder { get; set; }

    /// <summary>Linked Doctor Order (if step was created from an order)</summary>
    public Guid? DoctorOrderId { get; set; }
    public DoctorOrder? DoctorOrder { get; set; }

    /// <summary>Linked service</summary>
    public Guid? ServiceId { get; set; }
    public HospitalService? Service { get; set; }

    /// <summary>Destination department</summary>
    public Guid? DestinationDepartmentId { get; set; }
    public Department? DestinationDepartment { get; set; }

    [MaxLength(200)]
    public string? DestinationVi { get; set; }

    [MaxLength(200)]
    public string? DestinationEn { get; set; }

    [MaxLength(500)]
    public string? InstructionVi { get; set; }

    [MaxLength(500)]
    public string? InstructionEn { get; set; }

    /// <summary>JSON array of prerequisite step IDs</summary>
    public string? PrerequisiteStepIds { get; set; }

    /// <summary>Queue ticket number for this step</summary>
    [MaxLength(50)]
    public string? QueueTicket { get; set; }

    public DateTime? QueueUpdatedAt { get; set; }

    /// <summary>Who completed/skipped/cancelled this step</summary>
    public Guid? CompletedByStaffId { get; set; }
    public Guid? CompletedByPatientId { get; set; }

    [MaxLength(200)]
    public string? StatusReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Doctor's order for a service. Creates linked JourneySteps (UC-07, BR-06, BR-25).
/// </summary>
public class DoctorOrder
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    public Guid DoctorId { get; set; }
    public User Doctor { get; set; } = null!;

    public Guid ServiceId { get; set; }
    public HospitalService Service { get; set; } = null!;

    public bool IsRequired { get; set; } = true;
    public bool IsCancelled { get; set; }
    [MaxLength(200)]
    public string? CancellationReason { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<JourneyStep> LinkedSteps { get; set; } = new List<JourneyStep>();
}

/// <summary>
/// Visit event for audit trail. Unique by source + source_event_id (BR-03 idempotency).
/// </summary>
public class VisitEvent
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    [Required, MaxLength(50)]
    public string EventType { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string Source { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? SourceEventId { get; set; }

    public Guid? ActorId { get; set; }

    [MaxLength(500)]
    public string? Details { get; set; }

    public int Version { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Doctor's diagnosis summary and care instructions (UC-20, FR-DOC).
/// Draft not visible to patients (BR-21). Published corrections create new versions (BR-22).
/// </summary>
public class DiagnosisSummary
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    public Guid DoctorId { get; set; }
    public User Doctor { get; set; } = null!;

    [Required]
    public ContentStatus Status { get; set; } = ContentStatus.Draft;

    /// <summary>Version number. Corrections create new versions (BR-22).</summary>
    public int Version { get; set; } = 1;

    /// <summary>Diagnosis text</summary>
    public string? DiagnosisVi { get; set; }
    public string? DiagnosisEn { get; set; }

    /// <summary>Plain-language explanation</summary>
    public string? ExplanationVi { get; set; }
    public string? ExplanationEn { get; set; }

    /// <summary>Care instructions</summary>
    public string? CareInstructionsVi { get; set; }
    public string? CareInstructionsEn { get; set; }

    /// <summary>Whether EN translations are approved</summary>
    public bool EnTranslationApproved { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Follow-up recommendation (UC-11, BR-23). NOT a confirmed appointment.
/// </summary>
public class FollowUpRecommendation
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    public Guid DoctorId { get; set; }
    public User Doctor { get; set; } = null!;

    [MaxLength(500)]
    public string? RecommendationVi { get; set; }
    [MaxLength(500)]
    public string? RecommendationEn { get; set; }

    /// <summary>Suggested timeframe</summary>
    [MaxLength(100)]
    public string? SuggestedTimeframe { get; set; }

    /// <summary>This is NOT a confirmed appointment (BR-23)</summary>
    public bool IsBookingConfirmed { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Settlement record (intermediate or final payment, or no-payment-required).
/// Intermediate does NOT close Visit. Final may close if conditions met (BR-10, BR-17).
/// </summary>
public class SettlementRecord
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VisitId { get; set; }
    public Visit Visit { get; set; } = null!;

    [Required]
    public SettlementType Type { get; set; }

    public Guid RecordedByStaffId { get; set; }

    /// <summary>Idempotency key to prevent duplicate settlements</summary>
    [Required, MaxLength(100)]
    public string IdempotencyKey { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; set; }

    public decimal? Amount { get; set; }

    /// <summary>Whether this settlement is still valid for current work items</summary>
    public bool IsCurrentlyValid { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Assistance request from patient (UC-09, FR-AST).
/// </summary>
public class AssistanceRequest
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? PatientId { get; set; }
    public Patient? Patient { get; set; }

    public Guid? VisitId { get; set; }
    public Visit? Visit { get; set; }

    public Guid? GuestSessionId { get; set; }

    [Required, MaxLength(100)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public AssistanceStatus Status { get; set; } = AssistanceStatus.Open;

    public Guid? AssignedStaffId { get; set; }
    public User? AssignedStaff { get; set; }

    [MaxLength(500)]
    public string? Resolution { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// In-app notification for patients.
/// </summary>
public class AppNotification
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? UserId { get; set; }
    public Guid? GuestSessionId { get; set; }

    [Required]
    public NotificationType Type { get; set; }

    [Required, MaxLength(500)]
    public string TitleVi { get; set; } = string.Empty;
    [Required, MaxLength(500)]
    public string TitleEn { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? BodyVi { get; set; }
    [MaxLength(1000)]
    public string? BodyEn { get; set; }

    public Guid? RelatedVisitId { get; set; }
    public Guid? RelatedStepId { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Guest-to-account conversion context (UC-16, BR-15).
/// </summary>
public class GuestConversionContext
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid GuestSessionId { get; set; }
    public GuestSession GuestSession { get; set; } = null!;

    /// <summary>Protected continuation context token</summary>
    [Required, MaxLength(200)]
    public string ContinuationToken { get; set; } = string.Empty;

    /// <summary>Return target after successful conversion</summary>
    [MaxLength(500)]
    public string? ReturnTarget { get; set; }

    public bool IsConsumed { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}
