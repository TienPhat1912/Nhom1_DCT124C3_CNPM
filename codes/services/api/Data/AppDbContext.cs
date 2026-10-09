using Microsoft.EntityFrameworkCore;
using HospitalVisitApi.Models;

namespace HospitalVisitApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Identity & Access
    public DbSet<User> Users => Set<User>();
    public DbSet<GuestSession> GuestSessions => Set<GuestSession>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<ExternalIdentity> ExternalIdentities => Set<ExternalIdentity>();
    public DbSet<GuestConversionContext> GuestConversionContexts => Set<GuestConversionContext>();

    // Hospital Config
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<HospitalService> HospitalServices => Set<HospitalService>();
    public DbSet<ServiceStepMapping> ServiceStepMappings => Set<ServiceStepMapping>();
    public DbSet<GuidanceTemplate> GuidanceTemplates => Set<GuidanceTemplate>();

    // Registration & Visit
    public DbSet<RegistrationRequest> RegistrationRequests => Set<RegistrationRequest>();
    public DbSet<Visit> Visits => Set<Visit>();
    public DbSet<Journey> Journeys => Set<Journey>();
    public DbSet<JourneyStep> JourneySteps => Set<JourneyStep>();
    public DbSet<DoctorOrder> DoctorOrders => Set<DoctorOrder>();
    public DbSet<VisitEvent> VisitEvents => Set<VisitEvent>();

    // Clinical Content
    public DbSet<DiagnosisSummary> DiagnosisSummaries => Set<DiagnosisSummary>();
    public DbSet<FollowUpRecommendation> FollowUpRecommendations => Set<FollowUpRecommendation>();

    // Settlement
    public DbSet<SettlementRecord> SettlementRecords => Set<SettlementRecord>();

    // Support
    public DbSet<AssistanceRequest> AssistanceRequests => Set<AssistanceRequest>();
    public DbSet<AppNotification> AppNotifications => Set<AppNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<ExternalIdentity>(e =>
        {
            e.HasIndex(i => new { i.Provider, i.Subject }).IsUnique();
            e.HasIndex(i => new { i.Provider, i.PatientId }).IsUnique();
            e.HasOne(i => i.Patient).WithMany().HasForeignKey(i => i.PatientId).OnDelete(DeleteBehavior.Restrict);
        });

        // === User ===
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
        });

        // === GuestSession ===
        modelBuilder.Entity<GuestSession>(e =>
        {
            e.HasIndex(g => g.Token).IsUnique();
            e.HasOne(g => g.LinkedUser)
                .WithMany(u => u.GuestSessions)
                .HasForeignKey(g => g.LinkedUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === Patient ===
        modelBuilder.Entity<Patient>(e =>
        {
            e.HasIndex(p => p.UserId).IsUnique();
            e.HasIndex(p => p.GuestSessionId).IsUnique();
            e.HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(p => p.GuestSession)
                .WithMany()
                .HasForeignKey(p => p.GuestSessionId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === RegistrationRequest ===
        modelBuilder.Entity<RegistrationRequest>(e =>
        {
            e.HasIndex(r => r.ReceptionQrToken).IsUnique();
            e.HasOne(r => r.Patient)
                .WithMany(p => p.RegistrationRequests)
                .HasForeignKey(r => r.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.GuestSession)
                .WithMany(g => g.GuestRequests)
                .HasForeignKey(r => r.GuestSessionId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(r => r.Department)
                .WithMany()
                .HasForeignKey(r => r.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === Visit ===
        modelBuilder.Entity<Visit>(e =>
        {
            e.HasIndex(v => v.TicketQrToken).IsUnique();
            e.HasIndex(v => v.TicketNumber);
            // Unique constraint: one Visit per RegistrationRequest (prevents duplicates, BR-03)
            e.HasIndex(v => v.RegistrationRequestId).IsUnique();
            e.HasOne(v => v.Patient)
                .WithMany(p => p.Visits)
                .HasForeignKey(v => v.PatientId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(v => v.User)
                .WithMany(u => u.PatientVisits)
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(v => v.GuestSession)
                .WithMany(g => g.GuestVisits)
                .HasForeignKey(v => v.GuestSessionId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(v => v.RegistrationRequest)
                .WithOne()
                .HasForeignKey<Visit>(v => v.RegistrationRequestId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(v => v.Department)
                .WithMany()
                .HasForeignKey(v => v.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(v => v.AssignedDoctor)
                .WithMany()
                .HasForeignKey(v => v.AssignedDoctorId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === Journey ===
        modelBuilder.Entity<Journey>(e =>
        {
            // One Journey per Visit (BR-04)
            e.HasIndex(j => j.VisitId).IsUnique();
            e.HasOne(j => j.Visit)
                .WithOne(v => v.Journey)
                .HasForeignKey<Journey>(j => j.VisitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // === JourneyStep ===
        modelBuilder.Entity<JourneyStep>(e =>
        {
            e.HasOne(s => s.Journey)
                .WithMany(j => j.Steps)
                .HasForeignKey(s => s.JourneyId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.DoctorOrder)
                .WithMany(o => o.LinkedSteps)
                .HasForeignKey(s => s.DoctorOrderId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(s => s.Service)
                .WithMany()
                .HasForeignKey(s => s.ServiceId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(s => s.DestinationDepartment)
                .WithMany()
                .HasForeignKey(s => s.DestinationDepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === DoctorOrder ===
        modelBuilder.Entity<DoctorOrder>(e =>
        {
            e.HasOne(o => o.Visit)
                .WithMany(v => v.DoctorOrders)
                .HasForeignKey(o => o.VisitId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(o => o.Doctor)
                .WithMany()
                .HasForeignKey(o => o.DoctorId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(o => o.Service)
                .WithMany()
                .HasForeignKey(o => o.ServiceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // === VisitEvent ===
        modelBuilder.Entity<VisitEvent>(e =>
        {
            // Prevent replay: unique source + source_event_id
            e.HasIndex(ve => new { ve.Source, ve.SourceEventId })
                .IsUnique()
                .HasFilter("[SourceEventId] IS NOT NULL");
            e.HasOne(ve => ve.Visit)
                .WithMany(v => v.Events)
                .HasForeignKey(ve => ve.VisitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // === DiagnosisSummary ===
        modelBuilder.Entity<DiagnosisSummary>(e =>
        {
            e.HasIndex(d => new { d.VisitId, d.Version }).IsUnique();
            e.HasOne(d => d.Visit)
                .WithMany(v => v.DiagnosisSummaries)
                .HasForeignKey(d => d.VisitId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(d => d.Doctor)
                .WithMany()
                .HasForeignKey(d => d.DoctorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // === FollowUpRecommendation ===
        modelBuilder.Entity<FollowUpRecommendation>(e =>
        {
            e.HasOne(f => f.Visit)
                .WithMany()
                .HasForeignKey(f => f.VisitId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(f => f.Doctor)
                .WithMany()
                .HasForeignKey(f => f.DoctorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // === SettlementRecord ===
        modelBuilder.Entity<SettlementRecord>(e =>
        {
            e.HasIndex(s => s.IdempotencyKey).IsUnique();
            e.HasOne(s => s.Visit)
                .WithMany(v => v.Settlements)
                .HasForeignKey(s => s.VisitId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // === AssistanceRequest ===
        modelBuilder.Entity<AssistanceRequest>(e =>
        {
            e.HasOne(a => a.Patient)
                .WithMany()
                .HasForeignKey(a => a.PatientId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(a => a.Visit)
                .WithMany()
                .HasForeignKey(a => a.VisitId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(a => a.AssignedStaff)
                .WithMany()
                .HasForeignKey(a => a.AssignedStaffId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // === AppNotification ===
        modelBuilder.Entity<AppNotification>(e =>
        {
            e.HasIndex(n => n.UserId);
            e.HasIndex(n => n.GuestSessionId);
        });

        // === GuestConversionContext ===
        modelBuilder.Entity<GuestConversionContext>(e =>
        {
            e.HasIndex(g => g.ContinuationToken).IsUnique();
            e.HasOne(g => g.GuestSession)
                .WithMany()
                .HasForeignKey(g => g.GuestSessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // === HospitalService ===
        modelBuilder.Entity<HospitalService>(e =>
        {
            e.HasOne(s => s.Department)
                .WithMany(d => d.Services)
                .HasForeignKey(s => s.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // === ServiceStepMapping ===
        modelBuilder.Entity<ServiceStepMapping>(e =>
        {
            e.HasOne(m => m.Service)
                .WithMany(s => s.StepMappings)
                .HasForeignKey(m => m.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
