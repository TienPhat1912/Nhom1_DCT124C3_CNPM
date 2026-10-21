using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommandReceipt",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Scope = table.Column<string>(type: "nvarchar(280)", maxLength: 280, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RequestHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ResponseJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommandReceipt", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Department",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NameVi = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Department", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuidanceTemplate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Revision = table.Column<int>(type: "int", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ApprovedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuidanceTemplate", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Patients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Contact = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Patients", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Location",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NameVi = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Building = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Floor = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Room = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Location", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Location_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Appointment",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Appointment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Appointment_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Appointment_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExternalIdentity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalIdentity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExternalIdentity_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HospitalRoute",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromLocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ToLocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Instructions = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HospitalRoute", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HospitalRoute_Location_FromLocationId",
                        column: x => x.FromLocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HospitalRoute_Location_ToLocationId",
                        column: x => x.ToLocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HospitalService",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NameVi = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    ReturnRequired = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HospitalService", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HospitalService_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HospitalService_Location_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsGuest = table.Column<bool>(type: "bit", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Revoked = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Sessions_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sessions_Users_UserAccountId",
                        column: x => x.UserAccountId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StaffScope",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserAccountId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffScope", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffScope_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StaffScope_Users_UserAccountId",
                        column: x => x.UserAccountId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowMapping",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HospitalServiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Revision = table.Column<int>(type: "int", nullable: false),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    StepsJson = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowMapping", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowMapping_HospitalService_HospitalServiceId",
                        column: x => x.HospitalServiceId,
                        principalTable: "HospitalService",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Contact = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Requests = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Requests_Appointment_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Appointment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Requests_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Requests_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Requests_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReceptionMessage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Response = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReceptionMessage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReceptionMessage_GuidanceTemplate_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "GuidanceTemplate",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReceptionMessage_Requests_RegistrationRequestId",
                        column: x => x.RegistrationRequestId,
                        principalTable: "Requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReceptionRecord",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConfirmedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VerificationNote = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReceptionRecord", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReceptionRecord_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReceptionRecord_Requests_RegistrationRequestId",
                        column: x => x.RegistrationRequestId,
                        principalTable: "Requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReceptionRecord_Users_ConfirmedBy",
                        column: x => x.ConfirmedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Visits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReceptionRecordId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    WorkRevision = table.Column<int>(type: "int", nullable: false),
                    FinalSettlementRevision = table.Column<int>(type: "int", nullable: true),
                    FinalSettlementOutcome = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Visits", x => x.Id);
                    table.CheckConstraint("CK_Visit_Status", "[Status] IN ('Active','Closed')");
                    table.ForeignKey(
                        name: "FK_Visits_Appointment_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Appointment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_ReceptionRecord_ReceptionRecordId",
                        column: x => x.ReceptionRecordId,
                        principalTable: "ReceptionRecord",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Visits_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AccessGrant",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessGrant", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccessGrant_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AccessGrant_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AuditEvent",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SourceEventId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEvent", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditEvent_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DoctorOrder",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HospitalServiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    MappingVersion = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorOrder", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoctorOrder_HospitalService_HospitalServiceId",
                        column: x => x.HospitalServiceId,
                        principalTable: "HospitalService",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DoctorOrder_Users_OrderedBy",
                        column: x => x.OrderedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DoctorOrder_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExaminationTicket",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Number = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExaminationTicket", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExaminationTicket_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FollowUpRecommendation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecommendedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FollowUpRecommendation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FollowUpRecommendation_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FollowUpRecommendation_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FollowUpRecommendation_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LinkClaim",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Hash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Consumed = table.Column<bool>(type: "bit", nullable: false),
                    ReturnVisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LinkClaim", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LinkClaim_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LinkClaim_Visits_ReturnVisitId",
                        column: x => x.ReturnVisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notification",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Key = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Read = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notification", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notification_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Notification_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PatientJourney",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletionSource = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientJourney", x => x.Id);
                    table.CheckConstraint("CK_Journey_Status", "[Status] IN ('PendingActivation','Active','Completed')");
                    table.ForeignKey(
                        name: "FK_PatientJourney_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RecoveryClaim",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Hash = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Consumed = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecoveryClaim", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecoveryClaim_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RecoveryClaim_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SummaryVersion",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Revision = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Diagnosis = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Instructions = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    DocumentReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SummaryVersion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SummaryVersion_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SummaryVersion_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QrCode",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ProtectedToken = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Purpose = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    RegistrationRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ExaminationTicketId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QrCode", x => x.Id);
                    table.CheckConstraint("CK_QR_Purpose", "([Purpose] = 'Reception' AND [RegistrationRequestId] IS NOT NULL AND [ExaminationTicketId] IS NULL) OR ([Purpose] = 'Ticket' AND [ExaminationTicketId] IS NOT NULL AND [RegistrationRequestId] IS NULL)");
                    table.ForeignKey(
                        name: "FK_QrCode_ExaminationTicket_ExaminationTicketId",
                        column: x => x.ExaminationTicketId,
                        principalTable: "ExaminationTicket",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_QrCode_Requests_RegistrationRequestId",
                        column: x => x.RegistrationRequestId,
                        principalTable: "Requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "JourneyStep",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientJourneyId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DoctorOrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    HospitalServiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DestinationSnapshot = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Authority = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    TemplateKey = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    MappingVersion = table.Column<int>(type: "int", nullable: false),
                    QueueNumber = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    QueueStatus = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    QueueUpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResolutionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JourneyStep", x => x.Id);
                    table.CheckConstraint("CK_Step_Status", "[Status] IN ('Waiting','Ready','InProgress','Completed','Skipped','Cancelled')");
                    table.ForeignKey(
                        name: "FK_JourneyStep_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_JourneyStep_DoctorOrder_DoctorOrderId",
                        column: x => x.DoctorOrderId,
                        principalTable: "DoctorOrder",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_JourneyStep_HospitalService_HospitalServiceId",
                        column: x => x.HospitalServiceId,
                        principalTable: "HospitalService",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_JourneyStep_Location_LocationId",
                        column: x => x.LocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_JourneyStep_PatientJourney_PatientJourneyId",
                        column: x => x.PatientJourneyId,
                        principalTable: "PatientJourney",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SummaryTranslation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SummaryVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Diagnosis = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Instructions = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Approved = table.Column<bool>(type: "bit", nullable: false),
                    ApprovedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SummaryTranslation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SummaryTranslation_SummaryVersion_SummaryVersionId",
                        column: x => x.SummaryVersionId,
                        principalTable: "SummaryVersion",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SummaryTranslation_Users_ApprovedBy",
                        column: x => x.ApprovedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssistanceRequest",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PatientId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RegistrationRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    JourneyStepId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Resolution = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    HandledBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Escalated = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssistanceRequest", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssistanceRequest_Department_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Department",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssistanceRequest_JourneyStep_JourneyStepId",
                        column: x => x.JourneyStepId,
                        principalTable: "JourneyStep",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssistanceRequest_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssistanceRequest_Requests_RegistrationRequestId",
                        column: x => x.RegistrationRequestId,
                        principalTable: "Requests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssistanceRequest_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssistanceRequest_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StepDependency",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    JourneyStepId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PrerequisiteStepId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StepDependency", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StepDependency_JourneyStep_JourneyStepId",
                        column: x => x.JourneyStepId,
                        principalTable: "JourneyStep",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StepDependency_JourneyStep_PrerequisiteStepId",
                        column: x => x.PrerequisiteStepId,
                        principalTable: "JourneyStep",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessGrant_SessionId_VisitId",
                table: "AccessGrant",
                columns: new[] { "SessionId", "VisitId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AccessGrant_VisitId",
                table: "AccessGrant",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointment_DepartmentId",
                table: "Appointment",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointment_PatientId",
                table: "Appointment",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointment_Provider_Reference",
                table: "Appointment",
                columns: new[] { "Provider", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequest_DepartmentId",
                table: "AssistanceRequest",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequest_JourneyStepId",
                table: "AssistanceRequest",
                column: "JourneyStepId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequest_PatientId",
                table: "AssistanceRequest",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequest_RegistrationRequestId",
                table: "AssistanceRequest",
                column: "RegistrationRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequest_SessionId",
                table: "AssistanceRequest",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_AssistanceRequest_VisitId",
                table: "AssistanceRequest",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvent_Source_SourceEventId",
                table: "AuditEvent",
                columns: new[] { "Source", "SourceEventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvent_VisitId",
                table: "AuditEvent",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_CommandReceipt_Scope_Key",
                table: "CommandReceipt",
                columns: new[] { "Scope", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Department_Code",
                table: "Department",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrder_HospitalServiceId",
                table: "DoctorOrder",
                column: "HospitalServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrder_OrderedBy",
                table: "DoctorOrder",
                column: "OrderedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrder_VisitId",
                table: "DoctorOrder",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_ExaminationTicket_VisitId",
                table: "ExaminationTicket",
                column: "VisitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExternalIdentity_PatientId",
                table: "ExternalIdentity",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_ExternalIdentity_Provider_Reference",
                table: "ExternalIdentity",
                columns: new[] { "Provider", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FollowUpRecommendation_AuthorId",
                table: "FollowUpRecommendation",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_FollowUpRecommendation_DepartmentId",
                table: "FollowUpRecommendation",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_FollowUpRecommendation_VisitId",
                table: "FollowUpRecommendation",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_GuidanceTemplate_Key_Language_Revision",
                table: "GuidanceTemplate",
                columns: new[] { "Key", "Language", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HospitalRoute_FromLocationId",
                table: "HospitalRoute",
                column: "FromLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_HospitalRoute_ToLocationId",
                table: "HospitalRoute",
                column: "ToLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_HospitalService_Code",
                table: "HospitalService",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HospitalService_DepartmentId",
                table: "HospitalService",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_HospitalService_LocationId",
                table: "HospitalService",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneyStep_DepartmentId",
                table: "JourneyStep",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneyStep_DoctorOrderId",
                table: "JourneyStep",
                column: "DoctorOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneyStep_HospitalServiceId",
                table: "JourneyStep",
                column: "HospitalServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneyStep_LocationId",
                table: "JourneyStep",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_JourneyStep_PatientJourneyId",
                table: "JourneyStep",
                column: "PatientJourneyId");

            migrationBuilder.CreateIndex(
                name: "IX_LinkClaim_ReturnVisitId",
                table: "LinkClaim",
                column: "ReturnVisitId");

            migrationBuilder.CreateIndex(
                name: "IX_LinkClaim_SessionId",
                table: "LinkClaim",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Location_DepartmentId",
                table: "Location",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Notification_PatientId",
                table: "Notification",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_Notification_VisitId",
                table: "Notification",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientJourney_VisitId",
                table: "PatientJourney",
                column: "VisitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QrCode_ExaminationTicketId",
                table: "QrCode",
                column: "ExaminationTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_QrCode_Hash",
                table: "QrCode",
                column: "Hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QrCode_RegistrationRequestId",
                table: "QrCode",
                column: "RegistrationRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceptionMessage_RegistrationRequestId",
                table: "ReceptionMessage",
                column: "RegistrationRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceptionMessage_TemplateId",
                table: "ReceptionMessage",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceptionRecord_ConfirmedBy",
                table: "ReceptionRecord",
                column: "ConfirmedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ReceptionRecord_PatientId",
                table: "ReceptionRecord",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_ReceptionRecord_RegistrationRequestId",
                table: "ReceptionRecord",
                column: "RegistrationRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RecoveryClaim_PatientId",
                table: "RecoveryClaim",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_RecoveryClaim_VisitId",
                table: "RecoveryClaim",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_AppointmentId",
                table: "Requests",
                column: "AppointmentId",
                unique: true,
                filter: "[AppointmentId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_DepartmentId",
                table: "Requests",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_PatientId_CreatedAt",
                table: "Requests",
                columns: new[] { "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Requests_SessionId",
                table: "Requests",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_PatientId",
                table: "Sessions",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_TokenHash",
                table: "Sessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_UserAccountId",
                table: "Sessions",
                column: "UserAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffScope_DepartmentId",
                table: "StaffScope",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffScope_UserAccountId_DepartmentId",
                table: "StaffScope",
                columns: new[] { "UserAccountId", "DepartmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StepDependency_JourneyStepId_PrerequisiteStepId",
                table: "StepDependency",
                columns: new[] { "JourneyStepId", "PrerequisiteStepId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StepDependency_PrerequisiteStepId",
                table: "StepDependency",
                column: "PrerequisiteStepId");

            migrationBuilder.CreateIndex(
                name: "IX_SummaryTranslation_ApprovedBy",
                table: "SummaryTranslation",
                column: "ApprovedBy");

            migrationBuilder.CreateIndex(
                name: "IX_SummaryTranslation_SummaryVersionId_Language",
                table: "SummaryTranslation",
                columns: new[] { "SummaryVersionId", "Language" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SummaryVersion_AuthorId",
                table: "SummaryVersion",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_SummaryVersion_VisitId_Revision",
                table: "SummaryVersion",
                columns: new[] { "VisitId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_PatientId",
                table: "Users",
                column: "PatientId",
                unique: true,
                filter: "[PatientId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_AppointmentId",
                table: "Visits",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_DepartmentId",
                table: "Visits",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_DoctorId_Status",
                table: "Visits",
                columns: new[] { "DoctorId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Visits_PatientId_CreatedAt",
                table: "Visits",
                columns: new[] { "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Visits_ReceptionRecordId",
                table: "Visits",
                column: "ReceptionRecordId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowMapping_HospitalServiceId_Revision",
                table: "WorkflowMapping",
                columns: new[] { "HospitalServiceId", "Revision" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccessGrant");

            migrationBuilder.DropTable(
                name: "AssistanceRequest");

            migrationBuilder.DropTable(
                name: "AuditEvent");

            migrationBuilder.DropTable(
                name: "CommandReceipt");

            migrationBuilder.DropTable(
                name: "ExternalIdentity");

            migrationBuilder.DropTable(
                name: "FollowUpRecommendation");

            migrationBuilder.DropTable(
                name: "HospitalRoute");

            migrationBuilder.DropTable(
                name: "LinkClaim");

            migrationBuilder.DropTable(
                name: "Notification");

            migrationBuilder.DropTable(
                name: "QrCode");

            migrationBuilder.DropTable(
                name: "ReceptionMessage");

            migrationBuilder.DropTable(
                name: "RecoveryClaim");

            migrationBuilder.DropTable(
                name: "StaffScope");

            migrationBuilder.DropTable(
                name: "StepDependency");

            migrationBuilder.DropTable(
                name: "SummaryTranslation");

            migrationBuilder.DropTable(
                name: "WorkflowMapping");

            migrationBuilder.DropTable(
                name: "ExaminationTicket");

            migrationBuilder.DropTable(
                name: "GuidanceTemplate");

            migrationBuilder.DropTable(
                name: "JourneyStep");

            migrationBuilder.DropTable(
                name: "SummaryVersion");

            migrationBuilder.DropTable(
                name: "DoctorOrder");

            migrationBuilder.DropTable(
                name: "PatientJourney");

            migrationBuilder.DropTable(
                name: "HospitalService");

            migrationBuilder.DropTable(
                name: "Visits");

            migrationBuilder.DropTable(
                name: "Location");

            migrationBuilder.DropTable(
                name: "ReceptionRecord");

            migrationBuilder.DropTable(
                name: "Requests");

            migrationBuilder.DropTable(
                name: "Appointment");

            migrationBuilder.DropTable(
                name: "Sessions");

            migrationBuilder.DropTable(
                name: "Department");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Patients");
        }
    }
}
