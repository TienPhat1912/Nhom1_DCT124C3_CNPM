internal static class BackupDirectoryChecks
{
    public static void Run()
    {
        var dataDirectory = Path.Combine(Path.GetTempPath(), "pb030-fixture-data");
        var dataFile = Path.Combine(dataDirectory, "fixture.mdf");
        var backupDirectory = Path.Combine(Path.GetTempPath(), "pb030-backups");
        var checks = 0;
        void Check(bool ok) { if (!ok) throw new Exception("Backup directory regression failed"); checks++; }
        // Reproduce the LocalDB NULL value that broke CI; also test empty defaults.
        Check(BackupDirectory.Resolve(null, null, dataFile) == dataDirectory);
        Check(BackupDirectory.Resolve(null, "", dataFile) == dataDirectory);
        Check(BackupDirectory.Resolve(" ", "\t", dataFile) == dataDirectory);
        Check(BackupDirectory.Resolve(null, backupDirectory, null) == backupDirectory);
        Check(BackupDirectory.Resolve(backupDirectory, dataDirectory, null) == backupDirectory);
        try {
            BackupDirectory.Resolve(null, null, null);
            throw new Exception("Missing directory must fail before BACKUP");
        } catch (InvalidOperationException) { checks++; }
        Console.WriteLine($"PASS: {checks} backup-directory regression checks (no SQL required).");
    }
}
