using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;

await CoreSchemaChecks.Run();

static class CoreSchemaChecks
{
    const string Previous = "20261025035340_VietnameseSource";
    static int checks;
    static readonly IConfiguration Demo = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["Demo:Enabled"] = "true", ["Demo:Password"] = "Fixture-only-PB004-2026!"
    }).Build();

    static void Check(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
        checks++;
    }

    static HospitalDb NewDatabase(string label)
    {
        var server = Environment.GetEnvironmentVariable("PB004_SQL_SERVER")
            ?? throw new InvalidOperationException("Set PB004_SQL_SERVER explicitly to localhost or (localdb)\\MSSQLLocalDB.");
        if (server is not ("localhost" or ".") && !System.Text.RegularExpressions.Regex.IsMatch(server, @"^(\(localdb\)\\[\w-]+|\.\\[\w-]+)$"))
            throw new InvalidOperationException("Only local SQL Server is allowed for these fixtures.");
        var connection = new SqlConnectionStringBuilder {
            DataSource = server, InitialCatalog = $"HospitalPB004_{label}_{Guid.NewGuid():N}",
            IntegratedSecurity = true, TrustServerCertificate = true, ConnectTimeout = 10
        };
        Console.WriteLine("Isolated database (retained): " + connection.InitialCatalog);
        return new(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
    }

    public static async Task Run()
    {
        await FreshDatabase();
        await LegacyDatabase();
        Console.WriteLine($"PASS: {checks} assertions; fresh seed, legacy upgrade, history, read-only review, constraints, downgrade and model snapshot.");
    }

    static async Task Rejected(HospitalDb db, string sql, params int[] numbers)
    {
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        // Fixed fixture SQL and generated UUIDs only, no external input.
        command.CommandText = sql;
        try { await command.ExecuteNonQueryAsync(); }
        catch (SqlException e) when (numbers.Contains(e.Number)) { checks++; return; }
        throw new InvalidOperationException("Expected SQL constraint rejection.");
    }

    static async Task FreshDatabase()
    {
        await using var db = NewDatabase("fresh");
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync();
        Check(!db.Database.HasPendingModelChanges(), "EF snapshot must match model");
        // Empty database can be downgraded without discarding application data.
        await migrator.MigrateAsync(Previous);
        await migrator.MigrateAsync();
        await Seed.Run(db, Demo);
        Check(await db.Set<ClinicDoctor>().CountAsync() == 2, "Demo has explicit doctor-room assignments");
        Check(await db.Set<ClinicRoom>().CountAsync() == 2, "Demo has two clinic rooms");
        var rooms = await db.Set<ClinicRoom>().AsNoTracking().OrderBy(x => x.Id).ToListAsync();
        Check(rooms.All(x => x.ActiveDoctorId != null), "Demo rooms have active doctors");
        foreach (var room in rooms)
            Check(await db.Set<ClinicDoctor>().AnyAsync(d => d.ClinicLocationId == room.ClinicLocationId && d.DoctorId == room.ActiveDoctorId), "Active doctor belongs to room");
        var first = rooms[0]; var second = rooms[1];
        await Rejected(db, $"UPDATE ClinicRoom SET ActiveDoctorId = '{second.ActiveDoctorId}' WHERE Id = '{first.Id}'", 547);
        await Rejected(db, $"INSERT ClinicDoctor (Id,DoctorId,ClinicLocationId,Version,CreatedAt) VALUES (NEWID(),'{first.ActiveDoctorId}','{second.ClinicLocationId}',1,SYSUTCDATETIME())", 2601, 2627);
        await Rejected(db, $"INSERT ClinicRoom (Id,ClinicLocationId,Version,CreatedAt) VALUES (NEWID(),'{first.ClinicLocationId}',1,SYSUTCDATETIME())", 2601, 2627);
        await Rejected(db, "INSERT ClinicDoctor (Id,DoctorId,ClinicLocationId,Version,CreatedAt) VALUES (NEWID(),NEWID(),NEWID(),1,SYSUTCDATETIME())", 547);
        await Rejected(db, $"DELETE FROM Users WHERE Id = '{first.ActiveDoctorId}'", 547);
        await Rejected(db, $"DELETE FROM Location WHERE Id = '{first.ClinicLocationId}'", 547);
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE ClinicRoom SET ActiveDoctorId = NULL WHERE Id = {first.Id}");
        var before = await Fingerprint(db);
        await Seed.Run(db, Demo);
        Check(await Fingerprint(db) == before, "Restart seed must not overwrite assignments or rows");
        try { await migrator.MigrateAsync(Previous); throw new InvalidOperationException("Downgrade must protect assignments"); }
        catch (SqlException e) when (e.Number == 51004) { checks++; }
        Check(await Fingerprint(db) == before, "Blocked downgrade preserves all data");
    }

    // Insert only columns that exist in the old database, using current scalar metadata.
    // This creates real legacy rows with all real FKs and constraints, without a fake schema.
    static async Task InsertLegacy(HospitalDb db, Entity entity)
    {
        var type = db.Model.FindEntityType(entity.GetType())!;
        var table = type.GetTableName()!;
        var columns = await db.Database.SqlQueryRaw<string>("SELECT COLUMN_NAME AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME={0}", table).ToListAsync();
        var store = StoreObjectIdentifier.Table(table, type.GetSchema());
        var properties = type.GetProperties().Where(p => columns.Contains(p.GetColumnName(store)!)).ToArray();
        var names = properties.Select(p => $"[{p.GetColumnName(store)}]");
        await db.Database.OpenConnectionAsync();
        await using var command = db.Database.GetDbConnection().CreateCommand();
        for (var i = 0; i < properties.Length; i++) {
            var property = properties[i];
            command.Parameters.Add(property.GetRelationalTypeMapping().CreateParameter(command, "@p" + i, property.PropertyInfo!.GetValue(entity)));
        }
        var slots = Enumerable.Range(0, properties.Length).Select(i => "@p" + i);
        // Identifiers come only from EF metadata; all data values remain parameters.
        command.CommandText = $"INSERT INTO [{table}] ({string.Join(',', names)}) VALUES ({string.Join(',', slots)})";
        await command.ExecuteNonQueryAsync();
    }

    static async Task<string> Fingerprint(HospitalDb db, Dictionary<string, string[]>? projection = null)
    {
        projection ??= await Columns(db);
        var results = new StringBuilder();
        foreach (var (table, columns) in projection.OrderBy(p => p.Key)) {
            var sql = $"SELECT {string.Join(',', columns.Select(c => $"[{c}]"))} FROM [{table}] ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES";
            await db.Database.OpenConnectionAsync();
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = sql;
            await using var reader = await command.ExecuteReaderAsync();
            results.Append(table);
            while (await reader.ReadAsync()) results.Append(reader.GetString(0));
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(results.ToString())));
    }

    static async Task<Dictionary<string, string[]>> Columns(HospitalDb db)
    {
        var tables = await db.Database.SqlQueryRaw<string>("SELECT TABLE_NAME AS Value FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME <> '__EFMigrationsHistory'").ToListAsync();
        var result = new Dictionary<string, string[]>();
        foreach (var table in tables)
            result[table] = (await db.Database.SqlQueryRaw<string>("SELECT COLUMN_NAME AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME={0} ORDER BY ORDINAL_POSITION", table).ToListAsync()).ToArray();
        return result;
    }

    static string Snapshot(Location room) => JsonSerializer.Serialize(new { id = room.Id, nameVi = "Historical room name", building = "Old A", floor = "2", room = "Original 201" });

    static async Task LegacyDatabase()
    {
        await using var db = NewDatabase("legacy");
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync(Previous);
        var department = new Department { Code = "OLD", NameVi = "Fixture" };
        var otherDepartment = new Department { Code = "OTHER", NameVi = "Other" };
        var room = new Location { DepartmentId = department.Id, NameVi = "Renamed today", Room = "New 999" };
        var otherRoom = new Location { DepartmentId = department.Id, Room = "202" };
        var doctor = new UserAccount { Email = "legacy@fixture.invalid", Role = "Doctor", Name = "Renamed doctor" };
        var patient = new Patient { Name = "Renamed patient", Language = "ko" };
        var session = new Session { PatientId = patient.Id, IsGuest = true, TokenHash = new string('a', 64), ExpiresAt = DateTime.UtcNow.AddDays(1) };
        var service = new HospitalService { DepartmentId = department.Id, LocationId = room.Id, Code = "LEGACY" };
        foreach (var e in new Entity[] { department, otherDepartment, room, otherRoom, doctor, patient, session, service }) await InsertLegacy(db, e);
        var cases = new Dictionary<string, Visit>();
        foreach (var mode in new[] { "certain", "repeated", "multiple", "malformed", "missing", "mismatch", "mixed-invalid", "department-mismatch", "closed", "published" }) {
            var request = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = department.Id, Status = "Confirmed", Description = " original sensitive description " };
            var reception = new ReceptionRecord { RegistrationRequestId = request.Id, PatientId = patient.Id, ConfirmedBy = doctor.Id };
            var visit = new Visit { PatientId = patient.Id, ReceptionRecordId = reception.Id, DepartmentId = department.Id, DoctorId = doctor.Id,
                Status = mode == "closed" ? "Closed" : "Active", FinalSettlementRevision = 1, FinalSettlementOutcome = "Final" };
            var journey = new PatientJourney { VisitId = visit.Id, Status = mode == "closed" ? "Completed" : "PendingActivation" };
            var ticket = new ExaminationTicket { VisitId = visit.Id, Number = "H-" + mode };
            foreach (var e in new Entity[] { request, reception, visit, journey, ticket }) await InsertLegacy(db, e);
            if (mode != "missing") {
                var snapshot = mode switch { "malformed" => "not JSON secret", "mismatch" => Snapshot(otherRoom), _ => Snapshot(room) };
                await InsertLegacy(db, new JourneyStep { PatientJourneyId = journey.Id, LocationId = room.Id,
                    DepartmentId = mode == "department-mismatch" ? otherDepartment.Id : department.Id, DestinationSnapshot = snapshot,
                    Status = mode is "closed" or "published" ? "Completed" : "InProgress" });
            }
            if (mode is "repeated" or "multiple" or "mixed-invalid")
                await InsertLegacy(db, new JourneyStep { PatientJourneyId = journey.Id, Kind = "ReturnConsultation",
                    LocationId = mode == "multiple" ? otherRoom.Id : room.Id, DepartmentId = department.Id,
                    DestinationSnapshot = mode == "mixed-invalid" ? "{}" : Snapshot(mode == "multiple" ? otherRoom : room) });
            await InsertLegacy(db, new AccessGrant { SessionId = session.Id, VisitId = visit.Id, ExpiresAt = DateTime.UtcNow.AddDays(1) });
            await InsertLegacy(db, new RecoveryClaim { PatientId = patient.Id, VisitId = visit.Id, Hash = "history", ExpiresAt = DateTime.UtcNow.AddDays(1) });
            await InsertLegacy(db, new DoctorOrder { VisitId = visit.Id, HospitalServiceId = service.Id, OrderedBy = doctor.Id, Status = "Cancelled", Note = "historical note" });
            await InsertLegacy(db, new SummaryVersion { VisitId = visit.Id, AuthorId = doctor.Id, Status = "Published", Diagnosis = "historical diagnosis", Revision = 1 });
            await InsertLegacy(db, new AuditEvent { VisitId = visit.Id, ActorId = doctor.Id, Type = "GuestLinked", SourceEventId = visit.Id.ToString(), Detail = "history" });
            cases.Add(mode, visit);
        }
        var assistance = new AssistanceRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = department.Id, Description = "original assistance" };
        await InsertLegacy(db, assistance);
        var projection = await Columns(db);
        var before = await Fingerprint(db, projection);
        await migrator.MigrateAsync();
        Check(await Fingerprint(db, projection) == before, "Every old column/ID/history/snapshot must remain byte-for-byte unchanged");
        foreach (var (mode, oldVisit) in cases) {
            var actual = await db.Visits.AsNoTracking().SingleAsync(v => v.Id == oldVisit.Id);
            var certain = mode is "certain" or "repeated" or "closed" or "published";
            Check(actual.ClinicLocationId == (certain ? room.Id : null), "Conservative clinic mapping: " + mode);
            Check(actual.ExamStatus is null && actual.ConsultationCount is null && actual.ExaminationCompletedAt is null, "Never infer clinical completion or call count: " + mode);
            Check(actual.DoctorId == doctor.Id, "Original Visit doctor preserved");
        }
        Check(await db.Set<ClinicDoctor>().CountAsync() == 0 && await db.Set<ClinicRoom>().CountAsync() == 0, "Never infer active roster from historical visits");
        Check(await db.Set<ExaminationTicket>().AllAsync(t => t.SnapshotSource == "LegacyMissing" && t.PatientSnapshot == null && t.DoctorSnapshot == null && t.ClinicSnapshot == null), "Never fabricate historical ticket snapshots from today's names");
        Check(await db.Requests.AllAsync(r => r.SourceLanguage == null && r.PreferredDepartmentId == null), "Never infer source language or preference");
        Check(await db.Set<AssistanceRequest>().AllAsync(a => a.SourceLanguage == null), "Assistance original locale is unknown");
        var after = await Fingerprint(db);
        await migrator.MigrateAsync();
        Check(await Fingerprint(db) == after, "Repeated migrate is idempotent");
        await Seed.Run(db, Demo);
        Check(await Fingerprint(db) == after, "Seed does not change existing legacy database");
        await CheckReport(db, cases);
        try { await migrator.MigrateAsync(Previous); throw new InvalidOperationException("Must not discard inferred room data"); }
        catch (SqlException e) when (e.Number == 51004) { checks++; }
        Check(await Fingerprint(db) == after, "Blocked legacy downgrade preserves schema and content");
        var id = cases["certain"].Id;
        await Rejected(db, $"UPDATE Visits SET ClinicLocationId=NEWID() WHERE Id='{id}'", 547);
        await Rejected(db, $"UPDATE Visits SET ExamStatus='InProgress' WHERE Id='{id}'", 547);
        await Rejected(db, $"UPDATE Visits SET ConsultationCount=-1 WHERE Id='{id}'", 547);
        await Rejected(db, $"UPDATE Visits SET ExaminationCompletedAt=SYSUTCDATETIME() WHERE Id='{id}'", 547);
        foreach (var status in new[] { "Waiting", "InConsultation", "InService", "Completed" })
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE Visits SET ExamStatus={status},ConsultationCount=1 WHERE Id={id}");
        checks++;
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE Visits SET ExaminationCompletedAt=SYSUTCDATETIME() WHERE Id={id}");
        await Rejected(db, $"UPDATE Visits SET ExamStatus='Waiting' WHERE Id='{id}'", 547);
        await Rejected(db, "UPDATE Requests SET SourceLanguage='ko'", 547);
        await Rejected(db, "UPDATE AssistanceRequest SET SourceLanguage='ru'", 547);
        await Rejected(db, "UPDATE Requests SET PreferredDepartmentId=NEWID()", 547);
        foreach (var language in new[] { "vi", "en", "zh", "ja" }) {
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE Requests SET SourceLanguage={language}; UPDATE AssistanceRequest SET SourceLanguage={language};");
            checks++;
        }
        await Rejected(db, "UPDATE ExaminationTicket SET SnapshotSource='Captured'", 547);
        await Rejected(db, "UPDATE ExaminationTicket SET SnapshotSource='Captured',PatientSnapshot='invalid',ClinicSnapshot='{}',DoctorSnapshot='{}'", 547);
        await Rejected(db, "UPDATE ExaminationTicket SET SnapshotSource='Captured',PatientSnapshot='[]',ClinicSnapshot='{}',DoctorSnapshot='{}'", 547);
        var patientSnapshot = JsonSerializer.Serialize(new { name = "Original", contact = "test" });
        var clinicSnapshot = JsonSerializer.Serialize(new { id = room.Id, departmentId = department.Id, nameVi = "Original", nameEn = "Original", building = "A", floor = "1", room = "101" });
        var doctorSnapshot = JsonSerializer.Serialize(new { id = doctor.Id, name = "Original doctor" });
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE ExaminationTicket SET SnapshotSource='Captured',PatientSnapshot={patientSnapshot},ClinicSnapshot={clinicSnapshot},DoctorSnapshot={doctorSnapshot}");
        var captured = await db.Set<ExaminationTicket>().AsNoTracking().OrderBy(t => t.Id).Select(t => t.PatientSnapshot + t.ClinicSnapshot + t.DoctorSnapshot).ToListAsync();
        await db.Database.ExecuteSqlRawAsync("UPDATE Patients SET Name=N'Changed again'; UPDATE Users SET Name=N'Changed again'; UPDATE Location SET Room=N'Changed again';");
        Check(captured.SequenceEqual(await db.Set<ExaminationTicket>().AsNoTracking().OrderBy(t => t.Id).Select(t => t.PatientSnapshot + t.ClinicSnapshot + t.DoctorSnapshot).ToListAsync()), "Captured snapshots independent of mutable profiles");
        // Existing endpoints can still create legacy-shaped records after upgrade.
        var legacyRequest = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = department.Id };
        db.Add(legacyRequest);
        await db.SaveChangesAsync();
        Check(legacyRequest.SourceLanguage is null, "Old write path remains supported until PB-006/008");
        Check(!db.Database.HasPendingModelChanges(), "Final model snapshot remains synchronized");
    }

    static async Task CheckReport(HospitalDb db, Dictionary<string, Visit> cases)
    {
        await db.Database.ExecuteSqlRawAsync("CREATE USER pb004_reader WITHOUT LOGIN; GRANT SELECT TO pb004_reader; DENY INSERT, UPDATE, DELETE TO pb004_reader;");
        var before = await Fingerprint(db);
        var sql = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "core-schema-review.sql"));
        var counts = new Dictionary<string, int>();
        var unresolved = new HashSet<Guid>();
        await using (var command = db.Database.GetDbConnection().CreateCommand()) {
            command.CommandText = "EXECUTE AS USER='pb004_reader';\n" + sql + "\nREVERT;";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) {
                var reason = reader.GetString(0);
                counts[reason] = counts.GetValueOrDefault(reason) + 1;
                if (reason == "visit_clinic_unresolved") unresolved.Add(reader.GetGuid(1));
            }
        }
        Check(counts["visit_clinic_unresolved"] == 6 && counts["visit_exam_unverified"] == 10, "Review flags every unresolved Visit");
        Check(unresolved.SetEquals(cases.Where(p => p.Key is not ("certain" or "repeated" or "closed" or "published")).Select(p => p.Value.Id)), "Review returns exact ambiguous IDs");
        Check(counts["ticket_snapshot_missing"] == 10 && counts["request_source_unknown"] == 10 && counts["assistance_source_unknown"] == 1 && counts["doctor_assignment_unconfirmed"] == 1, "Review includes missing snapshots, sources and assignment");
        Check(await Fingerprint(db) == before, "Review under read-only principal does not write any row");
    }
}
