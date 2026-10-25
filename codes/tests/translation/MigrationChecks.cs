using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

static class MigrationChecks
{
    public static async Task Run()
    {
        var configured = Environment.GetEnvironmentVariable("ConnectionStrings__Hospital") ?? throw new Exception("Set the test SQL connection first.");
        var connection = new SqlConnectionStringBuilder(configured) { InitialCatalog = "HospitalAcceptanceMigration_" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
        await using var db = new HospitalDb(new DbContextOptionsBuilder<HospitalDb>().UseSqlServer(connection.ConnectionString).Options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261016065617_ClientGeneratedKeys");
        var vi = Guid.NewGuid(); var en = Guid.NewGuid(); var unpaired = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO GuidanceTemplate (Id,Version,CreatedAt,[Key],Language,Revision,Text,Published,Category) VALUES ({vi},1,SYSUTCDATETIME(),N'migration-test',N'vi',1,N'Hướng dẫn gốc',1,N'Guidance'), ({en},1,SYSUTCDATETIME(),N'migration-test',N'en',1,N'Legacy English',1,N'Guidance'), ({unpaired},1,SYSUTCDATETIME(),N'custom-unpaired',N'en',1,N'Custom English original',1,N'Guidance')");
        try { await migrator.MigrateAsync(); throw new Exception("Unpaired source should block migration"); }
        catch (SqlException e) when (e.Number == 51000) { }
        if (await db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME='NameEn' AND TABLE_NAME IN ('Department','Location','HospitalService')").SingleAsync() != 3)
            throw new Exception("Failed migration must retain old schema");
        if (await db.Set<GuidanceTemplate>().CountAsync() != 3) throw new Exception("Failed migration must retain old content");
        await db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM GuidanceTemplate WHERE Id = {unpaired}");
        await migrator.MigrateAsync();
        var remaining = await db.Set<GuidanceTemplate>().SingleAsync();
        if (remaining.Id != vi || remaining.Language != "vi" || remaining.Text != "Hướng dẫn gốc") throw new Exception("Vietnamese original must be preserved");
        if (await db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME='NameEn' AND TABLE_NAME IN ('Department','Location','HospitalService')").SingleAsync() != 0)
            throw new Exception("English columns remain");
        try { await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE GuidanceTemplate SET Language = 'en' WHERE Id = {vi}"); throw new Exception("Source constraint missing"); }
        catch (SqlException e) when (e.Number == 547) { }
        if (db.Database.HasPendingModelChanges()) throw new Exception("Snapshot differs from current model");
        Console.WriteLine("Migration checks passed: rollback for unpaired originals, safe removal of legacy variants, original identity and SQL constraints. Database: " + connection.InitialCatalog);
    }
}
