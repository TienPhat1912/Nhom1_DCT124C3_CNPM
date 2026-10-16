using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HospitalVisitApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    GuestSessionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    TitleVi = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    TitleEn = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    BodyVi = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    BodyEn = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    RelatedVisitId = table.Column<Guid>(type: "TEXT", nullable: true),
                    RelatedStepId = table.Column<Guid>(type: "TEXT", nullable: true),
                    IsRead = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppNotifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    NameVi = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Floor = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    Room = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    Building = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuidanceTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TemplateKey = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    ContentVi = table.Column<string>(type: "TEXT", nullable: false),
                    ContentEn = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuidanceTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    FullName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    Role = table.Column<int>(type: "INTEGER", nullable: false),
                    StaffScope = table.Column<string>(type: "TEXT", nullable: true),
                    PreferredLanguage = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HospitalServices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    NameVi = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    StepType = table.Column<int>(type: "INTEGER", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HospitalServices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HospitalServices_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GuestSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Token = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    PreferredLanguage = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    LinkedUserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsConsumed = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuestSessions_Users_LinkedUserId",
                        column: x => x.LinkedUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ServiceStepMappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StepType = table.Column<int>(type: "INTEGER", nullable: false),
                    PrerequisiteServiceIds = table.Column<string>(type: "TEXT", nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    DestinationVi = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    DestinationEn = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    DestinationDepartmentId = table.Column<Guid>(type: "TEXT", nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceStepMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceStepMappings_HospitalServices_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "HospitalServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GuestConversionContexts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    GuestSessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ContinuationToken = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ReturnTarget = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    IsConsumed = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestConversionContexts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuestConversionContexts_GuestSessions_GuestSessionId",
                        column: x => x.GuestSessionId,
                        principalTable: "GuestSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Patients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    GuestSessionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    FullName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    DateOfBirth = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Gender = table.Column<string>(type: "TEXT", maxLength: 10, nullable: true),
                    Address = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    InsuranceNumber = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    PreferredLanguage = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Patients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Patients_GuestSessions_GuestSessionId",
                        column: x => x.GuestSessionId,
                        principalTable: "GuestSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Patients_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "RegistrationRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PatientId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GuestSessionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Source = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    AppointmentId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    DepartmentId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ConditionDescription = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    SupplementInfo = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    StaffQuestion = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    ReceptionQrToken = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrationRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegistrationRequests_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RegistrationRequests_GuestSessions_GuestSessionId",
                        column: x => x.GuestSessionId,
                        principalTable: "GuestSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RegistrationRequests_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Visits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PatientId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                    GuestSessionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    RegistrationRequestId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AssignedDoctorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ConfirmedByStaffId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TicketNumber = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    TicketQrToken = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ClinicalReadiness = table.Column<bool>(type: "INTEGER", nullable: false),
                    FinalSettlementConfirmed = table.Column<bool>(type: "INTEGER", nullable: false),
                    SettlementType = table.Column<int>(type: "INTEGER", nullable: true),
                    RequiresPharmacy = table.Column<bool>(type: "INTEGER", nullable: false),
                    ClosureReason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Visits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Visits_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_GuestSessions_GuestSessionId",
                        column: x => x.GuestSessionId,
                        principalTable: "GuestSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Visits_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_RegistrationRequests_RegistrationRequestId",
                        column: x => x.RegistrationRequestId,
                        principalTable: "RegistrationRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_Users_AssignedDoctorId",
                        column: x => x.AssignedDoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Visits_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "AssistanceRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PatientId = table.Column<Guid>(type: "TEXT", nullable: true),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: true),
                    GuestSessionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Category = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    AssignedStaffId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Resolution = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssistanceRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssistanceRequests_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AssistanceRequests_Users_AssignedStaffId",
                        column: x => x.AssignedStaffId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AssistanceRequests_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "DiagnosisSummaries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DoctorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    DiagnosisVi = table.Column<string>(type: "TEXT", nullable: true),
                    DiagnosisEn = table.Column<string>(type: "TEXT", nullable: true),
                    ExplanationVi = table.Column<string>(type: "TEXT", nullable: true),
                    ExplanationEn = table.Column<string>(type: "TEXT", nullable: true),
                    CareInstructionsVi = table.Column<string>(type: "TEXT", nullable: true),
                    CareInstructionsEn = table.Column<string>(type: "TEXT", nullable: true),
                    EnTranslationApproved = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiagnosisSummaries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DiagnosisSummaries_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DiagnosisSummaries_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DoctorOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DoctorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    IsRequired = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsCancelled = table.Column<bool>(type: "INTEGER", nullable: false),
                    CancellationReason = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoctorOrders_HospitalServices_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "HospitalServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DoctorOrders_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DoctorOrders_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FollowUpRecommendations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    DoctorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RecommendationVi = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    RecommendationEn = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    SuggestedTimeframe = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    IsBookingConfirmed = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FollowUpRecommendations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FollowUpRecommendations_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FollowUpRecommendations_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Journeys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletionSource = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Journeys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Journeys_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SettlementRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    RecordedByStaffId = table.Column<Guid>(type: "TEXT", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: true),
                    IsCurrentlyValid = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SettlementRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SettlementRecords_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VisitEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VisitId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EventType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Source = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    SourceEventId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    ActorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Details = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VisitEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VisitEvents_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "JourneySteps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    JourneyId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StepType = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    DoctorOrderId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: true),
                    DestinationDepartmentId = table.Column<Guid>(type: "TEXT", nullable: true),
                    DestinationVi = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    DestinationEn = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    InstructionVi = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    InstructionEn = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    PrerequisiteStepIds = table.Column<string>(type: "TEXT", nullable: true),
                    QueueTicket = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    QueueUpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedByStaffId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CompletedByPatientId = table.Column<Guid>(type: "TEXT", nullable: true),
                    StatusReason = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JourneySteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_JourneySteps_Departments_DestinationDepartmentId",
                        column: x => x.DestinationDepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_JourneySteps_DoctorOrders_DoctorOrderId",
                        column: x => x.DoctorOrderId,
                        principalTable: "DoctorOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_JourneySteps_HospitalServices_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "HospitalServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_JourneySteps_Journeys_JourneyId",
                        column: x => x.JourneyId,
                        principalTable: "Journeys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppNotifications_GuestSessionId",
                table: "AppNotifications",
                column: "GuestSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_AppNotifications_UserId",
                table: "AppNotifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequests_AssignedStaffId",
                table: "AssistanceRequests",
                column: "AssignedStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequests_PatientId",
                table: "AssistanceRequests",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequests_VisitId",
                table: "AssistanceRequests",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_DiagnosisSummaries_DoctorId",
                table: "DiagnosisSummaries",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_DiagnosisSummaries_VisitId_Version",
                table: "DiagnosisSummaries",
                columns: new[] { "VisitId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrders_DoctorId",
                table: "DoctorOrders",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrders_ServiceId",
                table: "DoctorOrders",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrders_VisitId",
                table: "DoctorOrders",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_FollowUpRecommendations_DoctorId",
                table: "FollowUpRecommendations",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_FollowUpRecommendations_VisitId",
                table: "FollowUpRecommendations",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestConversionContexts_ContinuationToken",
                table: "GuestConversionContexts",
                column: "ContinuationToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuestConversionContexts_GuestSessionId",
                table: "GuestConversionContexts",
                column: "GuestSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestSessions_LinkedUserId",
                table: "GuestSessions",
                column: "LinkedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestSessions_Token",
                table: "GuestSessions",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HospitalServices_DepartmentId",
                table: "HospitalServices",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Journeys_VisitId",
                table: "Journeys",
                column: "VisitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_JourneySteps_DestinationDepartmentId",
                table: "JourneySteps",
                column: "DestinationDepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneySteps_DoctorOrderId",
                table: "JourneySteps",
                column: "DoctorOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneySteps_JourneyId",
                table: "JourneySteps",
                column: "JourneyId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneySteps_ServiceId",
                table: "JourneySteps",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Patients_GuestSessionId",
                table: "Patients",
                column: "GuestSessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Patients_UserId",
                table: "Patients",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationRequests_DepartmentId",
                table: "RegistrationRequests",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationRequests_GuestSessionId",
                table: "RegistrationRequests",
                column: "GuestSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationRequests_PatientId",
                table: "RegistrationRequests",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationRequests_ReceptionQrToken",
                table: "RegistrationRequests",
                column: "ReceptionQrToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceStepMappings_ServiceId",
                table: "ServiceStepMappings",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_SettlementRecords_IdempotencyKey",
                table: "SettlementRecords",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SettlementRecords_VisitId",
                table: "SettlementRecords",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VisitEvents_Source_SourceEventId",
                table: "VisitEvents",
                columns: new[] { "Source", "SourceEventId" },
                unique: true,
                filter: "[SourceEventId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_VisitEvents_VisitId",
                table: "VisitEvents",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_AssignedDoctorId",
                table: "Visits",
                column: "AssignedDoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_DepartmentId",
                table: "Visits",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_GuestSessionId",
                table: "Visits",
                column: "GuestSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_PatientId",
                table: "Visits",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_RegistrationRequestId",
                table: "Visits",
                column: "RegistrationRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Visits_TicketNumber",
                table: "Visits",
                column: "TicketNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_TicketQrToken",
                table: "Visits",
                column: "TicketQrToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Visits_UserId",
                table: "Visits",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppNotifications");

            migrationBuilder.DropTable(
                name: "AssistanceRequests");

            migrationBuilder.DropTable(
                name: "DiagnosisSummaries");

            migrationBuilder.DropTable(
                name: "FollowUpRecommendations");

            migrationBuilder.DropTable(
                name: "GuestConversionContexts");

            migrationBuilder.DropTable(
                name: "GuidanceTemplates");

            migrationBuilder.DropTable(
                name: "JourneySteps");

            migrationBuilder.DropTable(
                name: "ServiceStepMappings");

            migrationBuilder.DropTable(
                name: "SettlementRecords");

            migrationBuilder.DropTable(
                name: "VisitEvents");

            migrationBuilder.DropTable(
                name: "DoctorOrders");

            migrationBuilder.DropTable(
                name: "Journeys");

            migrationBuilder.DropTable(
                name: "HospitalServices");

            migrationBuilder.DropTable(
                name: "Visits");

            migrationBuilder.DropTable(
                name: "RegistrationRequests");

            migrationBuilder.DropTable(
                name: "Departments");

            migrationBuilder.DropTable(
                name: "Patients");

            migrationBuilder.DropTable(
                name: "GuestSessions");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
