using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HospitalVisitApi.Data;

public static class SchemaBootstrap
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        await db.Database.OpenConnectionAsync();
        var connection = (SqliteConnection)db.Database.GetDbConnection();
        using var probe = connection.CreateCommand();
        probe.CommandText = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='Users'";
        bool legacy = Convert.ToInt32(await probe.ExecuteScalarAsync()) > 0;
        probe.CommandText = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='__EFMigrationsHistory'";
        legacy &= Convert.ToInt32(await probe.ExecuteScalarAsync()) == 0;
        if (legacy)
        {
            // Adopt the supplied EnsureCreated database only when every mapped column exists.
            foreach (var entity in db.Model.GetEntityTypes())
            {
                var table = entity.GetTableName()!;
                // Added by its own subsequent migration, not part of the legacy baseline.
                if (table == "ExternalIdentities") continue;
                using var command = connection.CreateCommand();
                command.CommandText = $"PRAGMA table_info(\"{table}\")";
                using var reader = await command.ExecuteReaderAsync();
                var columns = new HashSet<string>();
                while (await reader.ReadAsync()) columns.Add(reader.GetString(1));
                var identifier = StoreObjectIdentifier.Table(table, entity.GetSchema());
                if (entity.GetProperties().Any(p => !columns.Contains(p.GetColumnName(identifier)!)))
                    throw new InvalidOperationException($"Legacy schema differs at {table}; preserve the database and resolve migration before startup");
            }
            if (connection.DataSource != ":memory:")
            {
                using var backup = new SqliteConnection($"Data Source={connection.DataSource}.before-migrations-{DateTime.UtcNow:yyyyMMddHHmmss}.db");
                backup.Open(); connection.BackupDatabase(backup);
            }
            using var transaction = connection.BeginTransaction();
            using var adopt = connection.CreateCommand();
            adopt.Transaction = transaction;
            adopt.CommandText = """
                DROP INDEX IF EXISTS IX_Patients_UserId;
                DROP INDEX IF EXISTS IX_Patients_GuestSessionId;
                CREATE UNIQUE INDEX IF NOT EXISTS IX_Patients_UserId ON Patients (UserId);
                CREATE UNIQUE INDEX IF NOT EXISTS IX_Patients_GuestSessionId ON Patients (GuestSessionId);
                CREATE UNIQUE INDEX IF NOT EXISTS IX_DiagnosisSummaries_VisitId_Version ON DiagnosisSummaries (VisitId, Version);
                CREATE TABLE __EFMigrationsHistory (MigrationId TEXT NOT NULL PRIMARY KEY, ProductVersion TEXT NOT NULL);
                INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ($migration, '9.0.1');
                """;
            adopt.Parameters.AddWithValue("$migration", db.Database.GetMigrations().First());
            await adopt.ExecuteNonQueryAsync();
            await transaction.CommitAsync();
        }
        await db.Database.MigrateAsync();
    }
}
