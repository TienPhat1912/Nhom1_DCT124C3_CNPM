using Hospital.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Infrastructure;

public class HospitalDb(DbContextOptions<HospitalDb> options) : DbContext(options)
{
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<UserAccount> Users => Set<UserAccount>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Visit> Visits => Set<Visit>();
    public DbSet<RegistrationRequest> Requests => Set<RegistrationRequest>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        foreach (var type in typeof(Entity).Assembly.GetTypes().Where(t => t.IsSubclassOf(typeof(Entity))))
        {
            var e = m.Entity(type);
            e.HasKey(nameof(Entity.Id));
            e.Property(nameof(Entity.Id)).ValueGeneratedNever();
            e.Property(nameof(Entity.Version)).IsConcurrencyToken();
            foreach (var p in type.GetProperties().Where(p => p.PropertyType == typeof(string) && !Attribute.IsDefined(p, typeof(System.ComponentModel.DataAnnotations.Schema.NotMappedAttribute))))
                e.Property(p.Name).HasMaxLength(p.Name is "Text" or "Instructions" or "Diagnosis" or "Explanation" or "Description" or "Requests" or "StepsJson" or "ResponseJson" or "DestinationSnapshot" or "Detail" ? 12000 : 500);
        }
        m.Entity<UserAccount>().HasIndex(x => x.Email).IsUnique();
        m.Entity<Session>().HasIndex(s => s.LastSeenAt).HasFilter("[LastSeenAt] IS NOT NULL")
            .IncludeProperties(s => new { s.IsGuest, s.UserAccountId, s.ExpiresAt, s.Revoked });
        ConfigureClinicalCatalog(m);
        m.Entity<VisitEvent>().Property(e => e.Sequence).UseIdentityColumn();
        m.Entity<VisitEvent>().HasIndex(e => e.Sequence).IsUnique();
        m.Entity<VisitEvent>().HasIndex(e => new { e.VisitId, e.Sequence });
        m.Entity<VisitEvent>().Property(e => e.PayloadJson).HasColumnType("nvarchar(max)").Metadata.SetMaxLength(null);
        Fk<VisitEvent, Visit>(m, "VisitId");
        m.Entity<DoctorOrder>().HasIndex(x => x.VisitId).IsUnique().HasDatabaseName("UX_Orders_OneNotCompletedPerVisit")
            .HasFilter("[Status] = 'NotCompleted'");
        m.Entity<DoctorOrder>().HasIndex(x => new { x.VisitId, x.CreatedAt });
        foreach (var name in new[] { "ServiceSnapshot", "DestinationSnapshot", "OrderedBySnapshot" })
            m.Entity<DoctorOrder>().Property<string?>(name).HasColumnType("nvarchar(max)").Metadata.SetMaxLength(null);
        m.Entity<DoctorOrder>().ToTable(t => t.HasCheckConstraint("CK_Order_V2",
            "([ConsultationNumber] IS NULL AND [ServiceSnapshot] IS NULL AND [DestinationSnapshot] IS NULL AND [OrderedBySnapshot] IS NULL) OR ([ConsultationNumber] IS NOT NULL AND [ConsultationNumber] > 0 AND [Status] IN ('NotCompleted','Completed') AND [ServiceSnapshot] IS NOT NULL AND ISJSON([ServiceSnapshot]) = 1 AND [DestinationSnapshot] IS NOT NULL AND ISJSON([DestinationSnapshot]) = 1 AND [OrderedBySnapshot] IS NOT NULL AND ISJSON([OrderedBySnapshot]) = 1)"));
        m.Entity<JourneyStep>().ToTable(t => t.HasCheckConstraint("CK_Step_ConsultationNumber", "[ConsultationNumber] IS NULL OR [ConsultationNumber] > 0"));
        Fk<DoctorOrder, UserAccount>(m, "CompletedById");
        Fk<OrderPreview, Visit>(m, "VisitId"); Fk<OrderPreview, UserAccount>(m, "DoctorId"); Fk<OrderPreview, HospitalService>(m, "ServiceId");
        m.Entity<OrderPreview>().Property(x => x.ConfigurationHash).HasMaxLength(64);
        m.Entity<ConsultationCall>().HasIndex(x => new { x.VisitId, x.ConsultationNumber }).IsUnique();
        m.Entity<ConsultationCall>().Property(x => x.PayloadJson).HasColumnType("nvarchar(max)").Metadata.SetMaxLength(null);
        m.Entity<ConsultationCall>().ToTable(t => {
            t.HasCheckConstraint("CK_ConsultationCall_Number", "[ConsultationNumber] > 0 AND [ContentRevision] > 0");
            t.HasCheckConstraint("CK_ConsultationCall_Payload", "ISJSON([PayloadJson]) = 1");
        });
        Fk<ConsultationCall, Visit>(m, "VisitId");
        Fk<ConsultationCall, Location>(m, "ClinicLocationId");
        Fk<ConsultationCall, UserAccount>(m, "DoctorId");
        m.Entity<Visit>().HasIndex(x => x.ClinicLocationId).IsUnique()
            .HasDatabaseName("UX_Visits_OneConsultationPerClinic")
            .HasFilter("[ClinicLocationId] IS NOT NULL AND [Status] = 'Active' AND [ExamStatus] = 'InConsultation'");
        // These uniqueness constraints apply only to NEW, initially empty tables.
        m.Entity<ClinicDoctor>().HasIndex(x => x.DoctorId).IsUnique();
        m.Entity<ClinicDoctor>().HasAlternateKey(x => new { x.ClinicLocationId, x.DoctorId });
        m.Entity<ClinicRoom>().HasIndex(x => x.ClinicLocationId).IsUnique();
        m.Entity<ClinicRoom>().HasOne<ClinicDoctor>().WithMany()
            .HasForeignKey(x => new { x.ClinicLocationId, x.ActiveDoctorId })
            .HasPrincipalKey(x => new { x.ClinicLocationId, x.DoctorId });
        Fk<ClinicDoctor, UserAccount>(m, "DoctorId");
        Fk<ClinicDoctor, Location>(m, "ClinicLocationId");
        Fk<ClinicRoom, Location>(m, "ClinicLocationId");
        Fk<Visit, Location>(m, "ClinicLocationId");
        Fk<RegistrationRequest, Department>(m, "PreferredDepartmentId");
        m.Entity<Visit>().Property(x => x.ExamStatus).HasMaxLength(20);
        m.Entity<Visit>().HasIndex(x => new { x.ClinicLocationId, x.Status, x.ExamStatus });
        m.Entity<Visit>().ToTable(t => {
            t.HasCheckConstraint("CK_Visit_ExamStatus", "[ExamStatus] IS NULL OR [ExamStatus] IN ('Waiting','InConsultation','InService','Completed')");
            t.HasCheckConstraint("CK_Visit_ConsultationCount", "[ConsultationCount] IS NULL OR [ConsultationCount] >= 0");
            t.HasCheckConstraint("CK_Visit_ExaminationCompletedAt", "[ExaminationCompletedAt] IS NULL OR ([ExamStatus] IS NOT NULL AND [ExamStatus] = 'Completed')");
        });
        m.Entity<RegistrationRequest>().Property(x => x.SourceLanguage).HasMaxLength(10);
        // Legacy conflicts remain auditable; enforce uniqueness for the new workflow only.
        m.Entity<RegistrationRequest>().HasIndex(x => x.PatientId).IsUnique()
            .HasDatabaseName("UX_Requests_V2PendingPatient")
            .HasFilter("[SourceLanguage] IS NOT NULL AND [Status] = 'Submitted'");
        m.Entity<Visit>().HasIndex(x => x.PatientId).IsUnique()
            .HasDatabaseName("UX_Visits_V2ActivePatient")
            .HasFilter("[ExamStatus] IS NOT NULL AND [Status] = 'Active'");
        m.Entity<AssistanceRequest>().Property(x => x.SourceLanguage).HasMaxLength(10);
        m.Entity<RegistrationRequest>().ToTable(t => t.HasCheckConstraint("CK_Request_SourceLanguage", "[SourceLanguage] IS NULL OR [SourceLanguage] IN ('vi','en','zh','ja')"));
        m.Entity<AssistanceRequest>().ToTable(t => t.HasCheckConstraint("CK_Assistance_SourceLanguage", "[SourceLanguage] IS NULL OR [SourceLanguage] IN ('vi','en','zh','ja')"));
        m.Entity<TicketDailyCounter>().ToTable("TicketDailyCounters", t =>
            t.HasCheckConstraint("CK_TicketDailyCounter_LastNumber", "[LastNumber] > 0"));
        m.Entity<TicketDailyCounter>().HasIndex(x => new { x.ClinicLocationId, x.IssuedOn }).IsUnique();
        Fk<TicketDailyCounter, Location>(m, "ClinicLocationId");
        Fk<ExaminationTicket, Location>(m, "ClinicLocationId");
        m.Entity<ExaminationTicket>().HasIndex(x => new { x.ClinicLocationId, x.IssuedOn, x.SequenceNumber })
            .IsUnique().HasDatabaseName("UX_Ticket_ClinicDateSequence")
            .HasFilter("[ClinicLocationId] IS NOT NULL AND [IssuedOn] IS NOT NULL AND [SequenceNumber] IS NOT NULL");
        m.Entity<ExaminationTicket>().ToTable(t => t.HasCheckConstraint("CK_Ticket_NumberFields",
            "([ClinicLocationId] IS NULL AND [IssuedOn] IS NULL AND [SequenceNumber] IS NULL) OR ([ClinicLocationId] IS NOT NULL AND [IssuedOn] IS NOT NULL AND [SequenceNumber] IS NOT NULL AND [SequenceNumber] > 0)"));
        m.Entity<ExaminationTicket>().Property(x => x.SnapshotSource).HasMaxLength(20).HasDefaultValue("LegacyMissing");
        foreach (var property in new[] { "PatientSnapshot", "ClinicSnapshot", "DoctorSnapshot" })
            m.Entity<ExaminationTicket>().Property<string?>(property).HasColumnType("nvarchar(max)").Metadata.SetMaxLength(null);
        m.Entity<ExaminationTicket>().ToTable(t => {
            t.HasCheckConstraint("CK_Ticket_SnapshotSource", "[SnapshotSource] IN ('LegacyMissing','Captured')");
            t.HasCheckConstraint("CK_Ticket_Snapshots", "([SnapshotSource] = 'LegacyMissing' AND [PatientSnapshot] IS NULL AND [ClinicSnapshot] IS NULL AND [DoctorSnapshot] IS NULL) OR ([SnapshotSource] = 'Captured' AND [PatientSnapshot] IS NOT NULL AND [ClinicSnapshot] IS NOT NULL AND [DoctorSnapshot] IS NOT NULL AND ISJSON([PatientSnapshot]) = 1 AND LEFT(LTRIM(REPLACE(REPLACE(REPLACE([PatientSnapshot], CHAR(9), ''), CHAR(10), ''), CHAR(13), '')), 1) = '{' AND ISJSON([ClinicSnapshot]) = 1 AND LEFT(LTRIM(REPLACE(REPLACE(REPLACE([ClinicSnapshot], CHAR(9), ''), CHAR(10), ''), CHAR(13), '')), 1) = '{' AND ISJSON([DoctorSnapshot]) = 1 AND LEFT(LTRIM(REPLACE(REPLACE(REPLACE([DoctorSnapshot], CHAR(9), ''), CHAR(10), ''), CHAR(13), '')), 1) = '{')");
        });
        m.Entity<UserAccount>().Property(x => x.Email).HasMaxLength(254);
        m.Entity<UserAccount>().HasIndex(x => x.PatientId).IsUnique().HasFilter("[PatientId] IS NOT NULL");
        m.Entity<Session>().HasIndex(x => x.TokenHash).IsUnique();
        m.Entity<Session>().Property(x => x.TokenHash).HasMaxLength(64);
        m.Entity<ExternalIdentity>().Property(x => x.Provider).HasMaxLength(80);
        m.Entity<ExternalIdentity>().Property(x => x.Reference).HasMaxLength(150);
        m.Entity<ExternalIdentity>().HasIndex(x => new { x.Provider, x.Reference }).IsUnique();
        m.Entity<Appointment>().Property(x => x.Reference).HasMaxLength(150);
        m.Entity<Appointment>().Property(x => x.Provider).HasMaxLength(80);
        m.Entity<Appointment>().HasIndex(x => new { x.Provider, x.Reference }).IsUnique();
        m.Entity<RegistrationRequest>().HasIndex(x => new { x.PatientId, x.CreatedAt });
        m.Entity<RegistrationRequest>().HasIndex(x => x.AppointmentId).IsUnique().HasFilter("[AppointmentId] IS NOT NULL");
        m.Entity<ReceptionRecord>().HasIndex(x => x.RegistrationRequestId).IsUnique();
        m.Entity<Visit>().HasIndex(x => x.ReceptionRecordId).IsUnique();
        m.Entity<Visit>().HasIndex(x => new { x.PatientId, x.CreatedAt });
        m.Entity<Visit>().HasIndex(x => new { x.DoctorId, x.Status });
        m.Entity<Visit>().HasOne(x => x.Journey).WithOne().HasForeignKey<PatientJourney>(x => x.VisitId);
        m.Entity<Visit>().HasOne(x => x.Ticket).WithOne().HasForeignKey<ExaminationTicket>(x => x.VisitId);
        m.Entity<QrCode>().HasIndex(x => x.Hash).IsUnique();
        m.Entity<QrCode>().Property(x => x.Hash).HasMaxLength(64);
        m.Entity<QrCode>().ToTable(t => t.HasCheckConstraint("CK_QR_Purpose", "([Purpose] = 'Reception' AND [RegistrationRequestId] IS NOT NULL AND [ExaminationTicketId] IS NULL) OR ([Purpose] = 'Ticket' AND [ExaminationTicketId] IS NOT NULL AND [RegistrationRequestId] IS NULL)"));
        m.Entity<Visit>().ToTable(t => t.HasCheckConstraint("CK_Visit_Status", "[Status] IN ('Active','Closed')"));
        m.Entity<PatientJourney>().ToTable(t => t.HasCheckConstraint("CK_Journey_Status", "[Status] IN ('PendingActivation','Active','Completed')"));
        m.Entity<JourneyStep>().ToTable(t => t.HasCheckConstraint("CK_Step_Status", "[Status] IN ('Waiting','Ready','InProgress','Completed','Skipped','Cancelled')"));
        m.Entity<AccessGrant>().HasIndex(x => new { x.SessionId, x.VisitId }).IsUnique();
        m.Entity<StepDependency>().HasIndex(x => new { x.JourneyStepId, x.PrerequisiteStepId }).IsUnique();
        m.Entity<StaffScope>().HasIndex(x => new { x.UserAccountId, x.DepartmentId }).IsUnique();
        m.Entity<Department>().HasIndex(x => x.Code).IsUnique();
        m.Entity<HospitalService>().HasIndex(x => x.Code).IsUnique();
        m.Entity<WorkflowMapping>().HasIndex(x => new { x.HospitalServiceId, x.Revision }).IsUnique();
        m.Entity<GuidanceTemplate>().Property(x => x.Key).HasMaxLength(100);
        m.Entity<GuidanceTemplate>().Property(x => x.Language).HasMaxLength(10);
        m.Entity<GuidanceTemplate>().HasIndex(x => new { x.Key, x.Language, x.Revision }).IsUnique();
        m.Entity<SummaryVersion>().HasIndex(x => new { x.VisitId, x.Revision }).IsUnique();
        m.Entity<SummaryVersion>().ToTable(t => t.HasCheckConstraint("CK_Summary_Source", "[Language] = 'vi'"));
        m.Entity<FollowUpRecommendation>().ToTable(t => t.HasCheckConstraint("CK_FollowUp_Source", "[Language] = 'vi'"));
        m.Entity<GuidanceTemplate>().ToTable(t => t.HasCheckConstraint("CK_Template_Source", "[Language] = 'vi'"));
        m.Entity<HospitalRoute>().ToTable(t => t.HasCheckConstraint("CK_Route_Source", "[Language] = 'vi'"));
        m.Entity<ReceptionMessage>().ToTable(t => t.HasCheckConstraint("CK_Message_Source", "[Language] = 'vi'"));
        m.Entity<AuditEvent>().Property(x => x.Source).HasMaxLength(100);
        m.Entity<AuditEvent>().Property(x => x.SourceEventId).HasMaxLength(200);
        m.Entity<AuditEvent>().HasIndex(x => new { x.Source, x.SourceEventId }).IsUnique();
        m.Entity<CommandReceipt>().Property(x => x.Scope).HasMaxLength(280);
        m.Entity<CommandReceipt>().Property(x => x.Key).HasMaxLength(100);
        m.Entity<CommandReceipt>().HasIndex(x => new { x.Scope, x.Key }).IsUnique();
        m.Entity<CommandReceipt>().Property(x => x.ResponseJson).HasColumnType("nvarchar(max)").Metadata.SetMaxLength(null);

        // Explicit foreign keys, including provenance and security subjects.
        Fk<UserAccount, Patient>(m, "PatientId");
        Fk<Session, Patient>(m, "PatientId");
        Fk<Session, UserAccount>(m, "UserAccountId", "UserAccount");
        Fk<StaffScope, Department>(m, "DepartmentId");
        Fk<AccessGrant, Session>(m, "SessionId"); Fk<AccessGrant, Visit>(m, "VisitId");
        Fk<LinkClaim, Session>(m, "SessionId"); Fk<LinkClaim, Visit>(m, "ReturnVisitId");
        Fk<RecoveryClaim, Patient>(m, "PatientId"); Fk<RecoveryClaim, Visit>(m, "VisitId");
        Fk<ExternalIdentity, Patient>(m, "PatientId");
        Fk<Appointment, Patient>(m, "PatientId"); Fk<Appointment, Department>(m, "DepartmentId");
        Fk<RegistrationRequest, Session>(m, "SessionId"); Fk<RegistrationRequest, Department>(m, "DepartmentId");
        Fk<ReceptionMessage, GuidanceTemplate>(m, "TemplateId");
        Fk<ReceptionRecord, RegistrationRequest>(m, "RegistrationRequestId");
        Fk<ReceptionRecord, Patient>(m, "PatientId"); Fk<ReceptionRecord, UserAccount>(m, "ConfirmedBy");
        Fk<Visit, ReceptionRecord>(m, "ReceptionRecordId"); Fk<Visit, Appointment>(m, "AppointmentId");
        Fk<Visit, Department>(m, "DepartmentId"); Fk<Visit, UserAccount>(m, "DoctorId");
        Fk<QrCode, RegistrationRequest>(m, "RegistrationRequestId"); Fk<QrCode, ExaminationTicket>(m, "ExaminationTicketId");
        Fk<JourneyStep, DoctorOrder>(m, "DoctorOrderId"); Fk<JourneyStep, HospitalService>(m, "HospitalServiceId");
        Fk<JourneyStep, Location>(m, "LocationId"); Fk<JourneyStep, Department>(m, "DepartmentId");
        Fk<StepDependency, JourneyStep>(m, "PrerequisiteStepId");
        Fk<DoctorOrder, HospitalService>(m, "HospitalServiceId"); Fk<DoctorOrder, UserAccount>(m, "OrderedBy");
        Fk<Location, Department>(m, "DepartmentId");
        Fk<HospitalService, Location>(m, "LocationId"); Fk<HospitalService, Department>(m, "DepartmentId");
        Fk<WorkflowMapping, HospitalService>(m, "HospitalServiceId");
        Fk<HospitalRoute, Location>(m, "FromLocationId"); Fk<HospitalRoute, Location>(m, "ToLocationId");
        Fk<SummaryVersion, Visit>(m, "VisitId"); Fk<SummaryVersion, UserAccount>(m, "AuthorId");
        Fk<FollowUpRecommendation, Visit>(m, "VisitId"); Fk<FollowUpRecommendation, Department>(m, "DepartmentId"); Fk<FollowUpRecommendation, UserAccount>(m, "AuthorId");
        Fk<AssistanceRequest, Patient>(m, "PatientId"); Fk<AssistanceRequest, Session>(m, "SessionId");
        Fk<AssistanceRequest, Visit>(m, "VisitId"); Fk<AssistanceRequest, RegistrationRequest>(m, "RegistrationRequestId");
        Fk<AssistanceRequest, JourneyStep>(m, "JourneyStepId"); Fk<AssistanceRequest, Department>(m, "DepartmentId");
        Fk<Notification, Patient>(m, "PatientId"); Fk<Notification, Visit>(m, "VisitId");
        Fk<AuditEvent, Visit>(m, "VisitId");
        foreach (var fk in m.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys())) fk.DeleteBehavior = DeleteBehavior.Restrict;
    }
    static void Fk<T, P>(ModelBuilder m, string key, string? nav = null) where T : class where P : class =>
        m.Entity<T>().HasOne(typeof(P), nav).WithMany().HasForeignKey(key);

    static void ConfigureClinicalCatalog(ModelBuilder m)
    {
        foreach (var type in new[] { typeof(SymptomCatalog), typeof(DiagnosisCatalog), typeof(ClinicalTemplate) })
        {
            var e = m.Entity(type);
            e.Property("Code").HasMaxLength(40); e.Property("NameVi").HasMaxLength(200);
            e.HasIndex("Code").IsUnique();
            e.ToTable(t => t.HasCheckConstraint($"CK_{type.Name}_Code", "LEN([Code]) BETWEEN 2 AND 40 AND [Code] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^-A-Z0-9_]%' AND [Code] COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]%'") );
            e.ToTable(t => t.HasCheckConstraint($"CK_{type.Name}_Name", "LEN(LTRIM(RTRIM([NameVi]))) >= 2 AND [Version] > 0"));
        }
        m.Entity<SymptomCatalog>().Property(x => x.Kind).HasMaxLength(10);
        m.Entity<SymptomCatalog>().HasAlternateKey(x => new { x.Id, x.Kind });
        m.Entity<SymptomCatalog>().ToTable(t => t.HasCheckConstraint("CK_SymptomCatalog_Kind", "[Kind] IN ('Symptom','Sign')"));
        m.Entity<ClinicalTemplate>().Property(x => x.DiagnosisTemplate).HasMaxLength(4000);
        m.Entity<ClinicalTemplate>().Property(x => x.ExplanationTemplate).HasMaxLength(4000);
        m.Entity<ClinicalTemplate>().Property(x => x.InstructionsTemplate).HasMaxLength(6000);
        m.Entity<ClinicalTemplate>().Property(x => x.Language).HasMaxLength(10);
        m.Entity<ClinicalTemplate>().ToTable(t => {
            t.HasCheckConstraint("CK_ClinicalTemplate_Source", "[Language] = 'vi'");
            t.HasCheckConstraint("CK_ClinicalTemplate_Content", "LEN(LTRIM(RTRIM([DiagnosisTemplate]))) > 0 AND LEN(LTRIM(RTRIM([InstructionsTemplate]))) > 0");
        });
        m.Entity<ClinicalRecord>().HasIndex(x => x.VisitId).IsUnique();
        m.Entity<ClinicalRecord>().Property(x => x.TemplateSnapshot).HasColumnType("nvarchar(max)").Metadata.SetMaxLength(null);
        m.Entity<ClinicalRecord>().Property(x => x.Diagnosis).HasMaxLength(4000);
        m.Entity<ClinicalRecord>().Property(x => x.Explanation).HasMaxLength(4000);
        m.Entity<ClinicalRecord>().Property(x => x.Instructions).HasMaxLength(6000);
        m.Entity<ClinicalRecord>().Property(x => x.Language).HasMaxLength(10);
        m.Entity<ClinicalRecord>().ToTable(t => {
            t.HasCheckConstraint("CK_ClinicalRecord_Source", "[Language] = 'vi'");
            t.HasCheckConstraint("CK_ClinicalRecord_Snapshot", "[TemplateVersion] > 0 AND ISJSON([TemplateSnapshot]) = 1");
            t.HasCheckConstraint("CK_ClinicalRecord_Content", "LEN(LTRIM(RTRIM([Diagnosis]))) > 0 AND LEN(LTRIM(RTRIM([Instructions]))) > 0 AND LEN(LTRIM(RTRIM([AuthorName]))) > 0 AND [PublishedAt] >= [ConfirmedAt]");
        });
        Fk<ClinicalRecord, Visit>(m, "VisitId"); Fk<ClinicalRecord, UserAccount>(m, "AuthorId"); Fk<ClinicalRecord, ClinicalTemplate>(m, "TemplateId");
        m.Entity<ClinicalRecord>().HasMany(x => x.Symptoms).WithOne().HasForeignKey(x => x.ClinicalRecordId);
        m.Entity<ClinicalRecord>().HasMany(x => x.Diagnoses).WithOne().HasForeignKey(x => x.ClinicalRecordId);
        m.Entity<ClinicalSymptom>().HasOne<SymptomCatalog>().WithMany().HasForeignKey(x => new { x.SymptomCatalogId, x.Kind }).HasPrincipalKey(x => new { x.Id, x.Kind });
        Fk<ClinicalDiagnosis, DiagnosisCatalog>(m, "DiagnosisCatalogId");
        m.Entity<ClinicalSymptom>().HasIndex(x => new { x.ClinicalRecordId, x.SymptomCatalogId }).IsUnique();
        m.Entity<ClinicalDiagnosis>().HasIndex(x => new { x.ClinicalRecordId, x.DiagnosisCatalogId }).IsUnique();
        m.Entity<ClinicalSymptom>().Property(x => x.Kind).HasMaxLength(10);
        foreach (var type in new[] { typeof(ClinicalSymptom), typeof(ClinicalDiagnosis) })
        {
            var e = m.Entity(type); e.Property("CodeSnapshot").HasMaxLength(40); e.Property("NameViSnapshot").HasMaxLength(200);
            e.ToTable(t => t.HasCheckConstraint($"CK_{type.Name}_Snapshot", "[CatalogVersion] > 0 AND LEN(LTRIM(RTRIM([CodeSnapshot]))) >= 2 AND LEN(LTRIM(RTRIM([NameViSnapshot]))) >= 2"));
        }
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var e in ChangeTracker.Entries<Entity>().Where(e => e.State == EntityState.Modified)) e.Entity.Version++;
        return base.SaveChangesAsync(ct);
    }
    public IQueryable<Visit> FullVisits() => Visits.Include(v => v.Patient).Include(v => v.Ticket)
        .Include(v => v.Journey).ThenInclude(j => j.Steps).ThenInclude(s => s.Dependencies).Include(v => v.Orders).AsSplitQuery();
}
