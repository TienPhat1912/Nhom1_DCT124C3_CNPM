using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB010_SQL_CONNECTION") ?? throw new InvalidOperationException("Set PB010_SQL_CONNECTION to a local test SQL server."));
if (!(connection.DataSource.StartsWith("127.0.0.1,") || connection.DataSource == "localhost" || connection.DataSource.StartsWith("(localdb)\\") || connection.DataSource.StartsWith(".\\"))) throw new InvalidOperationException("Local SQL only.");
connection.InitialCatalog = "HospitalPB010_" + Guid.NewGuid().ToString("N");
await using var db = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
var migrator = db.GetService<IMigrator>(); const string previous = "20261112200836_TicketNumberPerClinicDay";
var checks = 0;
void Check(bool condition) { if (!condition) throw new InvalidOperationException("Migration assertion failed"); checks++; }
async Task Reject(Func<Task> action, int number) {
    try { await action(); } catch (SqlException ex) when (ex.Number == number) { checks++; return; }
    throw new InvalidOperationException("Expected SQL rejection " + number);
}
await migrator.MigrateAsync(previous);
await Seed.Run(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Demo:Enabled"] = "true", ["Demo:Password"] = "Synthetic-PB010-Fixture!"
}).Build());
var doctor = await db.Users.SingleAsync(x => x.Email == "doctor@demo.local");
var clinic = await db.Set<ClinicRoom>().SingleAsync(x => x.ActiveDoctorId == doctor.Id);
var department = await db.Set<Location>().Where(x => x.Id == clinic.ClinicLocationId).Select(x => x.DepartmentId).SingleAsync();
Visit Create() {
    var patient = new Patient(); var session = new Session { PatientId = patient.Id, TokenHash = Crypto.Hash(Guid.NewGuid().ToString()) };
    var request = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = department, Status = "Confirmed" };
    var record = new ReceptionRecord { PatientId = patient.Id, RegistrationRequestId = request.Id, ConfirmedBy = doctor.Id };
    var visit = new Visit { PatientId = patient.Id, ReceptionRecordId = record.Id, DepartmentId = department, DoctorId = doctor.Id,
        ClinicLocationId = clinic.ClinicLocationId, ExamStatus = "InConsultation", ConsultationCount = 1 };
    visit.Ticket = new ExaminationTicket { VisitId = visit.Id, Number = "H-" + visit.Id.ToString("N") };
    db.AddRange(patient, session, request, record, visit); return visit;
}
var first = Create(); var second = Create(); await db.SaveChangesAsync();
await Reject(() => migrator.MigrateAsync(), 51010);
Check(!(await db.Database.GetAppliedMigrationsAsync()).Any(x => x.EndsWith("DoctorConsultation")));
Check(await db.Visits.CountAsync() == 2);
second.ExamStatus = "Waiting"; await db.SaveChangesAsync();
await migrator.MigrateAsync(); Check(!db.Database.HasPendingModelChanges());
Check(await db.Set<ExaminationTicket>().AllAsync(t => t.Number.StartsWith("H-") && t.SequenceNumber == null));
try { await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE Visits SET ExamStatus='InConsultation' WHERE Id={second.Id}"); throw new InvalidOperationException("Unique clinic constraint missing"); }
catch (SqlException ex) when (ex.Number is 2601 or 2627) { checks++; }
var call = new ConsultationCall { VisitId = first.Id, ClinicLocationId = clinic.ClinicLocationId, DoctorId = doctor.Id, ConsultationNumber = 1 };
db.Add(call); await db.SaveChangesAsync();
await Reject(() => migrator.MigrateAsync(previous), 51011);
Check(await db.Set<ConsultationCall>().AnyAsync(c => c.Id == call.Id));
Check(await db.Visits.CountAsync() == 2);
Console.WriteLine($"PASS {checks} migration assertions; retained {connection.InitialCatalog}.");
