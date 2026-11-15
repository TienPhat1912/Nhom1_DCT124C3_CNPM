internal static class BackupDirectory
{
    public static string Resolve(string? configured, string? instanceDefault, string? dataFile)
    {
        if (!string.IsNullOrWhiteSpace(configured)) return configured;
        if (!string.IsNullOrWhiteSpace(instanceDefault)) return instanceDefault;
        // LocalDB may have no InstanceDefaultBackupPath. The generated fixture's
        // data directory already exists and is accessible to this same SQL engine.
        var directory = string.IsNullOrWhiteSpace(dataFile) ? null : Path.GetDirectoryName(dataFile);
        if (string.IsNullOrWhiteSpace(directory))
            throw new InvalidOperationException("No backup directory is available; set PB030_BACKUP_DIRECTORY to an existing SQL-accessible directory.");
        return directory;
    }
}
