using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class SingleServiceOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF EXISTS (SELECT VisitId FROM DoctorOrder WHERE Status='NotCompleted' GROUP BY VisitId HAVING COUNT(*) > 1) THROW 51013, 'Resolve duplicate pending orders before upgrade; data is unchanged.', 1;");
            migrationBuilder.DropIndex(
                name: "IX_DoctorOrder_VisitId",
                table: "DoctorOrder");

            migrationBuilder.AddColumn<int>(
                name: "ConsultationNumber",
                table: "JourneyStep",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "DoctorOrder",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CompletedById",
                table: "DoctorOrder",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ConsultationNumber",
                table: "DoctorOrder",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DestinationSnapshot",
                table: "DoctorOrder",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrderedBySnapshot",
                table: "DoctorOrder",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ServiceSnapshot",
                table: "DoctorOrder",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrderPreview",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DoctorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitVersion = table.Column<int>(type: "int", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ConfigurationHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderPreview", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderPreview_HospitalService_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "HospitalService",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderPreview_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderPreview_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Step_ConsultationNumber",
                table: "JourneyStep",
                sql: "[ConsultationNumber] IS NULL OR [ConsultationNumber] > 0");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrder_CompletedById",
                table: "DoctorOrder",
                column: "CompletedById");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrder_VisitId_CreatedAt",
                table: "DoctorOrder",
                columns: new[] { "VisitId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_Orders_OneNotCompletedPerVisit",
                table: "DoctorOrder",
                column: "VisitId",
                unique: true,
                filter: "[Status] = 'NotCompleted'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_V2",
                table: "DoctorOrder",
                sql: "([ConsultationNumber] IS NULL AND [ServiceSnapshot] IS NULL AND [DestinationSnapshot] IS NULL AND [OrderedBySnapshot] IS NULL) OR ([ConsultationNumber] IS NOT NULL AND [ConsultationNumber] > 0 AND [Status] IN ('NotCompleted','Completed') AND [ServiceSnapshot] IS NOT NULL AND ISJSON([ServiceSnapshot]) = 1 AND [DestinationSnapshot] IS NOT NULL AND ISJSON([DestinationSnapshot]) = 1 AND [OrderedBySnapshot] IS NOT NULL AND ISJSON([OrderedBySnapshot]) = 1)");

            migrationBuilder.CreateIndex(
                name: "IX_OrderPreview_DoctorId",
                table: "OrderPreview",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderPreview_ServiceId",
                table: "OrderPreview",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderPreview_VisitId",
                table: "OrderPreview",
                column: "VisitId");

            migrationBuilder.AddForeignKey(
                name: "FK_DoctorOrder_Users_CompletedById",
                table: "DoctorOrder",
                column: "CompletedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM DoctorOrder WHERE ConsultationNumber IS NOT NULL) OR EXISTS (SELECT 1 FROM JourneyStep WHERE ConsultationNumber IS NOT NULL) THROW 51014, 'V2 order/consultation history prevents downgrade; retain schema and roll back application only.', 1;");
            migrationBuilder.DropForeignKey(
                name: "FK_DoctorOrder_Users_CompletedById",
                table: "DoctorOrder");

            migrationBuilder.DropTable(
                name: "OrderPreview");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Step_ConsultationNumber",
                table: "JourneyStep");

            migrationBuilder.DropIndex(
                name: "IX_DoctorOrder_CompletedById",
                table: "DoctorOrder");

            migrationBuilder.DropIndex(
                name: "IX_DoctorOrder_VisitId_CreatedAt",
                table: "DoctorOrder");

            migrationBuilder.DropIndex(
                name: "UX_Orders_OneNotCompletedPerVisit",
                table: "DoctorOrder");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_V2",
                table: "DoctorOrder");

            migrationBuilder.DropColumn(
                name: "ConsultationNumber",
                table: "JourneyStep");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "DoctorOrder");

            migrationBuilder.DropColumn(
                name: "CompletedById",
                table: "DoctorOrder");

            migrationBuilder.DropColumn(
                name: "ConsultationNumber",
                table: "DoctorOrder");

            migrationBuilder.DropColumn(
                name: "DestinationSnapshot",
                table: "DoctorOrder");

            migrationBuilder.DropColumn(
                name: "OrderedBySnapshot",
                table: "DoctorOrder");

            migrationBuilder.DropColumn(
                name: "ServiceSnapshot",
                table: "DoctorOrder");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorOrder_VisitId",
                table: "DoctorOrder",
                column: "VisitId");
        }
    }
}
