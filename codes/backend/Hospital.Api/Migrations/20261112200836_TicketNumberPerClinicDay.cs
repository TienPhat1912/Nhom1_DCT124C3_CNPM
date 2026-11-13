using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class TicketNumberPerClinicDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClinicLocationId",
                table: "ExaminationTicket",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "IssuedOn",
                table: "ExaminationTicket",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SequenceNumber",
                table: "ExaminationTicket",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TicketDailyCounters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClinicLocationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IssuedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    LastNumber = table.Column<int>(type: "int", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketDailyCounters", x => x.Id);
                    table.CheckConstraint("CK_TicketDailyCounter_LastNumber", "[LastNumber] > 0");
                    table.ForeignKey(
                        name: "FK_TicketDailyCounters_Location_ClinicLocationId",
                        column: x => x.ClinicLocationId,
                        principalTable: "Location",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_Ticket_ClinicDateSequence",
                table: "ExaminationTicket",
                columns: new[] { "ClinicLocationId", "IssuedOn", "SequenceNumber" },
                unique: true,
                filter: "[ClinicLocationId] IS NOT NULL AND [IssuedOn] IS NOT NULL AND [SequenceNumber] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Ticket_NumberFields",
                table: "ExaminationTicket",
                sql: "([ClinicLocationId] IS NULL AND [IssuedOn] IS NULL AND [SequenceNumber] IS NULL) OR ([ClinicLocationId] IS NOT NULL AND [IssuedOn] IS NOT NULL AND [SequenceNumber] IS NOT NULL AND [SequenceNumber] > 0)");

            migrationBuilder.CreateIndex(
                name: "IX_TicketDailyCounters_ClinicLocationId_IssuedOn",
                table: "TicketDailyCounters",
                columns: new[] { "ClinicLocationId", "IssuedOn" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ExaminationTicket_Location_ClinicLocationId",
                table: "ExaminationTicket",
                column: "ClinicLocationId",
                principalTable: "Location",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Losing clinic/date would make repeated 001 numbers ambiguous; never discard issued data.
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM ExaminationTicket WHERE SequenceNumber IS NOT NULL) OR EXISTS (SELECT 1 FROM TicketDailyCounters) THROW 51008, 'Issued ticket numbers prevent downgrade; retain this schema and roll back application only.', 1;");

            migrationBuilder.DropForeignKey(
                name: "FK_ExaminationTicket_Location_ClinicLocationId",
                table: "ExaminationTicket");

            migrationBuilder.DropTable(
                name: "TicketDailyCounters");

            migrationBuilder.DropIndex(
                name: "UX_Ticket_ClinicDateSequence",
                table: "ExaminationTicket");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Ticket_NumberFields",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "ClinicLocationId",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "IssuedOn",
                table: "ExaminationTicket");

            migrationBuilder.DropColumn(
                name: "SequenceNumber",
                table: "ExaminationTicket");
        }
    }
}
