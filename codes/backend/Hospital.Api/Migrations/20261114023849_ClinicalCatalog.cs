using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class ClinicalCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClinicalTemplate",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NameVi = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    DiagnosisTemplate = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    ExplanationTemplate = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    InstructionsTemplate = table.Column<string>(type: "nvarchar(max)", maxLength: 6000, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    IsDemo = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalTemplate", x => x.Id);
                    table.CheckConstraint("CK_ClinicalTemplate_Code", "LEN([Code]) BETWEEN 2 AND 40 AND [Code] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^-A-Z0-9_]%' AND [Code] COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]%'");
                    table.CheckConstraint("CK_ClinicalTemplate_Content", "LEN(LTRIM(RTRIM([DiagnosisTemplate]))) > 0 AND LEN(LTRIM(RTRIM([InstructionsTemplate]))) > 0");
                    table.CheckConstraint("CK_ClinicalTemplate_Name", "LEN(LTRIM(RTRIM([NameVi]))) >= 2 AND [Version] > 0");
                    table.CheckConstraint("CK_ClinicalTemplate_Source", "[Language] = 'vi'");
                });

            migrationBuilder.CreateTable(
                name: "DiagnosisCatalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NameVi = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    IsDemo = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiagnosisCatalog", x => x.Id);
                    table.CheckConstraint("CK_DiagnosisCatalog_Code", "LEN([Code]) BETWEEN 2 AND 40 AND [Code] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^-A-Z0-9_]%' AND [Code] COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]%'");
                    table.CheckConstraint("CK_DiagnosisCatalog_Name", "LEN(LTRIM(RTRIM([NameVi]))) >= 2 AND [Version] > 0");
                });

            migrationBuilder.CreateTable(
                name: "SymptomCatalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NameVi = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false),
                    IsDemo = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SymptomCatalog", x => x.Id);
                    table.UniqueConstraint("AK_SymptomCatalog_Id_Kind", x => new { x.Id, x.Kind });
                    table.CheckConstraint("CK_SymptomCatalog_Code", "LEN([Code]) BETWEEN 2 AND 40 AND [Code] COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^-A-Z0-9_]%' AND [Code] COLLATE Latin1_General_100_BIN2 LIKE N'[A-Z]%'");
                    table.CheckConstraint("CK_SymptomCatalog_Kind", "[Kind] IN ('Symptom','Sign')");
                    table.CheckConstraint("CK_SymptomCatalog_Name", "LEN(LTRIM(RTRIM([NameVi]))) >= 2 AND [Version] > 0");
                });

            migrationBuilder.CreateTable(
                name: "ClinicalRecord",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    TemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TemplateVersion = table.Column<int>(type: "int", nullable: false),
                    TemplateSnapshot = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Language = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Diagnosis = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    Instructions = table.Column<string>(type: "nvarchar(max)", maxLength: 6000, nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalRecord", x => x.Id);
                    table.CheckConstraint("CK_ClinicalRecord_Content", "LEN(LTRIM(RTRIM([Diagnosis]))) > 0 AND LEN(LTRIM(RTRIM([Instructions]))) > 0 AND LEN(LTRIM(RTRIM([AuthorName]))) > 0 AND [PublishedAt] >= [ConfirmedAt]");
                    table.CheckConstraint("CK_ClinicalRecord_Snapshot", "[TemplateVersion] > 0 AND ISJSON([TemplateSnapshot]) = 1");
                    table.CheckConstraint("CK_ClinicalRecord_Source", "[Language] = 'vi'");
                    table.ForeignKey(
                        name: "FK_ClinicalRecord_ClinicalTemplate_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "ClinicalTemplate",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicalRecord_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicalRecord_Visits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "Visits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClinicalDiagnosis",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClinicalRecordId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DiagnosisCatalogId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CatalogVersion = table.Column<int>(type: "int", nullable: false),
                    CodeSnapshot = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NameViSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsDemoSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalDiagnosis", x => x.Id);
                    table.CheckConstraint("CK_ClinicalDiagnosis_Snapshot", "[CatalogVersion] > 0 AND LEN(LTRIM(RTRIM([CodeSnapshot]))) >= 2 AND LEN(LTRIM(RTRIM([NameViSnapshot]))) >= 2");
                    table.ForeignKey(
                        name: "FK_ClinicalDiagnosis_ClinicalRecord_ClinicalRecordId",
                        column: x => x.ClinicalRecordId,
                        principalTable: "ClinicalRecord",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicalDiagnosis_DiagnosisCatalog_DiagnosisCatalogId",
                        column: x => x.DiagnosisCatalogId,
                        principalTable: "DiagnosisCatalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClinicalSymptom",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClinicalRecordId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SymptomCatalogId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CatalogVersion = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CodeSnapshot = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NameViSnapshot = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsDemoSnapshot = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicalSymptom", x => x.Id);
                    table.CheckConstraint("CK_ClinicalSymptom_Snapshot", "[CatalogVersion] > 0 AND LEN(LTRIM(RTRIM([CodeSnapshot]))) >= 2 AND LEN(LTRIM(RTRIM([NameViSnapshot]))) >= 2");
                    table.ForeignKey(
                        name: "FK_ClinicalSymptom_ClinicalRecord_ClinicalRecordId",
                        column: x => x.ClinicalRecordId,
                        principalTable: "ClinicalRecord",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClinicalSymptom_SymptomCatalog_SymptomCatalogId_Kind",
                        columns: x => new { x.SymptomCatalogId, x.Kind },
                        principalTable: "SymptomCatalog",
                        principalColumns: new[] { "Id", "Kind" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalDiagnosis_ClinicalRecordId_DiagnosisCatalogId",
                table: "ClinicalDiagnosis",
                columns: new[] { "ClinicalRecordId", "DiagnosisCatalogId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalDiagnosis_DiagnosisCatalogId",
                table: "ClinicalDiagnosis",
                column: "DiagnosisCatalogId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecord_AuthorId",
                table: "ClinicalRecord",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecord_TemplateId",
                table: "ClinicalRecord",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalRecord_VisitId",
                table: "ClinicalRecord",
                column: "VisitId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalSymptom_ClinicalRecordId_SymptomCatalogId",
                table: "ClinicalSymptom",
                columns: new[] { "ClinicalRecordId", "SymptomCatalogId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalSymptom_SymptomCatalogId_Kind",
                table: "ClinicalSymptom",
                columns: new[] { "SymptomCatalogId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicalTemplate_Code",
                table: "ClinicalTemplate",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DiagnosisCatalog_Code",
                table: "DiagnosisCatalog",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SymptomCatalog_Code",
                table: "SymptomCatalog",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM ClinicalRecord) OR EXISTS (SELECT 1 FROM ClinicalSymptom)
                    OR EXISTS (SELECT 1 FROM ClinicalDiagnosis) OR EXISTS (SELECT 1 FROM SymptomCatalog)
                    OR EXISTS (SELECT 1 FROM DiagnosisCatalog) OR EXISTS (SELECT 1 FROM ClinicalTemplate)
                    THROW 51018, 'Clinical catalog rollback would discard data. Export and explicitly reconcile it before downgrade.', 1;
                """);
            migrationBuilder.DropTable(
                name: "ClinicalDiagnosis");

            migrationBuilder.DropTable(
                name: "ClinicalSymptom");

            migrationBuilder.DropTable(
                name: "DiagnosisCatalog");

            migrationBuilder.DropTable(
                name: "ClinicalRecord");

            migrationBuilder.DropTable(
                name: "SymptomCatalog");

            migrationBuilder.DropTable(
                name: "ClinicalTemplate");
        }
    }
}
