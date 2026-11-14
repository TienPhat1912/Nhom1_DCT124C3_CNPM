using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB011_SQL_CONNECTION") ?? throw new InvalidOperationException("Set PB011_SQL_CONNECTION to local SQL."));
if (!(connection.DataSource.StartsWith("127.0.0.1,") || connection.DataSource == "localhost" || connection.DataSource.StartsWith("(localdb)\\") || connection.DataSource.StartsWith(".\\"))) throw new InvalidOperationException("Only local SQL fixtures are permitted.");
connection.InitialCatalog = "HospitalPB011_" + Guid.NewGuid().ToString("N");
await using var db = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
var migrator = db.GetService<IMigrator>(); const string previous = "20261113224433_DoctorConsultation";
var checks = 0;
void Check(bool ok) { if (!ok) throw new InvalidOperationException("Migration assertion failed"); checks++; }
async Task Reject(Func<Task> action, int number) {
    try { await action(); } catch (SqlException ex) when (ex.Number == number) { checks++; return; }
    throw new InvalidOperationException("Expected SQL rejection " + number);
}
await migrator.MigrateAsync(previous);
await Seed.Run(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Demo:Enabled"] = "true", ["Demo:Password"] = "Synthetic-PB011-Fixture!" }).Build());
var doctor = await db.Users.SingleAsync(u => u.Email == "doctor@demo.local");
var service = await db.Set<HospitalService>().SingleAsync(s => s.Code == "LAB");
var patient = new Patient(); var session = new Session { PatientId = patient.Id, TokenHash = Crypto.Hash(Guid.NewGuid().ToString()) };
var request = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = service.DepartmentId, Status = "Confirmed" };
var reception = new ReceptionRecord { PatientId = patient.Id, RegistrationRequestId = request.Id, ConfirmedBy = doctor.Id };
var visit = new Visit { PatientId = patient.Id, ReceptionRecordId = reception.Id, DepartmentId = service.DepartmentId, DoctorId = doctor.Id };
db.AddRange(patient, session, request, reception, visit); await db.SaveChangesAsync();
var oldIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
foreach (var id in oldIds) await db.Database.ExecuteSqlInterpolatedAsync($"INSERT DoctorOrder (Id,Version,CreatedAt,VisitId,HospitalServiceId,OrderedBy,Status,Note,MappingVersion) VALUES ({id},1,{DateTime.UtcNow},{visit.Id},{service.Id},{doctor.Id},'NotCompleted','  legacy original  ',1)");
await Reject(() => migrator.MigrateAsync(), 51013);
Check(await db.Set<DoctorOrder>().CountAsync() == 2);
Check(!(await db.Database.GetAppliedMigrationsAsync()).Any(m => m.EndsWith("SingleServiceOrder")));
// Explicit fixture reconciliation; the migration never changes legacy statuses itself.
await db.Database.ExecuteSqlRawAsync("UPDATE DoctorOrder SET Status='Ordered'");
await migrator.MigrateAsync(); Check(!db.Database.HasPendingModelChanges());
Check(await db.Set<DoctorOrder>().AllAsync(o => oldIds.Contains(o.Id) && o.Note == "  legacy original  " && o.Status == "Ordered" && o.ConsultationNumber == null && o.ServiceSnapshot == null));
await migrator.MigrateAsync(previous);
Check(!(await db.Database.GetAppliedMigrationsAsync()).Any(m => m.EndsWith("SingleServiceOrder")));
await migrator.MigrateAsync();
var order = new DoctorOrder { VisitId = visit.Id, HospitalServiceId = service.Id, OrderedBy = doctor.Id, Status = "NotCompleted", ConsultationNumber = 1,
    ServiceSnapshot = "{}", DestinationSnapshot = "{}", OrderedBySnapshot = "{}" };
db.Add(order); await db.SaveChangesAsync();
var duplicate = new DoctorOrder { VisitId = visit.Id, HospitalServiceId = service.Id, OrderedBy = doctor.Id, Status = "NotCompleted", ConsultationNumber = 1,
    ServiceSnapshot = "{}", DestinationSnapshot = "{}", OrderedBySnapshot = "{}" };
db.Add(duplicate);
try { await db.SaveChangesAsync(); throw new InvalidOperationException("Duplicate pending order allowed"); }
catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 }) { checks++; }
db.ChangeTracker.Clear();
await Reject(() => migrator.MigrateAsync(previous), 51014);
Check(await db.Set<DoctorOrder>().CountAsync() == 3);
Check(await db.Set<DoctorOrder>().AnyAsync(o => o.Id == order.Id && o.Status == "NotCompleted"));
Console.WriteLine($"PASS {checks} migration assertions; retained {connection.InitialCatalog}.");
