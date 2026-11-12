using System.ComponentModel.DataAnnotations.Schema;
namespace Hospital.Api.Domain;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class Patient : Entity
{
    public string Name { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Language { get; set; } = "vi";
}
public class UserAccount : Entity
{
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "Patient";
    public Guid? PatientId { get; set; }
    public bool Active { get; set; } = true;
    public List<StaffScope> Scopes { get; set; } = [];
}
public class StaffScope : Entity
{
    public Guid UserAccountId { get; set; }
    public Guid DepartmentId { get; set; }
}
// PB-004: new assignment tables start empty on legacy databases. Never infer duty from roster.
public class ClinicDoctor : Entity
{
    public Guid DoctorId { get; set; }
    public Guid ClinicLocationId { get; set; }
}
public class ClinicRoom : Entity
{
    public Guid ClinicLocationId { get; set; }
    public Guid? ActiveDoctorId { get; set; }
}
public class Session : Entity
{
    public string TokenHash { get; set; } = "";
    public Guid? UserAccountId { get; set; }
    public UserAccount? UserAccount { get; set; }
    public Guid? PatientId { get; set; }
    public bool IsGuest { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool Revoked { get; set; }
}
public class AccessGrant : Entity
{
    public Guid SessionId { get; set; }
    public Guid VisitId { get; set; }
    public DateTime ExpiresAt { get; set; }
}
public class LinkClaim : Entity
{
    public Guid SessionId { get; set; }
    public string Hash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public bool Consumed { get; set; }
    public Guid? ReturnVisitId { get; set; }
}
public class RecoveryClaim : Entity
{
    public Guid PatientId { get; set; }
    public Guid VisitId { get; set; }
    public string Hash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public bool Consumed { get; set; }
}
public class ExternalIdentity : Entity
{
    public Guid PatientId { get; set; }
    public string Provider { get; set; } = "Simulation";
    public string Reference { get; set; } = "";
}
public class Appointment : Entity
{
    public Guid PatientId { get; set; }
    public string Provider { get; set; } = "Simulation";
    public string Reference { get; set; } = "";
    public string Status { get; set; } = "Confirmed";
    public DateTime ScheduledAt { get; set; }
    public Guid DepartmentId { get; set; }
}
public class RegistrationRequest : Entity
{
    public string? SourceLanguage { get; set; }
    public Guid? PreferredDepartmentId { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;
    public Guid SessionId { get; set; }
    public Guid? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }
    public string Name { get; set; } = "";
    public string Contact { get; set; } = "";
    public string Description { get; set; } = "";
    public string Requests { get; set; } = "";
    public string Status { get; set; } = "Submitted";
    public Guid DepartmentId { get; set; }
    public List<ReceptionMessage> Messages { get; set; } = [];
}
public class ReceptionMessage : Entity
{
    public Guid RegistrationRequestId { get; set; }
    public Guid TemplateId { get; set; }
    public string Text { get; set; } = "";
    public string Language { get; set; } = "vi";
    public string Response { get; set; } = "";
    public Guid ActorId { get; set; }
}
public class ReceptionRecord : Entity
{
    public Guid RegistrationRequestId { get; set; }
    public Guid PatientId { get; set; }
    public Guid ConfirmedBy { get; set; }
    public string VerificationNote { get; set; } = "";
}
public class Visit : Entity
{
    // Null means legacy/unverified, not Waiting or zero consultations.
    public Guid? ClinicLocationId { get; set; }
    public string? ExamStatus { get; set; }
    public int? ConsultationCount { get; set; }
    public DateTime? ExaminationCompletedAt { get; set; }
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;
    public Guid ReceptionRecordId { get; set; }
    public Guid? AppointmentId { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid DoctorId { get; set; }
    public string Status { get; set; } = "Active";
    public int WorkRevision { get; set; } = 1;
    public int? FinalSettlementRevision { get; set; }
    public string? FinalSettlementOutcome { get; set; }
    public DateTime? ClosedAt { get; set; }
    public PatientJourney Journey { get; set; } = null!;
    public ExaminationTicket Ticket { get; set; } = null!;
    public List<DoctorOrder> Orders { get; set; } = [];
}
public class PatientJourney : Entity
{
    public Guid VisitId { get; set; }
    public string Status { get; set; } = "PendingActivation";
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? CompletionSource { get; set; }
    public List<JourneyStep> Steps { get; set; } = [];
}
public class ExaminationTicket : Entity
{
    public string SnapshotSource { get; set; } = "LegacyMissing";
    public string? PatientSnapshot { get; set; }
    public string? ClinicSnapshot { get; set; }
    public string? DoctorSnapshot { get; set; }
    public Guid VisitId { get; set; }
    public string Number { get; set; } = "";
}
public class QrCode : Entity
{
    public string Hash { get; set; } = "";
    public string ProtectedToken { get; set; } = "";
    public string Purpose { get; set; } = "Reception";
    public Guid? RegistrationRequestId { get; set; }
    public Guid? ExaminationTicketId { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime ExpiresAt { get; set; }
}
public class JourneyStep : Entity
{
    public Guid PatientJourneyId { get; set; }
    public Guid? DoctorOrderId { get; set; }
    public Guid? HospitalServiceId { get; set; }
    public Guid LocationId { get; set; }
    public Guid DepartmentId { get; set; }
    public string DestinationSnapshot { get; set; } = "{}";
    public string Kind { get; set; } = "Consultation";
    public string Authority { get; set; } = "Doctor";
    public string Status { get; set; } = "Waiting";
    public string TemplateKey { get; set; } = "consultation";
    public int Sequence { get; set; }
    public int MappingVersion { get; set; }
    public string QueueNumber { get; set; } = "";
    public string QueueStatus { get; set; } = "Waiting";
    public DateTime QueueUpdatedAt { get; set; } = DateTime.UtcNow;
    public string ResolutionReason { get; set; } = "";
    public DateTime? CompletedAt { get; set; }
    public List<StepDependency> Dependencies { get; set; } = [];
}
public class StepDependency : Entity
{
    public Guid JourneyStepId { get; set; }
    public Guid PrerequisiteStepId { get; set; }
}
public class DoctorOrder : Entity
{
    public Guid VisitId { get; set; }
    public Guid HospitalServiceId { get; set; }
    public Guid OrderedBy { get; set; }
    public string Status { get; set; } = "Ordered";
    public string Note { get; set; } = "";
    public int MappingVersion { get; set; }
}
public class Department : Entity
{
    public string Code { get; set; } = "";
    public string NameVi { get; set; } = "";
    [NotMapped] public string NameEn => NameVi;
    public bool Active { get; set; } = true;
}
public class Location : Entity
{
    public Guid DepartmentId { get; set; }
    public string NameVi { get; set; } = "";
    [NotMapped] public string NameEn => NameVi;
    public string Building { get; set; } = "A";
    public string Floor { get; set; } = "1";
    public string Room { get; set; } = "";
    public bool Active { get; set; } = true;
}
public class HospitalService : Entity
{
    public string Code { get; set; } = "";
    public string NameVi { get; set; } = "";
    [NotMapped] public string NameEn => NameVi;
    public Guid DepartmentId { get; set; }
    public Guid LocationId { get; set; }
    public bool Active { get; set; } = true;
    public bool ReturnRequired { get; set; } = true;
}
public class WorkflowMapping : Entity
{
    public Guid HospitalServiceId { get; set; }
    public int Revision { get; set; } = 1;
    public bool Published { get; set; }
    public string StepsJson { get; set; } = "[]";
}
public record MappingNode(string Key, Guid LocationId, string TemplateKey, string Authority, string[] DependsOn);
public class GuidanceTemplate : Entity
{
    public string Key { get; set; } = "";
    public string Language { get; set; } = "vi";
    public int Revision { get; set; } = 1;
    public string Text { get; set; } = "";
    public bool Published { get; set; }
    public string Category { get; set; } = "Guidance";
    public Guid? ApprovedBy { get; set; }
}
public class HospitalRoute : Entity
{
    public Guid FromLocationId { get; set; }
    public Guid ToLocationId { get; set; }
    public string Language { get; set; } = "vi";
    public string Instructions { get; set; } = "";
    public bool Active { get; set; } = true;
}
public class SummaryVersion : Entity
{
    public Guid VisitId { get; set; }
    public int Revision { get; set; }
    public string Status { get; set; } = "Draft";
    public string Language { get; set; } = "vi";
    public string Diagnosis { get; set; } = "";
    public string Explanation { get; set; } = "";
    public string Instructions { get; set; } = "";
    public string DocumentReference { get; set; } = "";
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = "";
    public string Source { get; set; } = "Doctor";
    public DateTime? PublishedAt { get; set; }
}

public class FollowUpRecommendation : Entity
{
    public Guid VisitId { get; set; }
    public Guid DepartmentId { get; set; }
    public DateTime RecommendedAt { get; set; }
    public string Text { get; set; } = "";
    public string Language { get; set; } = "vi";
    public string Status { get; set; } = "Published";
    public Guid AuthorId { get; set; }
}
public class AssistanceRequest : Entity
{
    public string? SourceLanguage { get; set; }
    public Guid PatientId { get; set; }
    public Guid SessionId { get; set; }
    public Guid? RegistrationRequestId { get; set; }
    public Guid? VisitId { get; set; }
    public Guid? JourneyStepId { get; set; }
    public Guid DepartmentId { get; set; }
    public string Category { get; set; } = "Navigation";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "Open";
    public string Resolution { get; set; } = "";
    public Guid? HandledBy { get; set; }
    public bool Escalated { get; set; }
}
public class Notification : Entity
{
    public Guid PatientId { get; set; }
    public Guid? VisitId { get; set; }
    public string Key { get; set; } = "journeyUpdated";
    public bool Read { get; set; }
}
public class AuditEvent : Entity
{
    public Guid? VisitId { get; set; }
    public Guid ActorId { get; set; }
    public string Source { get; set; } = "Staff";
    public string SourceEventId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Detail { get; set; } = "";
}
public class CommandReceipt : Entity
{
    public string Scope { get; set; } = "";
    public string Key { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public string ResponseJson { get; set; } = "";
}
