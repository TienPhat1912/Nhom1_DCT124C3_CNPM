using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class CoreClinicSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClinicLocationId",
                table: "Visits",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConsultationCount",
                table: "Visits",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExamStatus",
                table: "Visits",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExaminationCompletedAt",
                table: "Visits",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PreferredDepartmentId",
                table: "Requests",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceLanguage",
                table: "Requests",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClinicSnapshot",
                table: "ExaminationTicket",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DoctorSnapshot",
                table: "ExaminationTicket",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PatientSnapshot",
                table: "ExaminationTicket",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SnapshotSource",
                table: "ExaminationTicket",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "LegacyMissing");

            migrationBuilder.AddColumn<string>(
                name: "SourceLanguage",
                table: "AssistanceRequest",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ClinicDoctor",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClinicLocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicDoctor", x => x.Id);
                    table.UniqueConstraint("AK_ClinicDoctor_ClinicLocationId_DoctorId", x => new { x.ClinicLocationId, x.DoctorId });
                    table.ForeignKey(
                        name: "FK_ClinicDoctor_Location_ClinicLocationId",
                        column: x => x.ClinicLocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicDoctor_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClinicRoom",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClinicLocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActiveDoctorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicRoom", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicRoom_ClinicDoctor_ClinicLocationId_ActiveDoctorId",
                        columns: x => new { x.ClinicLocationId, x.ActiveDoctorId },
                        principalTable: "ClinicDoctor",
                        principalColumns: new[] { "ClinicLocationId", "DoctorId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicRoom_Location_ClinicLocationId",
                        column: x => x.ClinicLocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Visits_ClinicLocationId_Status_ExamStatus",
                table: "Visits",
                columns: new[] { "ClinicLocationId", "Status", "ExamStatus" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Visit_ConsultationCount",
                table: "Visits",
                sql: "[ConsultationCount] IS NULL OR [ConsultationCount] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Visit_ExaminationCompletedAt",
                table: "Visits",
                sql: "[ExaminationCompletedAt] IS NULL OR ([ExamStatus] IS NOT NULL AND [ExamStatus] = 'Completed')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Visit_ExamStatus",
                table: "Visits",
                sql: "[ExamStatus] IS NULL OR [ExamStatus] IN ('Waiting','InConsultation','InService','Completed')");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_PreferredDepartmentId",
                table: "Requests",
                column: "PreferredDepartmentId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Request_SourceLanguage",
                table: "Requests",
                sql: "[SourceLanguage] IS NULL OR [SourceLanguage] IN ('vi','en','zh','ja')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Ticket_Snapshots",
                table: "ExaminationTicket",
                sql: "([SnapshotSource] = 'LegacyMissing' AND [PatientSnapshot] IS NULL AND [ClinicSnapshot] IS NULL AND [DoctorSnapshot] IS NULL) OR ([SnapshotSource] = 'Captured' AND [PatientSnapshot] IS NOT NULL AND [ClinicSnapshot] IS NOT NULL AND [DoctorSnapshot] IS NOT NULL AND ISJSON([PatientSnapshot]) = 1 AND LEFT(LTRIM(REPLACE(REPLACE(REPLACE([PatientSnapshot], CHAR(9), ''), CHAR(10), ''), CHAR(13), '')), 1) = '{' AND ISJSON([ClinicSnapshot]) = 1 AND LEFT(LTRIM(REPLACE(REPLACE(REPLACE([ClinicSnapshot], CHAR(9), ''), CHAR(10), ''), CHAR(13), '')), 1) = '{' AND ISJSON([DoctorSnapshot]) = 1 AND LEFT(LTRIM(REPLACE(REPLACE(REPLACE([DoctorSnapshot], CHAR(9), ''), CHAR(10), ''), CHAR(13), '')), 1) = '{')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Ticket_SnapshotSource",
                table: "ExaminationTicket",
                sql: "[SnapshotSource] IN ('LegacyMissing','Captured')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Assistance_SourceLanguage",
                table: "AssistanceRequest",
                sql: "[SourceLanguage] IS NULL OR [SourceLanguage] IN ('vi','en','zh','ja')");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicDoctor_DoctorId",
                table: "ClinicDoctor",
                column: "DoctorId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicRoom_ClinicLocationId",
                table: "ClinicRoom",
                column: "ClinicLocationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicRoom_ClinicLocationId_ActiveDoctorId",
                table: "ClinicRoom",
                columns: new[] { "ClinicLocationId", "ActiveDoctorId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_Department_PreferredDepartmentId",
                table: "Requests",
                column: "PreferredDepartmentId",
                principalTable: "Department",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Visits_Location_ClinicLocationId",
                table: "Visits",
                column: "ClinicLocationId",
                principalTable: "Location",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Only the historical destination ID is inferred. Current roster, names,
            // profile locale, publication and settlement are NOT migration evidence.
            migrationBuilder.Sql("""
                ;WITH evidence AS (
                    SELECT j.VisitId, s.LocationId,
                        CASE WHEN TRY_CONVERT(uniqueidentifier, JSON_VALUE(p.Json, '$.id')) = s.LocationId
                            AND LEN(JSON_VALUE(p.Json, '$.id')) = 36
                            AND s.DepartmentId = v.DepartmentId AND l.DepartmentId = v.DepartmentId
                            AND NULLIF(LTRIM(RTRIM(JSON_VALUE(p.Json, '$.nameVi'))), '') IS NOT NULL
                            AND NULLIF(LTRIM(RTRIM(JSON_VALUE(p.Json, '$.building'))), '') IS NOT NULL
                            AND NULLIF(LTRIM(RTRIM(JSON_VALUE(p.Json, '$.floor'))), '') IS NOT NULL
                            AND NULLIF(LTRIM(RTRIM(JSON_VALUE(p.Json, '$.room'))), '') IS NOT NULL
                        THEN 1 ELSE 0 END AS IsCertain
                    FROM JourneyStep s
                    JOIN PatientJourney j ON j.Id = s.PatientJourneyId
                    JOIN Visits v ON v.Id = j.VisitId
                    JOIN Location l ON l.Id = s.LocationId
                    CROSS APPLY (SELECT CASE WHEN ISJSON(s.DestinationSnapshot) = 1
                        THEN s.DestinationSnapshot ELSE '{}' END AS Json) p
                    WHERE s.Kind IN ('Consultation','ReturnConsultation')
                ), certain AS (
                    SELECT VisitId, CONVERT(uniqueidentifier, MIN(CONVERT(varchar(36), LocationId))) AS LocationId
                    FROM evidence GROUP BY VisitId
                    HAVING COUNT(DISTINCT LocationId) = 1 AND MIN(IsCertain) = 1
                )
                UPDATE v SET ClinicLocationId = c.LocationId
                FROM Visits v JOIN certain c ON c.VisitId = v.Id
                WHERE v.ClinicLocationId IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Refuse destructive downgrade once any new data (including backfill) exists.
            // Restore the verified pre-upgrade backup instead; never silently erase snapshots.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM ClinicDoctor) OR EXISTS (SELECT 1 FROM ClinicRoom)
                    OR EXISTS (SELECT 1 FROM Visits WHERE ClinicLocationId IS NOT NULL OR ExamStatus IS NOT NULL
                        OR ConsultationCount IS NOT NULL OR ExaminationCompletedAt IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM Requests WHERE SourceLanguage IS NOT NULL OR PreferredDepartmentId IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM AssistanceRequest WHERE SourceLanguage IS NOT NULL)
                    OR EXISTS (SELECT 1 FROM ExaminationTicket WHERE SnapshotSource <> 'LegacyMissing'
                        OR PatientSnapshot IS NOT NULL OR ClinicSnapshot IS NOT NULL OR DoctorSnapshot IS NOT NULL)
                    THROW 51004, 'PB-004 downgrade would discard data. Restore a verified backup instead.', 1;
                """);
            migrationBuilder.DropForeignKey(
                name: "FK_Requests_Department_PreferredDepartmentId",
                table: "Requests");

            migrationBuilder.DropForeignKey(
                name: "FK_Visits_Location_ClinicLocationId",
                table: "Visits");

            migrationBuilder.DropTable(
                name: "ClinicRoom");

            migrationBuilder.DropTable(
                name: "ClinicDoctor");

            migrationBuilder.DropIndex(
                name: "IX_Visits_ClinicLocationId_Status_ExamStatus",
                table: "Visits");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Visit_ConsultationCount",
                table: "Visits");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Visit_ExaminationCompletedAt",
                table: "Visits");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Visit_ExamStatus",
                table: "Visits");

            migrationBuilder.DropIndex(
                name: "IX_Requests_PreferredDepartmentId",
                table: "Requests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Request_SourceLanguage",
                table: "Requests");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Ticket_Snapshots",
                table: "ExaminationTicket");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Ticket_SnapshotSource",
                table: "ExaminationTicket");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Assistance_SourceLanguage",
                table: "AssistanceRequest");

            migrationBuilder.DropColumn(
                name: "ClinicLocationId",
                table: "Visits");

            migrationBuilder.DropColumn(
                name: "ConsultationCount",
                table: "Visits");

            migrationBuilder.DropColumn(
                name: "ExamStatus",
                table: "Visits");

            migrationBuilder.DropColumn(
                name: "ExaminationCompletedAt",
                table: "Visits");

            migrationBuilder.DropColumn(
                name: "PreferredDepartmentId",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "SourceLanguage",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "ClinicSnapshot",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "DoctorSnapshot",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "PatientSnapshot",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "SnapshotSource",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "SourceLanguage",
                table: "AssistanceRequest");
        }
    }
}
