namespace HospitalVisitApi.Models;

// === Visit & Journey State ===
public enum VisitStatus
{
    Active,
    Closed
}

public enum JourneyStatus
{
    PendingActivation,
    Active,
    Completed
}

public enum StepStatus
{
    Waiting,
    Ready,
    InProgress,
    Completed,
    Skipped,
    Cancelled
}

// === QR Purpose ===
public enum QrPurpose
{
    HospitalEntry,    // General hospital guidance QR
    Reception,        // Patient-specific reception QR (opaque booking/request ref)
    ExaminationTicket // Examination ticket QR for Journey activation
}

// === Registration ===
public enum RegistrationSource
{
    Booked,
    WalkIn
}

public enum RegistrationRequestStatus
{
    Pending,
    SupplementRequested,
    SupplementProvided,
    Confirmed,
    Rejected
}

// === Content ===
public enum ContentStatus
{
    Draft,
    Published
}

// === Assistance ===
public enum AssistanceStatus
{
    Open,
    Acknowledged,
    Resolved,
    Escalated
}

// === Settlement ===
public enum SettlementType
{
    Intermediate,
    Final,
    NoPaymentRequired
}

// === User Roles ===
public enum UserRole
{
    Patient,
    Receptionist,
    Doctor,
    ServiceStaff,
    Cashier,
    Administrator
}

// === Step Types ===
public enum StepType
{
    Consultation,
    Laboratory,
    Imaging,
    ReturnConsultation,
    Payment,
    Pharmacy,
    Other
}

// === Notification Types ===
public enum NotificationType
{
    QueueUpdate,
    JourneyStepChange,
    ContentPublished,
    AssistanceUpdate,
    SettlementRequired
}
