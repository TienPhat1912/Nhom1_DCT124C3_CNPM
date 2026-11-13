using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class DoctorConsultation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF EXISTS (SELECT ClinicLocationId FROM Visits WHERE ClinicLocationId IS NOT NULL AND Status = 'Active' AND ExamStatus = 'InConsultation' GROUP BY ClinicLocationId HAVING COUNT(*) > 1) THROW 51010, 'Resolve conflicting clinic consultations before upgrade; no data was changed.', 1;");
            migrationBuilder.CreateTable(
                name: "ConsultationCall",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClinicLocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConsultationNumber = table.Column<int>(type: "int", nullable: false),
                    ContentRevision = table.Column<int>(type: "int", nullable: false),
                    PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsultationCall", x => x.Id);
                    table.CheckConstraint("CK_ConsultationCall_Number", "[ConsultationNumber] > 0 AND [ContentRevision] > 0");
                    table.CheckConstraint("CK_ConsultationCall_Payload", "ISJSON([PayloadJson]) = 1");
                    table.ForeignKey(
                        name: "FK_ConsultationCall_Location_ClinicLocationId",
                        column: x => x.ClinicLocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConsultationCall_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConsultationCall_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_Visits_OneConsultationPerClinic",
                table: "Visits",
                column: "ClinicLocationId",
                unique: true,
                filter: "[ClinicLocationId] IS NOT NULL AND [Status] = 'Active' AND [ExamStatus] = 'InConsultation'");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationCall_ClinicLocationId",
                table: "ConsultationCall",
                column: "ClinicLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationCall_DoctorId",
                table: "ConsultationCall",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsultationCall_VisitId_ConsultationNumber",
                table: "ConsultationCall",
                columns: new[] { "VisitId", "ConsultationNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM ConsultationCall) THROW 51011, 'Consultation call history prevents downgrade; retain schema and roll back application only.', 1;");
            migrationBuilder.DropTable(
                name: "ConsultationCall");

            migrationBuilder.DropIndex(
                name: "UX_Visits_OneConsultationPerClinic",
                table: "Visits");
        }
    }
}
