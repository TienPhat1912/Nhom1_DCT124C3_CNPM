using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class RegistrationUniquenessV2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT PatientId FROM Requests
                    WHERE SourceLanguage IS NOT NULL AND Status = 'Submitted'
                    GROUP BY PatientId HAVING COUNT(*) > 1)
                    THROW 51006, 'PB-006: conflicting V2 pending requests. Audit and resolve before migration; no records were removed.', 1;
                IF EXISTS (SELECT PatientId FROM Visits
                    WHERE ExamStatus IS NOT NULL AND Status = 'Active'
                    GROUP BY PatientId HAVING COUNT(*) > 1)
                    THROW 51006, 'PB-006: conflicting V2 active Visits. Audit and resolve before migration; no records were removed.', 1;
                """);
            migrationBuilder.CreateIndex(
                name: "UX_Visits_V2ActivePatient",
                table: "Visits",
                column: "PatientId",
                unique: true,
                filter: "[ExamStatus] IS NOT NULL AND [Status] = 'Active'");

            migrationBuilder.CreateIndex(
                name: "UX_Requests_V2PendingPatient",
                table: "Requests",
                column: "PatientId",
                unique: true,
                filter: "[SourceLanguage] IS NOT NULL AND [Status] = 'Submitted'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Visits_V2ActivePatient",
                table: "Visits");

            migrationBuilder.DropIndex(
                name: "UX_Requests_V2PendingPatient",
                table: "Requests");
        }
    }
}
