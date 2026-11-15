using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Journeys;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Infrastructure;

public class ApiException(int status, string code, string message, object? fields = null) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public object? Fields { get; } = fields;
}
public static class Check
{
    public static void That(bool ok, string code, string message, int status = 422)
    { if (!ok) throw new ApiException(status, code, message); }
    public static string Text(string? value, string field, int min = 1, int max = 2000)
    {
        value = value?.Trim() ?? "";
        if (value.Length < min || value.Length > max)
            throw new ApiException(422, "validation", "Please check the highlighted fields.", new Dictionary<string, string> { [field] = $"length:{min}:{max}" });
        return value;
    }
    public static void Version(Entity value, int expected) => That(value.Version == expected, "conflict", "The record changed. Refresh and retry.", 409);
    public static string Language(string value) => Hospital.Api.Content.Languages.Normalize(value);
}
public static class Crypto
{
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
}
public class CommandBus(HospitalDb db, IHttpContextAccessor accessor)
{
    readonly List<(Guid VisitId, string Key)> pendingEvents = [];
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public async Task<T> Run<T>(string scope, object request, Func<Task<T>> action, bool idempotent = true)
    {
        var ctx = accessor.HttpContext!;
        var key = ctx.Request.Headers["Idempotency-Key"].ToString();
        if (idempotent) Check.Text(key, "idempotencyKey", 8, 100);
        var hash = Crypto.Hash(JsonSerializer.Serialize(request, Json));
        await using var tx = await db.Database.BeginTransactionAsync();
        // SQL-owned lock spans processes and rolls back with the command transaction.
        await db.Database.ExecuteSqlRawAsync("DECLARE @r int; EXEC @r = sp_getapplock @Resource=N'hospital:commands', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r < 0 THROW 51000, 'Command busy', 1;");
        if (idempotent)
        {
            var old = await db.Set<CommandReceipt>().SingleOrDefaultAsync(r => r.Scope == scope && r.Key == key);
            if (old is not null)
            {
                Check.That(old.RequestHash == hash, "idempotencyConflict", "This event key was already used for different data.", 409);
                await tx.CommitAsync();
                return JsonSerializer.Deserialize<T>(old.ResponseJson, Json)!;
            }
        }
        var result = await action();
        await db.SaveChangesAsync();
        // Capture the final persisted versions, including commands that save inside action().
        // The stream and receipt share the business transaction; failures publish nothing.
        foreach (var pending in pendingEvents.GroupBy(e => e.VisitId))
        {
            var visit = await VisitEventState.Query(db).SingleAsync(v => v.Id == pending.Key);
            var state = VisitEventState.Capture(visit);
            var keys = state.Steps.Select(s => s.TemplateKey).Distinct().ToArray();
            var templates = await db.Set<GuidanceTemplate>().AsNoTracking()
                .Where(t => keys.Contains(t.Key) && t.Published && t.Language == "vi").OrderByDescending(t => t.Revision).ToListAsync();
            var guidance = state.Steps.Select(s => (Step: s, Template: templates.FirstOrDefault(t => t.Key == s.TemplateKey)))
                .Where(x => x.Template != null).Select(x => new EventGuidance(x.Step.Id, x.Template!.Id,
                    x.Template.Key, x.Template.Revision, x.Template.Language, x.Template.Text)).ToArray();
            db.Add(new VisitEvent { VisitId = visit.Id, Key = pending.Last().Key,
                StateHash = VisitEventState.Hash(state), PayloadJson = JsonSerializer.Serialize(new VisitEventPayload(state, guidance), Json) });
        }
        if (pendingEvents.Count > 0) await db.SaveChangesAsync();
        pendingEvents.Clear();
        if (idempotent)
        {
            db.Add(new CommandReceipt { Scope = scope, Key = key, RequestHash = hash, ResponseJson = JsonSerializer.Serialize(result, Json) });
            await db.SaveChangesAsync();
        }
        await tx.CommitAsync();
        ctx.Items["CommandCommitted"] = true;
        return result;
    }
    public void Audit(Guid actor, string type, Guid? visitId = null, string detail = "", string source = "Staff")
    {
        var key = accessor.HttpContext?.Request.Headers["Idempotency-Key"].ToString();
        db.Add(new AuditEvent { ActorId = actor, Type = type, VisitId = visitId, Detail = detail,
            Source = source, SourceEventId = string.IsNullOrEmpty(key) ? Guid.NewGuid().ToString("N") : $"{actor:N}:{type}:{key}" });
    }
    public void Notify(Guid patientId, Guid? visitId, string key = "journeyUpdated") {
        db.Add(new Notification { PatientId = patientId, VisitId = visitId, Key = key });
        if (visitId is {} id) pendingEvents.Add((id, key));
    }
}
