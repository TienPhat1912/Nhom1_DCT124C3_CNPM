using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

await Rehearsal.Run();

static class Rehearsal
{
    const string Legacy = "20261025035340_VietnameseSource";
    static SqlConnectionStringBuilder server = null!;
    static readonly List<object> evidence = [];
    static int checks;
    static string output = "";
    static readonly string runId = Guid.NewGuid().ToString("N");
    static void Check(bool ok, string message)
    {
        if (!ok) throw new InvalidOperationException(message);
        checks++;
    }
    static string Q(string name) => "[" + name.Replace("]", "]]") + "]";
    static HospitalDb Db(string name)
    {
        var connection = new SqlConnectionStringBuilder(server.ConnectionString) { InitialCatalog = name, Pooling = false };
        return new(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
    }
    static string Name(string label) => $"HospitalPB030_{runId}_{label}";

    public static async Task Run()
    {
        // Never read the application connection or environment file. Always generate new databases.
        server = new(Environment.GetEnvironmentVariable("PB030_SQL_CONNECTION")
            ?? throw new InvalidOperationException("Set PB030_SQL_CONNECTION explicitly to a local fixture server."));
        if (!Regex.IsMatch(server.DataSource, @"^(localhost|127\.0\.0\.1|\.)(,\d+)?$|^(\(localdb\)|\.|localhost)\\[\w-]+$", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Only local SQL Server fixture instances are allowed.");
        server.InitialCatalog = "master";
        output = Path.GetFullPath(Environment.GetEnvironmentVariable("PB030_REPORT") ?? "artifacts/pb030-rehearsal.json");
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        var passed = false;
        try {
            await Fresh();
            await LegacyCase("clean", false);
            await LegacyCase("conflict", true);
            await OrderGuard();
            passed = true;
        }
        catch (Exception e) {
            // Do not emit SQL messages, connection strings, snapshots or patient data.
            evidence.Add(new { stage = "failure", type = e.GetType().Name, sqlNumber = (e as SqlException)?.Number });
            Console.Error.WriteLine("FAIL PB-030. Review the last completed stage in the report; no cutover is authorized.");
        }
        finally {
            await File.WriteAllTextAsync(output, JsonSerializer.Serialize(new {
                task = "PB-030", runId, utc = DateTimeOffset.UtcNow, passed, checks,
                fixtureOnly = true, cutoverEnabled = false, evidence
            }, new JsonSerializerOptions { WriteIndented = true }));
        }
        Console.WriteLine($"PB-030: {(passed ? "PASS" : "FAIL")}, {checks} assertions. Report: {output}");
        if (!passed) Environment.ExitCode = 1;
    }

    static async Task Fresh()
    {
        Console.WriteLine("Rehearsing fresh database and empty-schema downgrade.");
        await using var db = Db(Name("fresh"));
        await db.Database.MigrateAsync();
        Check(!db.Database.HasPendingModelChanges(), "Model snapshot must match");
        Check(!(await db.Database.GetPendingMigrationsAsync()).Any(), "All migrations applied");
        var before = await Snapshot(db);
        await db.Database.MigrateAsync();
        Equal(before, await Snapshot(db));
        Check((await Review(db, "cutover-review.sql")).Count == 0, "Empty fresh schema has no blockers");
        await ForeignKeys(db);
        await db.GetService<IMigrator>().MigrateAsync(Legacy);
        await db.Database.MigrateAsync();
        Equal(before, await Snapshot(db));
        evidence.Add(new { stage = "fresh", database = Name("fresh"), migrations = await db.Database.GetAppliedMigrationsAsync(), tables = before });
    }

    static async Task LegacyCase(string label, bool conflict)
    {
        Console.WriteLine("Rehearsing legacy fixture: " + label);
        var name = Name(label);
        await using var db = Db(name);
        await db.GetService<IMigrator>().MigrateAsync(Legacy);
        await Fixture(db, conflict);
        var projection = await Columns(db);
        var original = await Snapshot(db, projection);
        var originalMigrations = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
        // A real COPY_ONLY backup precedes all audit/migration operations.
        var backup = await Backup(name);
        var findings = await Review(db, "legacy-audit.sql");
        Equal(original, await Snapshot(db, projection));
        Check(findings.Any(f => f.Reason == "guest_link_history"), "Linked Guest history audited");
        if (conflict) {
            foreach (var reason in new[] { "room_multiple_consultations", "visit_multiple_open_orders", "destination_snapshot_incomplete" })
                Check(findings.Any(f => f.Reason == reason), "Conflict reported: " + reason);
            // Workflow stops BEFORE migration; no deletion or automatic resolution is allowed.
            Check(originalMigrations.SequenceEqual(await db.Database.GetAppliedMigrationsAsync()), "Blocked preflight does not migrate");
            evidence.Add(new { stage = "preflight-blocked", database = name, findings });
        } else {
            Check(!findings.Any(f => f.Reason is "room_multiple_consultations" or "visit_multiple_open_orders" or "destination_snapshot_incomplete"), "Clean historical fixture has no structural conflicts");
            await db.Database.MigrateAsync();
            Equal(original, await Snapshot(db, projection));
            Check(await db.Visits.AllAsync(v => v.Status == "Closed" && v.ExamStatus == null && v.ConsultationCount == null), "Never infer clinical state from settlement/publication");
            Check(await db.Sessions.AllAsync(s => s.LastSeenAt == null), "Do not fabricate online presence");
            Check(await db.Set<ExaminationTicket>().AllAsync(t => t.SnapshotSource == "LegacyMissing" && t.SequenceNumber == null), "Do not invent ticket evidence");
            var upgraded = await Snapshot(db);
            await db.Database.MigrateAsync();
            Equal(upgraded, await Snapshot(db));
            await ForeignKeys(db);
            var blockers = await Review(db, "cutover-review.sql");
            Check(blockers.Count == 0, "Closed clean history does not require fabricated V2 evidence");
            evidence.Add(new { stage = "legacy-upgraded", database = name, findings, blockers, before = original, after = upgraded });
        }
        // Restore into a new database, never REPLACE the source or run Down migrations.
        var restoredName = Name(label + "_restored");
        await Restore(name, restoredName, backup);
        await using var restored = Db(restoredName);
        Equal(original, await Snapshot(restored));
        Check(originalMigrations.SequenceEqual(await restored.Database.GetAppliedMigrationsAsync()), "Restore returns original schema version");
        await ForeignKeys(restored);
        evidence.Add(new { stage = "restore-verified", source = name, database = restoredName, tables = original });
        if (!conflict) {
            await restored.Database.MigrateAsync();
            Equal(original, await Snapshot(restored, projection));
            Check((await Review(restored, "cutover-review.sql")).Count == 0, "Restored clean backup upgrades successfully");
        } else {
            // A diagnostic copy may be upgraded to inspect non-constraint legacy conflicts.
            // Ordered (old state) is deliberate: the SQL unique filter only covers NotCompleted.
            await restored.Database.MigrateAsync();
            Equal(original, await Snapshot(restored, projection));
            var blockers = await Review(restored, "cutover-review.sql");
            foreach (var reason in new[] { "active_visit_unverified", "active_ticket_unverified", "active_doctor_assignment_unverified", "room_multiple_consultations", "visit_multiple_open_orders", "legacy_open_order_unverified", "active_destination_unverified" })
                Check(blockers.Any(f => f.Reason == reason), "Post-migration gate blocks: " + reason);
            await ForeignKeys(restored);
            evidence.Add(new { stage = "diagnostic-copy-blocked", database = restoredName, blockers });
        }
    }

    static async Task Fixture(HospitalDb db, bool conflict)
    {
        var department = new Department { Code = "PB030", NameVi = "Synthetic department" };
        var room = new Location { DepartmentId = department.Id, NameVi = "Original room", Room = "101" };
        var doctor = new UserAccount { Email = "doctor@fixture.invalid", Role = "Doctor", Name = "Historical doctor", Active = false };
        var patient = new Patient { Name = "Synthetic linked patient", Language = "ja" };
        var account = new UserAccount { Email = "linked@fixture.invalid", PatientId = patient.Id };
        var guest = new Session { PatientId = patient.Id, IsGuest = true, Revoked = true, TokenHash = new string('a', 64), ExpiresAt = DateTime.UtcNow.AddDays(1) };
        var session = new Session { PatientId = patient.Id, UserAccountId = account.Id, TokenHash = new string('b', 64), ExpiresAt = DateTime.UtcNow.AddDays(1) };
        var service = new HospitalService { Code = "PB030", DepartmentId = department.Id, LocationId = room.Id };
        foreach (var entity in new Entity[] { department, room, doctor, patient, account, guest, session, service }) await InsertLegacy(db, entity);
        await InsertLegacy(db, new LinkClaim { SessionId = guest.Id, Hash = "synthetic-link-history", ExpiresAt = guest.ExpiresAt, Consumed = true });
        for (var i = 0; i < 3; i++) {
            var request = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = department.Id, Status = "Confirmed", Description = "Synthetic historical original" };
            var reception = new ReceptionRecord { RegistrationRequestId = request.Id, PatientId = patient.Id, ConfirmedBy = doctor.Id };
            var visit = new Visit { PatientId = patient.Id, ReceptionRecordId = reception.Id, DepartmentId = department.Id, DoctorId = doctor.Id,
                Status = conflict ? "Active" : "Closed", FinalSettlementRevision = 1, FinalSettlementOutcome = "Final" };
            var journey = new PatientJourney { VisitId = visit.Id, Status = i == 0 ? "PendingActivation" : "Completed" };
            var snapshot = JsonSerializer.Serialize(new { id = room.Id, nameVi = "Historical original", building = "Old A", floor = "2", room = "201" });
            foreach (var entity in new Entity[] { request, reception, visit, journey,
                new ExaminationTicket { VisitId = visit.Id, Number = "OLD-" + i },
                new JourneyStep { PatientJourneyId = journey.Id, DepartmentId = department.Id, LocationId = room.Id,
                    DestinationSnapshot = conflict && i == 2 ? "{}" : snapshot, Status = conflict ? "InProgress" : i == 0 ? "Cancelled" : "Skipped" },
                new AccessGrant { SessionId = guest.Id, VisitId = visit.Id, ExpiresAt = guest.ExpiresAt },
                new AccessGrant { SessionId = session.Id, VisitId = visit.Id, ExpiresAt = session.ExpiresAt },
                new RecoveryClaim { PatientId = patient.Id, VisitId = visit.Id, Hash = "synthetic-recovery", ExpiresAt = session.ExpiresAt, Consumed = true },
                new AuditEvent { VisitId = visit.Id, ActorId = account.Id, Type = "GuestLinked", SourceEventId = visit.Id.ToString(), Detail = "Synthetic linked history" },
                new SummaryVersion { VisitId = visit.Id, AuthorId = doctor.Id, Revision = 1, Status = "Published", Diagnosis = "Synthetic historical original" },
                new FollowUpRecommendation { VisitId = visit.Id, DepartmentId = department.Id, AuthorId = doctor.Id, RecommendedAt = DateTime.UtcNow.AddDays(7), Text = "Synthetic follow-up original" } })
                await InsertLegacy(db, entity);
            foreach (var status in new[] { "Cancelled", "Skipped", "Completed" })
                await InsertLegacy(db, new DoctorOrder { VisitId = visit.Id, HospitalServiceId = service.Id, OrderedBy = doctor.Id, Status = status });
            if (conflict && i == 0)
                for (var order = 0; order < 2; order++)
                    await InsertLegacy(db, new DoctorOrder { VisitId = visit.Id, HospitalServiceId = service.Id, OrderedBy = doctor.Id, Status = "Ordered" });
        }
    }

    static async Task OrderGuard()
    {
        Console.WriteLine("Verifying pending-order migration guard without deleting rows.");
        await using var db = Db(Name("order_guard"));
        await db.GetService<IMigrator>().MigrateAsync(Legacy);
        await Fixture(db, true);
        // Reproduce the exact pending status protected by PB-011's migration.
        await db.Database.ExecuteSqlRawAsync("UPDATE DoctorOrder SET Status='NotCompleted' WHERE Status='Ordered'");
        var projection = await Columns(db);
        var before = await Snapshot(db, projection);
        try { await db.Database.MigrateAsync(); throw new InvalidOperationException("Expected migration guard"); }
        catch (SqlException e) when (e.Number == 51013) { checks++; }
        Equal(before, await Snapshot(db, projection));
        Check(!(await db.Database.GetAppliedMigrationsAsync()).Any(m => m.EndsWith("SingleServiceOrder")), "Failed migration not recorded");
        evidence.Add(new { stage = "migration-guard-verified", database = Name("order_guard"), sqlNumber = 51013, tables = before });
    }

    static async Task InsertLegacy(HospitalDb db, Entity entity)
    {
        var type = db.Model.FindEntityType(entity.GetType())!;
        var table = type.GetTableName()!;
        var columns = (await Columns(db))[table];
        var store = StoreObjectIdentifier.Table(table, type.GetSchema());
        var properties = type.GetProperties().Where(p => columns.Contains(p.GetColumnName(store)!)).ToArray();
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        for (var i = 0; i < properties.Length; i++)
            command.Parameters.Add(properties[i].GetRelationalTypeMapping().CreateParameter(command, "@p" + i, properties[i].PropertyInfo!.GetValue(entity)));
        command.CommandText = $"INSERT INTO {Q(table)} ({string.Join(',', properties.Select(p => Q(p.GetColumnName(store)!)))}) VALUES ({string.Join(',', properties.Select((_, i) => "@p" + i))})";
        await command.ExecuteNonQueryAsync();
    }

    record TableState(long Count, string Hash);
    static async Task<Dictionary<string, string[]>> Columns(HospitalDb db)
    {
        var tables = await db.Database.SqlQueryRaw<string>("SELECT TABLE_NAME AS Value FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME <> '__EFMigrationsHistory'").ToListAsync();
        var result = new Dictionary<string, string[]>();
        foreach (var table in tables)
            result[table] = (await db.Database.SqlQueryRaw<string>("SELECT COLUMN_NAME AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME={0} ORDER BY ORDINAL_POSITION", table).ToListAsync()).ToArray();
        return result;
    }
    static async Task<Dictionary<string, TableState>> Snapshot(HospitalDb db, Dictionary<string, string[]>? projection = null)
    {
        projection ??= await Columns(db);
        var result = new Dictionary<string, TableState>();
        await db.Database.OpenConnectionAsync();
        foreach (var (table, columns) in projection.OrderBy(p => p.Key)) {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = $"SELECT {string.Join(',', columns.Select(Q))} FROM {Q(table)} ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES";
            var data = new StringBuilder();
            await using (var reader = await command.ExecuteReaderAsync())
                while (await reader.ReadAsync()) data.Append(reader.GetString(0));
            command.CommandText = $"SELECT COUNT_BIG(*) FROM {Q(table)}";
            var count = (long)(await command.ExecuteScalarAsync())!;
            result[table] = new(count, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(data.ToString()))));
        }
        return result;
    }
    static void Equal(Dictionary<string, TableState> before, Dictionary<string, TableState> after)
    {
        Check(before.Count == after.Count && before.All(p => after.TryGetValue(p.Key, out var value) && value == p.Value), "Every projected table count, ID, ownership, history and snapshot must match");
    }
    record Finding(string Reason, Guid EntityId, Guid? RelatedId, long RecordCount);
    static async Task<List<Finding>> Review(HospitalDb db, string file)
    {
        await db.Database.OpenConnectionAsync();
        // Execute both reports as a principal with SELECT only, then revert even on failure.
        await db.Database.ExecuteSqlRawAsync("IF DATABASE_PRINCIPAL_ID('pb030_reader') IS NULL CREATE USER pb030_reader WITHOUT LOGIN; GRANT SELECT TO pb030_reader; DENY INSERT, UPDATE, DELETE TO pb030_reader;");
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = "EXECUTE AS USER='pb030_reader'";
        await command.ExecuteNonQueryAsync();
        var findings = new List<Finding>();
        try {
            command.CommandText = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, file));
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) {
                var legacyReport = reader.FieldCount == 4;
                var related = legacyReport ? reader.GetValue(2).ToString() : null;
                findings.Add(new(reader.GetString(0), Guid.Parse(reader.GetValue(1).ToString()!),
                    Guid.TryParse(related, out var id) ? id : null,
                    Convert.ToInt64(reader.GetValue(legacyReport ? 3 : 2))));
            }
        } finally {
            command.CommandText = "IF @@TRANCOUNT > 0 ROLLBACK; REVERT;";
            await command.ExecuteNonQueryAsync();
        }
        return findings;
    }
    static async Task ForeignKeys(HospitalDb db)
    {
        Check(await db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1").SingleAsync() == 0,
            "Foreign keys must remain enabled and trusted");
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.CommandText = "DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, NO_INFOMSGS";
        await using var reader = await command.ExecuteReaderAsync();
        do { Check(!await reader.ReadAsync(), "All FK/check constraints must hold"); } while (await reader.NextResultAsync());
    }
    static async Task<string> Backup(string name)
    {
        await using var db = Db("master");
        var directory = Environment.GetEnvironmentVariable("PB030_BACKUP_DIRECTORY")
            ?? await db.Database.SqlQueryRaw<string>("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) AS Value").SingleAsync();
        var path = Path.Combine(directory, name + ".bak");
        await db.Database.ExecuteSqlRawAsync("BACKUP DATABASE {0} TO DISK = {1} WITH COPY_ONLY, CHECKSUM", name, path);
        await db.Database.ExecuteSqlRawAsync("RESTORE VERIFYONLY FROM DISK = {0} WITH CHECKSUM", path);
        evidence.Add(new { stage = "backup-verified", database = name, file = Path.GetFileName(path) });
        return path;
    }
    static async Task Restore(string source, string target, string backup)
    {
        await using var db = Db("master");
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        // Source and target are generated fixture names, never user input. Target is new; no REPLACE.
        command.CommandText = "SELECT name,physical_name FROM sys.master_files WHERE database_id=DB_ID(@source) ORDER BY file_id";
        command.Parameters.Add(new SqlParameter("@source", source));
        var files = new List<(string Logical, string Physical)>();
        await using (var reader = await command.ExecuteReaderAsync())
            while (await reader.ReadAsync()) files.Add((reader.GetString(0), reader.GetString(1)));
        Check(files.Count >= 2, "Backup has data and log files");
        command.Parameters.Clear();
        command.Parameters.Add(new SqlParameter("@backup", backup));
        var moves = new List<string>();
        for (var i = 0; i < files.Count; i++) {
            command.Parameters.Add(new SqlParameter("@logical" + i, files[i].Logical));
            command.Parameters.Add(new SqlParameter("@physical" + i, Path.Combine(Path.GetDirectoryName(files[i].Physical)!, target + "_" + i + Path.GetExtension(files[i].Physical))));
            moves.Add($"MOVE @logical{i} TO @physical{i}");
        }
        command.CommandTimeout = 120;
        command.CommandText = $"RESTORE DATABASE {Q(target)} FROM DISK=@backup WITH CHECKSUM, {string.Join(',', moves)}";
        await command.ExecuteNonQueryAsync();
    }
}
