using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class VietnameseSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
-- Refuse to relabel a foreign-language clinical original as Vietnamese.
-- The transaction remains unchanged until an operator supplies reviewed Vietnamese originals.
IF EXISTS (SELECT 1 FROM SummaryVersion WHERE Language <> 'vi')
 OR EXISTS (SELECT 1 FROM FollowUpRecommendation WHERE Language <> 'vi')
    THROW 51000, 'VietnameseSource: review and convert non-Vietnamese clinical originals before migrating. See docs/guides/LANGUAGES.md.', 1;

IF EXISTS (SELECT 1 FROM GuidanceTemplate t WHERE t.Language <> 'vi' AND NOT EXISTS
    (SELECT 1 FROM GuidanceTemplate v WHERE v.Language = 'vi' AND v.[Key] = t.[Key] AND v.Revision = t.Revision AND v.Category = t.Category))
    THROW 51000, 'VietnameseSource: a legacy template has no matching Vietnamese source with the same key/revision.', 1;

IF EXISTS (SELECT 1 FROM ReceptionMessage m JOIN GuidanceTemplate t ON t.Id = m.TemplateId
    WHERE (m.Language <> 'vi' OR t.Language <> 'vi') AND (m.Text <> t.Text OR NOT EXISTS
    (SELECT 1 FROM GuidanceTemplate v WHERE v.Language = 'vi' AND v.[Key] = t.[Key] AND v.Revision = t.Revision AND v.Category = t.Category)))
    THROW 51000, 'VietnameseSource: a reception message requires a reviewed Vietnamese original.', 1;

IF EXISTS (SELECT 1 FROM HospitalRoute r WHERE r.Language <> 'vi' AND NOT EXISTS
    (SELECT 1 FROM HospitalRoute v WHERE v.Language = 'vi' AND v.FromLocationId = r.FromLocationId AND v.ToLocationId = r.ToLocationId))
    THROW 51000, 'VietnameseSource: a legacy route requires a Vietnamese source.', 1;

UPDATE m SET m.TemplateId = v.Id, m.Text = v.Text, m.Language = 'vi', m.Version = m.Version + 1
FROM ReceptionMessage m JOIN GuidanceTemplate t ON m.TemplateId = t.Id
JOIN GuidanceTemplate v ON v.[Key] = t.[Key] AND v.Revision = t.Revision AND v.Category = t.Category AND v.Language = 'vi'
WHERE m.Language <> 'vi' OR t.Language <> 'vi';
DELETE FROM GuidanceTemplate WHERE Language <> 'vi';
DELETE FROM HospitalRoute WHERE Language <> 'vi';
UPDATE JourneyStep SET DestinationSnapshot = JSON_MODIFY(DestinationSnapshot, '$.nameEn', NULL)
WHERE ISJSON(DestinationSnapshot) = 1;
""");

            migrationBuilder.DropTable(
                name: "SummaryTranslation");

            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "Location");

            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "HospitalService");

            migrationBuilder.DropColumn(
                name: "NameEn",
                table: "Department");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Summary_Source",
                table: "SummaryVersion",
                sql: "[Language] = 'vi'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Message_Source",
                table: "ReceptionMessage",
                sql: "[Language] = 'vi'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Route_Source",
                table: "HospitalRoute",
                sql: "[Language] = 'vi'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Template_Source",
                table: "GuidanceTemplate",
                sql: "[Language] = 'vi'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_FollowUp_Source",
                table: "FollowUpRecommendation",
                sql: "[Language] = 'vi'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Summary_Source",
                table: "SummaryVersion");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Message_Source",
                table: "ReceptionMessage");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Route_Source",
                table: "HospitalRoute");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Template_Source",
                table: "GuidanceTemplate");

            migrationBuilder.DropCheckConstraint(
                name: "CK_FollowUp_Source",
                table: "FollowUpRecommendation");

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "Location",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "HospitalService",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                table: "Department",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "SummaryTranslation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Approved = table.Column<bool>(type: "bit", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ApprovedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Diagnosis = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Instructions = table.Column<string>(type: "nvarchar(max)", maxLength: 12000, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    SummaryVersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_SummaryTranslation_ApprovedBy",
                table: "SummaryTranslation",
                column: "ApprovedBy");

            migrationBuilder.CreateIndex(
                name: "IX_SummaryTranslation_SummaryVersionId_Language",
                table: "SummaryTranslation",
                columns: new[] { "SummaryVersionId", "Language" },
                unique: true);
        }
    }
}
