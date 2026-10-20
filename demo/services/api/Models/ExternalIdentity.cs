using System.ComponentModel.DataAnnotations;

namespace HospitalVisitApi.Models;

public sealed class ExternalIdentity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;
    [MaxLength(100)] public string Provider { get; set; } = "DemoAppointment";
    [MaxLength(100)] public string Subject { get; set; } = "";
    public DateTime VerifiedAt { get; set; } = DateTime.UtcNow;
}
