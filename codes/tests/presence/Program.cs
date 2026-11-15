using System.Diagnostics;
using System.Text.Json;
using Hospital.Api.Administration;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB028_SQL_CONNECTION")
    ?? throw new InvalidOperationException("Set PB028_SQL_CONNECTION to local test SQL."));
var host = connection.DataSource.Split(',')[0];
if (!(host is "localhost" or "127.0.0.1" or "." || host.StartsWith("(localdb)\\") || host.StartsWith(".\\")))
    throw new InvalidOperationException("Local SQL fixtures only.");
connection.InitialCatalog = "HospitalPB028_" + Guid.NewGuid().ToString("N");
var options = new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options;
HospitalDb Db() => new(options);
var checks = 0;
void Check(bool ok, string why) { checks++; if (!ok) throw new Exception(why); }
async Task Denied(Func<Task> action, int status) {
    try { await action(); throw new Exception("Expected denial " + status); }
    catch (ApiException e) { Check(e.Status == status, "Correct denial: " + e.Code); }
}
var clock = new ControlledClock(DateTimeOffset.UtcNow);
var settings = PresenceSettings.From(new ConfigurationBuilder().Build());
Check(settings == new PresenceSettings(15, 60), "Default 15-second heartbeat, 60-second TTL");
try { PresenceSettings.From(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Presence:TtlSeconds"] = "10" }).Build()); throw new Exception("Expected configuration failure"); }
catch (InvalidOperationException) { Check(true, "Invalid TTL rejected"); }

await using var db = Db();
var migrations = db.Database.GetMigrations().ToArray();
var presenceMigration = Array.FindIndex(migrations, m => m.EndsWith("SessionPresence"));
var previous = migrations[presenceMigration - 1];
await db.GetService<IMigrator>().MigrateAsync(previous);
var legacyPatient = Guid.NewGuid(); var legacySession = Guid.NewGuid(); var legacyHash = Crypto.Hash(Crypto.Token());
await db.Database.ExecuteSqlInterpolatedAsync($"INSERT Patients (Id,Version,CreatedAt,Name,Contact,Language) VALUES ({legacyPatient},1,SYSUTCDATETIME(),N'Historical Guest','same-contact','en');");
await db.Database.ExecuteSqlInterpolatedAsync($"INSERT Sessions (Id,Version,CreatedAt,TokenHash,PatientId,IsGuest,ExpiresAt,Revoked) VALUES ({legacySession},1,SYSUTCDATETIME(),{legacyHash},{legacyPatient},1,DATEADD(hour,8,SYSUTCDATETIME()),0);");
await db.Database.MigrateAsync();
var historical = await db.Sessions.AsNoTracking().SingleAsync(s => s.Id == legacySession);
Check(historical.LastSeenAt == null && historical.TokenHash == legacyHash && historical.Version == 1, "Upgrade preserves sessions and does not infer online presence");
Check(!db.Database.HasPendingModelChanges(), "Migration/model snapshot match");
Check((await db.Patients.SingleAsync(p => p.Id == legacyPatient)).Name == "Historical Guest", "Upgrade preserves identity");

var patient = new Patient { Name = "Same Name", Contact = "same-contact" };
var user = new UserAccount { Name = patient.Name, Email = Guid.NewGuid() + "@example.test", PatientId = patient.Id, Role = "Patient" };
var admin = new UserAccount { Name = "Synthetic Admin", Email = Guid.NewGuid() + "@example.test", Role = "Admin" };
db.AddRange(patient, user, admin); await db.SaveChangesAsync();
async Task<(Session Session, string Token)> Session(UserAccount? account = null, int expiresSeconds = 3600) {
    var token = Crypto.Token();
    var s = new Session { TokenHash = Crypto.Hash(token), UserAccountId = account?.Id,
        PatientId = account?.PatientId ?? (account == null ? legacyPatient : null), IsGuest = account == null,
        ExpiresAt = clock.GetUtcNow().UtcDateTime.AddSeconds(expiresSeconds) };
    await using var write = Db(); write.Add(s); await write.SaveChangesAsync(); return (s, token);
}
Access Access(HospitalDb context, string? token) {
    var http = new DefaultHttpContext(); if (token != null) http.Request.Headers.Authorization = "Bearer " + token;
    return new Access(context, new HttpContextAccessor { HttpContext = http });
}
async Task<PresenceHeartbeat> Beat(string? token, JsonElement? body = null) {
    await using var context = Db();
    return await PresenceEndpoints.Heartbeat(body, Access(context, token), new(context, clock, settings), default);
}
async Task<OnlinePresence> Online() { await using var context = Db(); return await new PresenceService(context, clock, settings).Read(clock.GetUtcNow().UtcDateTime, default); }
var a1 = await Session(user); var a2 = await Session(user); var guest1 = await Session(); var guest2 = await Session(); var administrator = await Session(admin);
Check((await Online()).Total == 0, "Unexpired sessions and historical sessions are not online without heartbeat");
await Denied(async () => { await Beat(null); }, 401);
var forged = JsonSerializer.SerializeToElement(new { userId = admin.Id, role = "Admin", lastSeenAt = clock.GetUtcNow().AddYears(1) });
await Denied(async () => { await Beat(guest1.Token, forged); }, 422);
Check((await Online()).Total == 0, "Forged identity/time fields cannot record presence");
var heartbeat = await Beat(a1.Token);
Check(heartbeat.LastSeenAt.Kind == DateTimeKind.Utc, "Heartbeat response identifies SQL timestamp as UTC");
await Beat(a2.Token); await Beat(guest1.Token); await Beat(guest2.Token);
var online = await Online();
Check(online.Accounts == 1 && online.Guests == 2 && online.Total == 3, "Accounts deduplicate across sessions; Guests with same Patient/name/contact remain distinct sessions");
Check(online.GeneratedAt == clock.GetUtcNow().UtcDateTime && online.TtlSeconds == 60, "Snapshot timestamp and TTL returned");
Check(await db.Sessions.AsNoTracking().AllAsync(s => s.Version == 1), "Heartbeats do not bump business versions");
Check(!await db.Set<AuditEvent>().AnyAsync() && !await db.Set<CommandReceipt>().AnyAsync() && !await db.Set<VisitEvent>().AnyAsync(), "No business audit/receipt/events generated by heartbeat");

async Task<JsonElement> Dashboard(string token) {
    await using var context = Db();
    var result = await AdminDashboard.Read(7, Access(context, token), context, new(context, clock, settings), clock, default);
    return JsonSerializer.SerializeToElement(((IValueHttpResult)result).Value, CommandBus.Json);
}
await Denied(async () => { await Dashboard(guest1.Token); }, 403);
await Denied(async () => { await Dashboard(a1.Token); }, 403);
var dashboard = await Dashboard(administrator.Token);
Check(dashboard.GetProperty("online").GetProperty("total").GetInt32() == 3 && dashboard.GetProperty("summary").GetProperty("activeVisits").GetInt32() == 0
    && dashboard.GetProperty("daily").GetArrayLength() == 7, "Admin-only presence is additive; existing reporting preserved");
await using (var context = Db()) {
    var service = new PresenceService(context, clock, settings);
    await Denied(async () => { await PresenceEndpoints.Read(Access(context, guest1.Token), service, clock, default); }, 403);
    var snapshot = await PresenceEndpoints.Read(Access(context, administrator.Token), service, clock, default);
    Check(snapshot.Total == 3, "Dedicated Admin presence endpoint follows the shared V2 contract");
}
clock.Advance(TimeSpan.FromMilliseconds(59999)); Check((await Online()).Total == 3, "Within TTL included");
clock.Advance(TimeSpan.FromMilliseconds(1)); Check((await Online()).Total == 0, "At TTL boundary excluded");
await Beat(a1.Token); await Beat(a2.Token); await Beat(guest1.Token);
await db.Sessions.Where(s => s.Id == a1.Session.Id).ExecuteUpdateAsync(u => u.SetProperty(s => s.Revoked, true));
Check((await Online()).Accounts == 1, "Revoking one session keeps another valid session of that Account online");
await db.Users.Where(u => u.Id == user.Id).ExecuteUpdateAsync(u => u.SetProperty(u => u.Active, false));
Check((await Online()).Accounts == 0, "Disabled accounts excluded immediately");
await Denied(async () => { await Beat(a2.Token); }, 401);
await db.Sessions.Where(s => s.Id == guest1.Session.Id).ExecuteUpdateAsync(u => u.SetProperty(s => s.Revoked, true));
await Denied(async () => { await Beat(guest1.Token); }, 401);
Check((await Online()).Total == 0, "Revoked Guest excluded before TTL");
var expiring = await Session(expiresSeconds: 10); var originalExpiry = expiring.Session.ExpiresAt;
await Beat(expiring.Token); clock.Advance(TimeSpan.FromSeconds(10));
await Denied(async () => { await Beat(expiring.Token); }, 401);
Check((await Online()).Total == 0, "Session expiry takes precedence over presence TTL");
Check((await db.Sessions.AsNoTracking().SingleAsync(s => s.Id == expiring.Session.Id)).ExpiresAt == originalExpiry, "Heartbeat does not extend authentication expiry");
var concurrent = await Session();
await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Beat(concurrent.Token)));
Check((await Online()).Guests == 1, "Concurrent heartbeats remain one Guest");
var last = (await db.Sessions.AsNoTracking().SingleAsync(s => s.Id == concurrent.Session.Id)).LastSeenAt;
clock.Advance(TimeSpan.FromSeconds(-1)); await Beat(concurrent.Token);
Check((await db.Sessions.AsNoTracking().SingleAsync(s => s.Id == concurrent.Session.Id)).LastSeenAt == last, "Out-of-order writes cannot move LastSeenAt backwards");
clock.Advance(TimeSpan.FromSeconds(1));

// Holding the exact business application lock must not block presence writes.
await using (var blocker = new SqlConnection(connection.ConnectionString)) {
    await blocker.OpenAsync(); await using var transaction = blocker.BeginTransaction();
    await using var command = blocker.CreateCommand(); command.Transaction = transaction;
    command.CommandText = "DECLARE @r int; EXEC @r=sp_getapplock @Resource=N'hospital:commands',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=1000; IF @r<0 THROW 51000,'Fixture lock failed',1;";
    await command.ExecuteNonQueryAsync();
    var watch = Stopwatch.StartNew(); await Beat(concurrent.Token).WaitAsync(TimeSpan.FromSeconds(5));
    Console.WriteLine($"Heartbeat while global business lock held: {watch.Elapsed.TotalMilliseconds:F1} ms.");
    await transaction.RollbackAsync();
    Check(true, "Heartbeat bypasses global business application lock");
}
var identitiesBefore = await db.Sessions.AsNoTracking().OrderBy(s => s.Id)
    .Select(s => new { s.Id, s.TokenHash, s.PatientId, s.UserAccountId, s.IsGuest, s.Revoked, s.ExpiresAt, s.Version }).ToListAsync();
await db.GetService<IMigrator>().MigrateAsync(previous);
await using (var raw = new SqlConnection(connection.ConnectionString)) {
    await raw.OpenAsync(); await using var count = raw.CreateCommand(); count.CommandText = "SELECT COUNT(*) FROM Sessions";
    Check(Convert.ToInt32(await count.ExecuteScalarAsync()) == identitiesBefore.Count, "Downgrade retains every authentication session");
}
db.ChangeTracker.Clear(); await db.Database.MigrateAsync();
var identitiesAfter = await db.Sessions.AsNoTracking().OrderBy(s => s.Id)
    .Select(s => new { s.Id, s.TokenHash, s.PatientId, s.UserAccountId, s.IsGuest, s.Revoked, s.ExpiresAt, s.Version }).ToListAsync();
Check(identitiesBefore.SequenceEqual(identitiesAfter), "Downgrade/reupgrade preserves all authentication identity, expiry and revocation fields");
Check(await db.Sessions.AllAsync(s => s.LastSeenAt == null) && (await Online()).Total == 0, "Reupgrade resets only derived presence, never fabricates activity");
var freshConnection = new SqlConnectionStringBuilder(connection.ConnectionString) { InitialCatalog = "HospitalPB028_fresh_" + Guid.NewGuid().ToString("N") };
await using var freshDb = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(freshConnection.ConnectionString).Options);
await freshDb.Database.MigrateAsync();
Check(!freshDb.Database.HasPendingModelChanges() && !await freshDb.Sessions.AnyAsync(), "Fresh database migrates without synthesized sessions");
Console.WriteLine($"PASS PB028: {checks} checks, controlled-clock TTL/identity/permissions/concurrency/lock independence and fresh/upgrade/downgrade/reupgrade. Retained {connection.InitialCatalog}, {freshConnection.InitialCatalog}.");

sealed class ControlledClock(DateTimeOffset initial) : TimeProvider {
    DateTimeOffset utc = initial;
    public override DateTimeOffset GetUtcNow() => utc;
    public void Advance(TimeSpan duration) => utc += duration;
}
