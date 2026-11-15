using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Identity;

public record PresenceSettings(int HeartbeatSeconds, int TtlSeconds)
{
    public static PresenceSettings From(IConfiguration config)
    {
        var interval = config.GetValue("Presence:HeartbeatSeconds", 15);
        var ttl = config.GetValue("Presence:TtlSeconds", 60);
        if (interval is < 5 or > 300 || ttl < interval * 2 || ttl > 3600)
            throw new InvalidOperationException("Presence requires heartbeat 5–300 seconds and TTL between twice the heartbeat and 3600 seconds.");
        return new(interval, ttl);
    }
}
public record PresenceHeartbeat(DateTime LastSeenAt, int HeartbeatSeconds, int TtlSeconds);
public record OnlinePresence(DateTime GeneratedAt, int TtlSeconds, int Accounts, int Guests, int Total);

public class PresenceService(HospitalDb db, TimeProvider clock, PresenceSettings settings)
{
    // Rechecked in SQL on every write/read, including revoked/inactive accounts.
    IQueryable<Session> Valid(DateTime now) => db.Sessions.Where(s => !s.Revoked && s.ExpiresAt > now
        && (s.IsGuest ? s.UserAccountId == null && s.PatientId != null : s.UserAccountId != null && s.UserAccount!.Active));

    public async Task<PresenceHeartbeat> Heartbeat(Guid sessionId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        // Atomic and monotonic; no CommandBus, global application lock, receipt or event.
        // Deliberately leave Version unchanged: presence is not a business edit.
        var changed = await Valid(now).Where(s => s.Id == sessionId).ExecuteUpdateAsync(setters => setters
            .SetProperty(s => s.LastSeenAt, s => s.LastSeenAt == null || s.LastSeenAt < now ? now : s.LastSeenAt), ct);
        Check.That(changed == 1, "sessionExpired", "Access expired. Sign in or request verified recovery.", 401);
        var seen = await db.Sessions.Where(s => s.Id == sessionId).Select(s => s.LastSeenAt!.Value).SingleAsync(ct);
        return new(DateTime.SpecifyKind(seen, DateTimeKind.Utc), settings.HeartbeatSeconds, settings.TtlSeconds);
    }

    public async Task<OnlinePresence> Read(DateTime now, CancellationToken ct)
    {
        var cutoff = now.AddSeconds(-settings.TtlSeconds);
        var groups = await Valid(now).Where(s => s.LastSeenAt > cutoff && s.LastSeenAt <= now)
            .Select(s => new { s.IsGuest, Identity = s.IsGuest ? s.Id : s.UserAccountId!.Value })
            .Distinct().GroupBy(s => s.IsGuest).Select(g => new { Guest = g.Key, Count = g.Count() }).ToListAsync(ct);
        var accounts = groups.Where(g => !g.Guest).Sum(g => g.Count);
        var guests = groups.Where(g => g.Guest).Sum(g => g.Count);
        return new(now, settings.TtlSeconds, accounts, guests, accounts + guests);
    }
}

public static class PresenceEndpoints
{
    public static void MapPresence(this WebApplication app)
    {
        app.MapPost("/api/v2/presence/heartbeat", Receive).WithTags("Presence").Produces<PresenceHeartbeat>();
        // Plan compatibility alias; both routes use the same authenticated handler.
        app.MapPost("/api/presence/heartbeat", Receive).WithTags("Presence").Produces<PresenceHeartbeat>();
        app.MapGet("/api/v2/admin/presence", Read).WithTags("Presence").Produces<OnlinePresence>();
    }

    // A typed JSON body adds a content-type routing constraint, even when it is
    // nullable. Read the optional compatibility object here so a truly bodyless
    // heartbeat reaches this route rather than the API fallback.
    public static async Task<PresenceHeartbeat> Receive(HttpRequest request, Access access, PresenceService presence, CancellationToken ct)
    {
        await access.Current();
        JsonElement? body = null;
        if (request.HttpContext.Features.Get<IHttpRequestBodyDetectionFeature>()?.CanHaveBody == true)
        {
            Check.That(request.HasJsonContentType(), "validation", "Send no body or an empty JSON object.", 415);
            try { body = await request.ReadFromJsonAsync<JsonElement>(ct); }
            catch (JsonException) { throw new ApiException(422, "validation", "Send no body or an empty JSON object."); }
        }
        return await Heartbeat(body, access, presence, ct);
    }

    public static async Task<OnlinePresence> Read(Access access, PresenceService presence, TimeProvider clock, CancellationToken ct)
    {
        await access.Staff("Admin");
        return await presence.Read(clock.GetUtcNow().UtcDateTime, ct);
    }

    public static async Task<PresenceHeartbeat> Heartbeat(JsonElement? body, Access access, PresenceService presence, CancellationToken ct)
    {
        var session = await access.Current();
        Check.That(body == null || body.Value.ValueKind == JsonValueKind.Object && !body.Value.EnumerateObject().Any(),
            "validation", "Heartbeat takes no identity, role or timestamp fields.");
        return await presence.Heartbeat(session.Id, ct);
    }
}
