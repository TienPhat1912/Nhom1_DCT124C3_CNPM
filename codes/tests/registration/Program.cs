using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB006_SQL_CONNECTION")
    ?? throw new InvalidOperationException("Set PB006_SQL_CONNECTION explicitly to a local test SQL server."));
if (!(connection.DataSource.StartsWith("127.0.0.1,") || connection.DataSource == "localhost"
    || connection.DataSource.StartsWith("(localdb)\\") || connection.DataSource.StartsWith(".\\")))
    throw new InvalidOperationException("Only local SQL fixtures are permitted.");
connection.InitialCatalog = "HospitalAcceptance_" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
await using var db = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
var migrator = db.GetService<IMigrator>();
const string previous = "20261112151204_CoreClinicSchema";
int checks = 0;
void Check(bool ok, string message) { if (!ok) throw new InvalidOperationException(message); checks++; }

// Upgrade an actual PB-004 schema containing conflicting legacy requests.
await migrator.MigrateAsync(previous);
await Seed.Run(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Demo:Enabled"] = "true", ["Demo:Password"] = "Fixture-Only-PB006-2026!"
}).Build());
var department = await db.Set<Department>().SingleAsync(d => d.Code == "CONSULT");
var patient = new Patient { Name = "Legacy fixture", Contact = "synthetic-contact" };
var session = new Session { PatientId = patient.Id, IsGuest = true, TokenHash = Crypto.Hash(Guid.NewGuid().ToString()), ExpiresAt = DateTime.UtcNow.AddHours(1) };
RegistrationRequest Request(string? source = null) => new() {
    PatientId = patient.Id, SessionId = session.Id, DepartmentId = department.Id,
    Name = patient.Name, Contact = patient.Contact, Description = "  Legacy original\n  ", SourceLanguage = source
};
var oldA = Request(); var oldB = Request();
db.AddRange(patient, session, oldA, oldB); await db.SaveChangesAsync();
var originalIds = new[] { oldA.Id, oldB.Id };
await migrator.MigrateAsync();
Check(!db.Database.HasPendingModelChanges(), "EF snapshot must match the runtime model");
Check(await db.Requests.CountAsync(r => originalIds.Contains(r.Id) && r.Description == "  Legacy original\n  " && r.SourceLanguage == null) == 2,
    "Upgrade must retain conflicting legacy IDs, original content and unknown source language");
var first = Request("vi"); db.Add(first); await db.SaveChangesAsync();
var duplicate = Request("en"); db.Add(duplicate);
try { await db.SaveChangesAsync(); throw new InvalidOperationException("Duplicate V2 request was allowed"); }
catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 }) { checks++; }
db.ChangeTracker.Clear();
Check(await db.Requests.CountAsync(r => r.SourceLanguage != null) == 1, "Rejected insert must not create a second pending request");

// Exercise the independent active-Visit database constraint without relying on API locks.
var doctor = await db.Users.FirstAsync(u => u.Role == "Doctor");
var records = new[] { oldA, oldB }.Select(r => new ReceptionRecord {
    RegistrationRequestId = r.Id, PatientId = patient.Id, ConfirmedBy = doctor.Id, VerificationNote = "Synthetic fixture"
}).ToArray();
db.AddRange(records); await db.SaveChangesAsync();
var visits = records.Select(r => new Visit { ReceptionRecordId = r.Id, PatientId = patient.Id,
    DoctorId = doctor.Id, DepartmentId = department.Id, ExamStatus = "Waiting" }).ToArray();
db.Add(visits[0]); await db.SaveChangesAsync(); db.Add(visits[1]);
try { await db.SaveChangesAsync(); throw new InvalidOperationException("Duplicate V2 active Visit was allowed"); }
catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 }) { checks++; }
db.ChangeTracker.Clear();

// Downgrade removes only indexes; a conflicting V2 fixture must block re-upgrade without deleting data.
await migrator.MigrateAsync(previous);
Check(await db.Requests.AnyAsync(r => r.Id == first.Id), "Downgrade must preserve V2 data");
db.Add(Request("ja")); await db.SaveChangesAsync();
var before = await db.Requests.OrderBy(r => r.Id).Select(r => r.Id).ToArrayAsync();
try { await migrator.MigrateAsync(); throw new InvalidOperationException("Conflicting V2 fixture must stop migration"); }
catch (SqlException ex) when (ex.Number == 51006) { checks++; }
var after = await db.Requests.OrderBy(r => r.Id).Select(r => r.Id).ToArrayAsync();
Check(before.SequenceEqual(after), "Blocked upgrade must retain every ID");
Check(!(await db.Database.GetAppliedMigrationsAsync()).Any(m => m.EndsWith("RegistrationUniquenessV2")), "Blocked migration must not be recorded as applied");
Console.WriteLine($"PASS {checks} migration assertions; retained isolated database {connection.InitialCatalog}.");
