using Hospital.Tests.Fixtures;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB013_SQL_CONNECTION") ?? throw new InvalidOperationException("Set PB013_SQL_CONNECTION to local SQL."));
if (!(connection.DataSource == "localhost" || connection.DataSource.StartsWith("(localdb)\\") || connection.DataSource.StartsWith(".\\") || connection.DataSource.StartsWith("127.0.0.1,"))) throw new InvalidOperationException("Only local SQL fixtures are allowed.");
connection.InitialCatalog = "HospitalPB013_" + Guid.NewGuid().ToString("N");
await using var db = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
var migrator = db.GetService<IMigrator>(); const string previous = "20261113234239_SingleServiceOrder";
var assertions = 0;
void Check(bool ok) { if (!ok) throw new InvalidOperationException("Clinical catalog migration assertion failed at " + (assertions + 1)); assertions++; }
async Task RejectSave(int number) {
    try { await db.SaveChangesAsync(); } catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && (sql.Number == number || (number == 2601 && sql.Number == 2627))) { assertions++; db.ChangeTracker.Clear(); return; }
    throw new InvalidOperationException("Expected database rejection " + number);
}
async Task RejectDown() {
    try { await migrator.MigrateAsync(previous); } catch (SqlException ex) when (ex.Number == 51018) { assertions++; return; }
    throw new InvalidOperationException("Unsafe downgrade was allowed.");
}
IConfiguration Config(bool demo, bool v2) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Demo:Enabled"] = demo.ToString(), ["Demo:Password"] = "Synthetic-PB013-Fixture!", ["Workflow:PrdV2Enabled"] = v2.ToString()
}).Build();

// Upgrade a real prior schema with a legacy free-text result: no synthesized structured result.
await migrator.MigrateAsync(previous);
await Seed.Run(db, Config(true, true));
var doctor = await db.Users.SingleAsync(u => u.Email == "doctor@demo.local");
var department = await db.Set<Department>().SingleAsync(d => d.Code == "CONSULT");
var patient = new Patient { Name = "Synthetic historical patient", Contact = "synthetic-contact" };
var session = new Session { PatientId = patient.Id, TokenHash = Crypto.Hash(Guid.NewGuid().ToString()) };
var request = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = department.Id, Status = "Confirmed" };
var reception = new ReceptionRecord { PatientId = patient.Id, RegistrationRequestId = request.Id, ConfirmedBy = doctor.Id };
var visit = new Visit { PatientId = patient.Id, ReceptionRecordId = reception.Id, DoctorId = doctor.Id, DepartmentId = department.Id };
var old = new SummaryVersion { VisitId = visit.Id, AuthorId = doctor.Id, AuthorName = doctor.Name, Language = "vi", Status = "Published", Revision = 1,
    Diagnosis = "  Chẩn đoán cũ\n", Explanation = "Nội dung nguyên bản", Instructions = "Hướng dẫn nguyên bản", PublishedAt = DateTime.UtcNow };
db.Add(patient); await db.SaveChangesAsync();
await LegacySessionFixture.Insert(db, session);
db.AddRange(request, reception, visit, old); await db.SaveChangesAsync(); db.ChangeTracker.Clear();
var before = JsonSerializer.Serialize(await db.Set<SummaryVersion>().AsNoTracking().SingleAsync(x => x.Id == old.Id));
await migrator.MigrateAsync(); Check(!db.Database.HasPendingModelChanges());
Check(JsonSerializer.Serialize(await db.Set<SummaryVersion>().AsNoTracking().SingleAsync(x => x.Id == old.Id)) == before);
Check(!await db.Set<ClinicalRecord>().AnyAsync()); Check(!await db.Set<SymptomCatalog>().AnyAsync());
await ClinicalCatalogSeed.Run(db, Config(false, true)); await ClinicalCatalogSeed.Run(db, Config(true, false));
Check(!await db.Set<DiagnosisCatalog>().AnyAsync()); Check(!await db.Set<ClinicalTemplate>().AnyAsync());
// Empty new tables can be downgraded and reapplied without touching old records.
await migrator.MigrateAsync(previous); await migrator.MigrateAsync();
Check(JsonSerializer.Serialize(await db.Set<SummaryVersion>().AsNoTracking().SingleAsync(x => x.Id == old.Id)) == before);

await ClinicalCatalogSeed.Run(db, Config(true, true)); await ClinicalCatalogSeed.Run(db, Config(true, true));
Check(await db.Set<SymptomCatalog>().CountAsync() == 2); Check(await db.Set<DiagnosisCatalog>().CountAsync() == 1);
Check(await db.Set<ClinicalTemplate>().CountAsync() == 1); Check(await db.Set<SymptomCatalog>().AllAsync(x => x.IsDemo && x.Version == 1));
var symptom = await db.Set<SymptomCatalog>().SingleAsync(x => x.Kind == "Symptom");
var diagnosis = await db.Set<DiagnosisCatalog>().SingleAsync(); var template = await db.Set<ClinicalTemplate>().SingleAsync();
var record = new ClinicalRecord { VisitId = visit.Id, AuthorId = doctor.Id, AuthorName = doctor.Name, TemplateId = template.Id, TemplateVersion = template.Version,
    TemplateSnapshot = JsonSerializer.Serialize(template), Diagnosis = "Chẩn đoán lựa chọn cũ", Explanation = "Giải thích cũ", Instructions = "Hướng dẫn cũ", ConfirmedAt = DateTime.UtcNow, PublishedAt = DateTime.UtcNow };
var link = new ClinicalSymptom { ClinicalRecordId = record.Id, SymptomCatalogId = symptom.Id, CatalogVersion = symptom.Version, Kind = symptom.Kind, CodeSnapshot = symptom.Code, NameViSnapshot = symptom.NameVi, IsDemoSnapshot = symptom.IsDemo };
var diagnosisLink = new ClinicalDiagnosis { ClinicalRecordId = record.Id, DiagnosisCatalogId = diagnosis.Id, CatalogVersion = diagnosis.Version, CodeSnapshot = diagnosis.Code, NameViSnapshot = diagnosis.NameVi, IsDemoSnapshot = diagnosis.IsDemo };
db.AddRange(record, link, diagnosisLink); await db.SaveChangesAsync(); db.ChangeTracker.Clear();
var recordBefore = JsonSerializer.Serialize(await db.Set<ClinicalRecord>().AsNoTracking().SingleAsync());
var symptomBefore = JsonSerializer.Serialize(await db.Set<ClinicalSymptom>().AsNoTracking().SingleAsync());
var diagnosisBefore = JsonSerializer.Serialize(await db.Set<ClinicalDiagnosis>().AsNoTracking().SingleAsync());
symptom = await db.Set<SymptomCatalog>().SingleAsync(x => x.Id == symptom.Id); diagnosis = await db.Set<DiagnosisCatalog>().SingleAsync(); template = await db.Set<ClinicalTemplate>().SingleAsync();
symptom.NameVi = "Đổi tên triệu chứng"; symptom.Active = false;
diagnosis.NameVi = "Đổi tên chẩn đoán"; diagnosis.Active = false;
template.NameVi = "Đổi tên mẫu"; template.Active = false; template.InstructionsTemplate = "Mẫu đã thay đổi";
await db.SaveChangesAsync(); db.ChangeTracker.Clear(); await ClinicalCatalogSeed.Run(db, Config(true, true));
Check((await db.Set<SymptomCatalog>().SingleAsync(x => x.Id == symptom.Id)).Active == false);
Check((await db.Set<ClinicalTemplate>().SingleAsync()).InstructionsTemplate == "Mẫu đã thay đổi");
Check(JsonSerializer.Serialize(await db.Set<ClinicalRecord>().AsNoTracking().SingleAsync()) == recordBefore);
Check(JsonSerializer.Serialize(await db.Set<ClinicalSymptom>().AsNoTracking().SingleAsync()) == symptomBefore);
Check(JsonSerializer.Serialize(await db.Set<ClinicalDiagnosis>().AsNoTracking().SingleAsync()) == diagnosisBefore);

// Referential integrity and duplicate selection/record prevention are owned by SQL too.
db.Add(new ClinicalSymptom { ClinicalRecordId = record.Id, SymptomCatalogId = Guid.NewGuid(), CatalogVersion = 1, CodeSnapshot = "INVALID", NameViSnapshot = "Invalid reference" }); await RejectSave(547);
var signId = await db.Set<SymptomCatalog>().Where(x => x.Kind == "Sign").Select(x => x.Id).SingleAsync();
db.Add(new ClinicalSymptom { ClinicalRecordId = record.Id, SymptomCatalogId = signId, Kind = "Symptom", CatalogVersion = 1, CodeSnapshot = "INVALID", NameViSnapshot = "Wrong kind" }); await RejectSave(547);
db.Add(new ClinicalSymptom { ClinicalRecordId = record.Id, SymptomCatalogId = symptom.Id, Kind = "Symptom", CatalogVersion = 1, CodeSnapshot = "DUPLICATE", NameViSnapshot = "Duplicate selection" }); await RejectSave(2601);
var extraDiagnosis = new DiagnosisCatalog { Code = "VERSION_FIXTURE", NameVi = "Version fixture" }; db.Add(extraDiagnosis); await db.SaveChangesAsync(); db.ChangeTracker.Clear();
db.Add(new ClinicalDiagnosis { ClinicalRecordId = record.Id, DiagnosisCatalogId = extraDiagnosis.Id, CatalogVersion = 0, CodeSnapshot = "INVALID", NameViSnapshot = "Invalid version" }); await RejectSave(547);
db.Add(new ClinicalRecord { VisitId = visit.Id, AuthorId = doctor.Id, AuthorName = doctor.Name, TemplateId = template.Id, TemplateVersion = 1, TemplateSnapshot = "{}", Diagnosis = "Duplicate", Instructions = "Duplicate", ConfirmedAt = record.ConfirmedAt, PublishedAt = record.PublishedAt }); await RejectSave(2601);
db.Remove(await db.Set<SymptomCatalog>().SingleAsync(x => x.Id == symptom.Id)); await RejectSave(547);
db.Remove(await db.Set<ClinicalTemplate>().SingleAsync()); await RejectSave(547);
db.Add(new DiagnosisCatalog { Code = "bad code", NameVi = "Invalid code" }); await RejectSave(547);
db.Add(new DiagnosisCatalog { Code = "VALID_CODE", NameVi = " " }); await RejectSave(547);
db.Add(new DiagnosisCatalog { Code = diagnosis.Code, NameVi = "Duplicate code" }); await RejectSave(2601);
db.Add(new ClinicalTemplate { Code = "BAD_SOURCE", NameVi = "Invalid source", Language = "en", DiagnosisTemplate = "{{diagnoses}}", InstructionsTemplate = "Original" }); await RejectSave(547);
await RejectDown(); Check((await db.Database.GetAppliedMigrationsAsync()).Last().EndsWith("ClinicalCatalog"));
Check(await db.Set<ClinicalRecord>().CountAsync() == 1);

// Also verify creation directly from an empty database, with an empty-schema rollback.
var freshConnection = new SqlConnectionStringBuilder(connection.ConnectionString) { InitialCatalog = "HospitalPB013_Fresh_" + Guid.NewGuid().ToString("N") };
await using var fresh = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(freshConnection.ConnectionString).Options);
await fresh.Database.MigrateAsync(); Check(!fresh.Database.HasPendingModelChanges());
Check(!await fresh.Set<ClinicalRecord>().AnyAsync());
await fresh.GetService<IMigrator>().MigrateAsync(previous); await fresh.Database.MigrateAsync();
Check(!fresh.Database.HasPendingModelChanges());
Console.WriteLine($"PASS {assertions} clinical catalog migration assertions; retained {connection.InitialCatalog}, {freshConnection.InitialCatalog}.");
