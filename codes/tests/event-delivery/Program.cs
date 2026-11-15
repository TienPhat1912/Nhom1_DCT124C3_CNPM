using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("PB023_SQL_CONNECTION")
    ?? throw new InvalidOperationException("Set PB023_SQL_CONNECTION to a local test SQL server."));
if (!(connection.DataSource == "localhost" || connection.DataSource.StartsWith(".\\") || connection.DataSource.StartsWith("(localdb)\\")))
    throw new InvalidOperationException("Local SQL only.");
connection.InitialCatalog = "HospitalPB023_" + Guid.NewGuid().ToString("N");
await using var db = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
var migrator = db.GetService<IMigrator>();
var previous = db.Database.GetMigrations().Last(m => !m.EndsWith("VisitEventDelivery"));
await migrator.MigrateAsync(previous);
await Seed.Run(db, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Demo:Enabled"] = "true", ["Demo:Password"] = "Synthetic-PB023-Fixture!"
}).Build());
var patient = new Patient { Name = "Synthetic historical patient" }; db.Add(patient);
var notification = new Notification { PatientId = patient.Id, Key = "historicalNotification" };
db.Add(notification); await db.SaveChangesAsync();
var count = await db.Patients.CountAsync();
await migrator.MigrateAsync();
if (db.Database.HasPendingModelChanges() || await db.Set<VisitEvent>().AnyAsync()
    || await db.Patients.CountAsync() != count || !await db.Set<Notification>().AnyAsync(n => n.Id == notification.Id))
    throw new InvalidOperationException("Upgrade must preserve historical data without synthesizing events.");
await migrator.MigrateAsync(previous);
if (!await db.Set<Notification>().AnyAsync(n => n.Id == notification.Id)) throw new InvalidOperationException("Downgrade lost existing notifications.");
await migrator.MigrateAsync();
Console.WriteLine($"PASS PB023 old-schema upgrade/downgrade/reupgrade, preservation and model checks; retained {connection.InitialCatalog}.");
