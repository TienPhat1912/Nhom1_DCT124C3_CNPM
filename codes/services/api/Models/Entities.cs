using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HospitalVisitApi.Models;

/// <summary>
/// A user account in the system (patient or staff).
/// Patients may also use guest sessions without an account.
/// </summary>
public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [System.Text.Json.Serialization.JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    [Required]
    public UserRole Role { get; set; }

    /// <summary>For staff: scope of departments/services they can access</summary>
    public string? StaffScope { get; set; }

    [MaxLength(10)]
    public string PreferredLanguage { get; set; } = "vi";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Visit> PatientVisits { get; set; } = new List<Visit>();
    public ICollection<GuestSession> GuestSessions { get; set; } = new List<GuestSession>();
}

/// <summary>
/// A guest session for patients without accounts.
/// Guest data is stored on server before account creation (BR-14).
/// </summary>
public class GuestSession
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(200)]
    [System.Text.Json.Serialization.JsonIgnore]
    public string Token { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? DisplayName { get; set; }

    [MaxLength(10)]
    public string PreferredLanguage { get; set; } = "vi";

    /// <summary>Linked user after guest-to-account conversion</summary>
    public Guid? LinkedUserId { get; set; }
    public User? LinkedUser { get; set; }

    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsConsumed { get; set; }

    // Navigation
    public ICollection<Visit> GuestVisits { get; set; } = new List<Visit>();
    public ICollection<RegistrationRequest> GuestRequests { get; set; } = new List<RegistrationRequest>();
}

/// <summary>
/// A patient record (may be linked to a user account or a guest session).
/// </summary>
public class Patient
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public Guid? GuestSessionId { get; set; }
    public GuestSession? GuestSession { get; set; }

    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? PhoneNumber { get; set; }

    public DateTime? DateOfBirth { get; set; }

    [MaxLength(10)]
    public string? Gender { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(50)]
    public string? InsuranceNumber { get; set; }

    [MaxLength(10)]
    public string PreferredLanguage { get; set; } = "vi";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Visit> Visits { get; set; } = new List<Visit>();
    public ICollection<RegistrationRequest> RegistrationRequests { get; set; } = new List<RegistrationRequest>();
}

/// <summary>
/// Department configuration (e.g., Cardiology, Pharmacy, Lab).
/// </summary>
public class Department
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string NameVi { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string NameEn { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Floor { get; set; }

    [MaxLength(100)]
    public string? Room { get; set; }

    [MaxLength(200)]
    public string? Building { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<HospitalService> Services { get; set; } = new List<HospitalService>();
}

/// <summary>
/// Hospital service (e.g., Blood Test, X-Ray, Ultrasound).
/// Referenced by Doctor Orders and Journey steps.
/// </summary>
public class HospitalService
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string NameVi { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string NameEn { get; set; } = string.Empty;

    [Required]
    public StepType StepType { get; set; }

    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<ServiceStepMapping> StepMappings { get; set; } = new List<ServiceStepMapping>();
}

/// <summary>
/// Validated service-to-step mapping with prerequisites and destinations (FR-ADM-03, BR-25).
/// Missing mapping rejects a new service order before committing.
/// </summary>
public class ServiceStepMapping
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ServiceId { get; set; }
    public HospitalService Service { get; set; } = null!;

    [Required]
    public StepType StepType { get; set; }

    /// <summary>JSON array of prerequisite service IDs</summary>
    public string? PrerequisiteServiceIds { get; set; }

    public int SortOrder { get; set; }

    [MaxLength(200)]
    public string? DestinationVi { get; set; }

    [MaxLength(200)]
    public string? DestinationEn { get; set; }

    public Guid? DestinationDepartmentId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Guidance template with VI/EN versions and publication status (FR-ADM-04).
/// </summary>
public class GuidanceTemplate
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(100)]
    public string TemplateKey { get; set; } = string.Empty;

    [Required]
    public string ContentVi { get; set; } = string.Empty;

    [Required]
    public string ContentEn { get; set; } = string.Empty;

    public ContentStatus Status { get; set; } = ContentStatus.Draft;

    public int Version { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
}
