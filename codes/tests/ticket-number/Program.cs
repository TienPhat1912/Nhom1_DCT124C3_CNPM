using Hospital.Tests.Fixtures;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Hospital.Api.Reception;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using System.Globalization;

var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB007_SQL_CONNECTION")
    ?? throw new InvalidOperationException("Set PB007_SQL_CONNECTION explicitly to a local test SQL server."));
if (!(connection.DataSource.StartsWith("127.0.0.1,", StringComparison.OrdinalIgnoreCase)
    || connection.DataSource.Equals("localhost", StringComparison.OrdinalIgnoreCase)
    || connection.DataSource.StartsWith("(localdb)\\", StringComparison.OrdinalIgnoreCase)
    || connection.DataSource.StartsWith(".\\", StringComparison.Ordinal)))
    throw new InvalidOperationException("Only local SQL fixtures are permitted.");
connection.InitialCatalog = "HospitalPB007_" + Guid.NewGuid().ToString("N");
HospitalDb Open() => new(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
await using var db = Open();
var migrator = db.GetService<IMigrator>();
const string previous = "20261112153806_RegistrationUniquenessV2";
int checks = 0;
void Check(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); checks++; }
async Task Reject(Func<Task> action, Func<Exception, bool> matches, string message)
{
    try { await action(); } catch (Exception ex) when (matches(ex)) { checks++; return; }
    throw new InvalidOperationException(message);
}
bool SqlViolation(Exception ex) => ex is DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 or 547 } };

await migrator.MigrateAsync(previous);
await Seed.Run(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Demo:Enabled"] = "true", ["Demo:Password"] = "Synthetic-PB007-Fixture!"
}).Build());
var patientId = await db.Patients.Select(x => x.Id).FirstAsync();
var doctorId = await db.Users.Where(x => x.Email == "doctor@demo.local").Select(x => x.Id).SingleAsync();
var departmentId = await db.Set<Department>().Where(x => x.Code == "CONSULT").Select(x => x.Id).SingleAsync();
var clinics = await db.Set<ClinicRoom>().Select(x => x.ClinicLocationId).OrderBy(x => x).ToArrayAsync();
var session = new Session { PatientId = patientId, IsGuest = true, TokenHash = Crypto.Hash(Guid.NewGuid().ToString()), ExpiresAt = DateTime.UtcNow.AddHours(1) };
await LegacySessionFixture.Insert(db, session);
ExaminationTicket Ticket(HospitalDb context, string number = "")
{
    var request = new RegistrationRequest { PatientId = patientId, SessionId = session.Id, DepartmentId = departmentId, Status = "Confirmed" };
    var reception = new ReceptionRecord { PatientId = patientId, RegistrationRequestId = request.Id, ConfirmedBy = doctorId };
    var visit = new Visit { PatientId = patientId, ReceptionRecordId = reception.Id, DepartmentId = departmentId, DoctorId = doctorId };
    var ticket = new ExaminationTicket { VisitId = visit.Id, Number = number };
    context.AddRange(request, reception, visit, ticket);
    return ticket;
}
var legacy = Ticket(db, "H-UNCHANGED");
// Save only columns present before PB-007, using the historical schema.
db.Entry(legacy).State = EntityState.Detached;
await db.SaveChangesAsync();
await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO ExaminationTicket (Id, Version, CreatedAt, VisitId, Number, SnapshotSource) VALUES ({legacy.Id}, 1, {legacy.CreatedAt}, {legacy.VisitId}, {legacy.Number}, 'LegacyMissing')");
await migrator.MigrateAsync();
Check(!db.Database.HasPendingModelChanges(), "Snapshot must match runtime model");
var retained = await db.Set<ExaminationTicket>().AsNoTracking().SingleAsync(x => x.Id == legacy.Id);
Check(retained.Number == legacy.Number && retained.ClinicLocationId == null && retained.IssuedOn == null && retained.SequenceNumber == null,
    "Upgrade must preserve legacy ID/number and unknown numbering fields");
Check(!await db.Set<TicketDailyCounter>().AnyAsync(), "Upgrade must not infer counters from legacy tickets");

var clock = new FixtureClock(DateTimeOffset.Parse("2026-11-12T16:59:59Z")); // 23:59:59 Vietnam
async Task<AllocatedTicketNumber> Allocate(Guid clinic, TimeProvider time)
{
    await using var context = Open();
    await using var tx = await context.Database.BeginTransactionAsync();
    var ticket = Ticket(context);
    var result = await new TicketNumberAllocator(context, time).AssignAsync(ticket, clinic);
    await context.SaveChangesAsync(); await tx.CommitAsync(); return result;
}
// Separate contexts/connections, no CommandBus global lock: exercise the allocator's own SQL lock.
async Task<AllocatedTicketNumber> InCulture(int index)
{
    var before = CultureInfo.CurrentCulture;
    try {
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo(index % 2 == 0 ? "th-TH" : "en-US");
        return await Allocate(clinics[0], clock);
    } finally { CultureInfo.CurrentCulture = before; }
}
var concurrent = await Task.WhenAll(Enumerable.Range(0, 24).Select(InCulture));
Check(concurrent.Select(x => x.SequenceNumber).Order().SequenceEqual(Enumerable.Range(1, 24)), "Concurrent allocations must be exactly 1..24");
Check(concurrent.All(x => x.Number == x.SequenceNumber.ToString("D3") && x.IssuedOn == new DateOnly(2026, 11, 12)), "Numbers must be padded and date must be Vietnam date");
var secondRoom = await Allocate(clinics[1], clock);
Check(secondRoom.Number == "001", "Second clinic must start at 001");
var tomorrow = new FixtureClock(DateTimeOffset.Parse("2026-11-12T17:00:00Z"));
var nextDay = await Allocate(clinics[0], tomorrow);
Check(nextDay.Number == "001" && nextDay.IssuedOn == new DateOnly(2026, 11, 13), "Vietnam midnight must start a new counter even on the same UTC date");
Check(nextDay.DisplayNumber != concurrent[0].DisplayNumber && secondRoom.DisplayNumber != concurrent[0].DisplayNumber,
    "Full display reference must distinguish clinic/date");
Check((await Allocate(clinics[0], clock)).SequenceNumber == 25, "Previous day's counter must remain independent");

await using (var context = Open()) {
    await Reject(async () => { await new TicketNumberAllocator(context, clock).AssignAsync(new(), clinics[0]); },
        ex => ex is InvalidOperationException, "Allocation without caller transaction must fail");
    await using var tx = await context.Database.BeginTransactionAsync();
    var allocator = new TicketNumberAllocator(context, clock);
    await Reject(async () => { await allocator.AssignAsync(retained, clinics[0]); }, ex => ex is InvalidOperationException,
        "Legacy tickets must not be renumbered");
    await Reject(async () => { await allocator.AssignAsync(Ticket(context), Guid.NewGuid()); }, ex => ex is ApiException { Code: "invalidClinic" },
        "Unknown clinic must fail");
    var persistedBlank = Ticket(context); await context.SaveChangesAsync();
    await Reject(async () => { await allocator.AssignAsync(persistedBlank, clinics[0]); }, ex => ex is InvalidOperationException,
        "An existing blank legacy ticket must not be assigned a new number");
    var ticket = Ticket(context);
    await allocator.AssignAsync(ticket, clinics[0]);
    await Reject(async () => { await allocator.AssignAsync(ticket, clinics[1]); }, ex => ex is InvalidOperationException,
        "Issued tickets must not be renumbered in another clinic/day");
    await context.SaveChangesAsync(); await tx.RollbackAsync();
}
Check((await Allocate(clinics[0], clock)).SequenceNumber == 26, "Rollback of ticket and counter must return the number for reuse");
// Missing-row rollback must not leave an empty or incremented first counter.
var later = new FixtureClock(DateTimeOffset.Parse("2026-11-14T00:00:00Z"));
await using (var context = Open()) {
    await using var tx = await context.Database.BeginTransactionAsync();
    await new TicketNumberAllocator(context, later).AssignAsync(Ticket(context), clinics[0]);
    await context.SaveChangesAsync(); await tx.RollbackAsync();
}
Check((await Allocate(clinics[0], later)).SequenceNumber == 1, "First allocation rollback must preserve start at 001");

var key = Guid.NewGuid().ToString("N"); var scope = "pb007:fixture";
async Task<AllocatedTicketNumber> Command(string commandKey, bool fail = false, int payload = 1)
{
    await using var context = Open();
    var http = new DefaultHttpContext(); http.Request.Headers["Idempotency-Key"] = commandKey;
    var bus = new CommandBus(context, new HttpContextAccessor { HttpContext = http });
    return await bus.Run(scope, new { payload }, async () => {
        var value = await new TicketNumberAllocator(context, tomorrow).AssignAsync(Ticket(context), clinics[1]);
        if (fail) throw new FixtureFailure();
        return value;
    });
}
var replay = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => Command(key)));
Check(replay.All(x => x == replay[0]) && replay[0].Number == "001", "Concurrent command retries must replay the same result");
Check(await db.Set<CommandReceipt>().CountAsync(x => x.Scope == scope && x.Key == key) == 1, "Retry must produce one receipt");
Check(await db.Set<ExaminationTicket>().CountAsync(x => x.ClinicLocationId == clinics[1] && x.IssuedOn == new DateOnly(2026, 11, 13)) == 1,
    "Retry must produce one ticket");
await Reject(async () => { await Command(key, payload: 2); }, ex => ex is ApiException { Code: "idempotencyConflict" }, "Changed payload must not replay");
var failedKey = Guid.NewGuid().ToString("N");
await Reject(async () => { await Command(failedKey, fail: true); }, ex => ex is FixtureFailure, "Synthetic command must roll back");
Check(!await db.Set<CommandReceipt>().AnyAsync(x => x.Scope == scope && x.Key == failedKey), "Failed command must not write receipt");
Check((await Command(failedKey)).SequenceNumber == 2, "Retry after failed command must not burn a number");

// Check SQL constraints independently of allocator validation.
async Task InvalidTicket(Action<ExaminationTicket> change)
{
    await using var context = Open(); var ticket = Ticket(context); change(ticket);
    await Reject(async () => { await context.SaveChangesAsync(); }, SqlViolation, "Invalid ticket insert must fail at SQL boundary");
}
await InvalidTicket(x => { x.ClinicLocationId = clinics[0]; });
await InvalidTicket(x => { x.ClinicLocationId = clinics[0]; x.IssuedOn = new(2026, 11, 12); x.SequenceNumber = 0; });
await InvalidTicket(x => { x.ClinicLocationId = clinics[0]; x.IssuedOn = new(2026, 11, 12); x.SequenceNumber = 1; x.Number = "001"; });
await InvalidTicket(x => { x.ClinicLocationId = Guid.NewGuid(); x.IssuedOn = new(2026, 11, 12); x.SequenceNumber = 1; });
await using (var context = Open()) {
    context.Add(new TicketDailyCounter { ClinicLocationId = clinics[0], IssuedOn = new(2026, 11, 12), LastNumber = 100 });
    await Reject(async () => { await context.SaveChangesAsync(); }, SqlViolation, "Duplicate counter key must fail");
}
await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE TicketDailyCounters SET LastNumber = 999 WHERE ClinicLocationId = {clinics[0]} AND IssuedOn = {new DateOnly(2026, 11, 14)}");
Check((await Allocate(clinics[0], later)).Number == "1000", "Padding must not truncate numbers greater than 999");

// Reading/reprinting after date/room configuration changes uses stored fields, not allocation.
var storedBefore = await db.Set<ExaminationTicket>().AsNoTracking().Where(x => x.ClinicLocationId != null).OrderBy(x => x.Id)
    .Select(x => new { x.Id, x.Number, x.ClinicLocationId, x.IssuedOn, x.SequenceNumber }).ToArrayAsync();
var location = await db.Set<Location>().SingleAsync(x => x.Id == clinics[0]); location.Room = "RENAMED"; await db.SaveChangesAsync();
var storedAfter = await db.Set<ExaminationTicket>().AsNoTracking().Where(x => x.ClinicLocationId != null).OrderBy(x => x.Id)
    .Select(x => new { x.Id, x.Number, x.ClinicLocationId, x.IssuedOn, x.SequenceNumber }).ToArrayAsync();
Check(storedBefore.SequenceEqual(storedAfter), "Reprint/read and room rename must preserve every issued number");
var ids = await db.Set<ExaminationTicket>().OrderBy(x => x.Id).Select(x => x.Id).ToArrayAsync();
await Reject(async () => { await migrator.MigrateAsync(previous); }, ex => ex is SqlException { Number: 51008 },
    "Downgrade must refuse to discard issued clinic/date/sequence or counters");
Check((await db.Database.GetAppliedMigrationsAsync()).Any(x => x.EndsWith("TicketNumberPerClinicDay")), "Blocked downgrade must retain migration history");
var restoredIds = await db.Set<ExaminationTicket>().OrderBy(x => x.Id).Select(x => x.Id).ToArrayAsync();
Check(ids.SequenceEqual(restoredIds), "Blocked downgrade must preserve every ticket ID");
var finalNumbers = await db.Set<ExaminationTicket>().AsNoTracking().Where(x => x.ClinicLocationId != null).OrderBy(x => x.Id)
    .Select(x => new { x.Id, x.Number, x.ClinicLocationId, x.IssuedOn, x.SequenceNumber }).ToArrayAsync();
Check(storedAfter.SequenceEqual(finalNumbers), "Blocked downgrade must preserve every issued number");
Check((await db.Set<ExaminationTicket>().AsNoTracking().SingleAsync(x => x.Id == legacy.Id)).Number == legacy.Number,
    "All operations must preserve the legacy number");
// Exercise latest migration directly on a fresh database and safe downgrade before any allocation.
var freshConnection = new SqlConnectionStringBuilder(connection.ConnectionString) { InitialCatalog = "HospitalPB007_fresh_" + Guid.NewGuid().ToString("N") };
await using (var fresh = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(freshConnection.ConnectionString).Options)) {
    var freshMigrator = fresh.GetService<IMigrator>();
    await freshMigrator.MigrateAsync();
    Check(!fresh.Database.HasPendingModelChanges(), "Fresh latest schema must match snapshot");
    await freshMigrator.MigrateAsync(previous);
    Check(!(await fresh.Database.GetAppliedMigrationsAsync()).Any(x => x.EndsWith("TicketNumberPerClinicDay")), "Unused numbering schema can downgrade safely");
    await freshMigrator.MigrateAsync();
    Check(!await fresh.Set<TicketDailyCounter>().AnyAsync(), "Re-upgrade without issued tickets must be empty");
    Console.WriteLine($"Retained fresh schema database {freshConnection.InitialCatalog}.");
}
Console.WriteLine($"PASS {checks} ticket-number assertions; retained isolated database {connection.InitialCatalog}.");

sealed class FixtureClock(DateTimeOffset now) : TimeProvider { public override DateTimeOffset GetUtcNow() => now; }
sealed class FixtureFailure : Exception;
