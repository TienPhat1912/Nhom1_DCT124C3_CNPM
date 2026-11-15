using System.Globalization;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Journeys;

public record EventStep(Guid Id, int Version, string Kind, string Status, string QueueNumber,
    string QueueStatus, Guid LocationId, string DestinationSnapshot, string TemplateKey, int MappingVersion);
public record EventGuidance(Guid StepId, Guid TemplateId, string TemplateKey, int Revision, string Language, string Text);
public record VisitEventPayload(VisitEventState State, EventGuidance[] Guidance);
public record VisitEventState(Guid VisitId, string Status, string? ExamStatus, string JourneyStatus,
    int? ConsultationCount, string TicketNumber, EventStep[] Steps)
{
    // Deliberately exclude orders, results, clinical drafts and patient details from fast polling.
    public static IQueryable<Visit> Query(HospitalDb db) => db.Visits
        .Include(v => v.Ticket).Include(v => v.Journey).ThenInclude(j => j.Steps).AsSingleQuery();
    public static VisitEventState Capture(Visit v) => new(v.Id, v.Status, v.ExamStatus, v.Journey.Status,
        v.ConsultationCount, v.Ticket.Number, v.Journey.Steps.OrderBy(s => s.Sequence).ThenBy(s => s.Id)
            .Select(s => new EventStep(s.Id, s.Version, s.Kind, s.Status, s.QueueNumber, s.QueueStatus,
                s.LocationId, s.DestinationSnapshot, s.TemplateKey, s.MappingVersion)).ToArray());
    public static string Hash(VisitEventState state) => Crypto.Hash(JsonSerializer.Serialize(state, CommandBus.Json));
}

public static class VisitEvents
{
    static string Cursor(Guid visitId, long sequence) => $"{visitId:N}:{sequence.ToString(CultureInfo.InvariantCulture)}";

    public static void MapVisitEvents(this WebApplication app)
    {
        app.MapGet("/api/visits/{id:guid}/events", async (Guid id, string? after, Access access, HospitalDb db, HttpContext http, CancellationToken ct) => {
            http.Response.Headers.CacheControl = "no-store";
            var session = await access.Patient();
            // Recheck the current grant on every poll, including bootstrap and empty responses.
            var visit = await VisitEventState.Query(db).AsNoTracking().SingleOrDefaultAsync(v => v.Id == id, ct)
                ?? throw new ApiException(404, "notFound", "Visit not found.");
            Check.That(visit.PatientId == session.PatientId, "forbidden", "You do not have access to this Visit.", 403);
            if (session.IsGuest)
                Check.That(await db.Set<AccessGrant>().AnyAsync(g => g.VisitId == id && g.SessionId == session.Id && g.ExpiresAt > DateTime.UtcNow, ct),
                    "forbidden", "Verified guest access required.", 403);
            long sequence = 0;
            if (after != null)
            {
                var parts = after.Split(':');
                Check.That(parts.Length == 2 && parts[0] == id.ToString("N")
                    && long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out sequence) && sequence >= 0,
                    "invalidCursor", "Use a cursor issued for this Visit.", 400);
            }
            var stream = db.Set<VisitEvent>().AsNoTracking().Where(e => e.VisitId == id);
            var watermark = await stream.MaxAsync(e => (long?)e.Sequence, ct) ?? 0;
            Check.That(sequence <= watermark, "invalidCursor", "Cursor is ahead of this Visit.", 400);
            var rows = after == null ? [] : await stream.Where(e => e.Sequence > sequence && e.Sequence <= watermark)
                .OrderBy(e => e.Sequence).Take(51).ToListAsync(ct);
            var state = VisitEventState.Capture(visit);
            // State read precedes watermark read. Refresh if a concurrent writer advanced the stream.
            var latest = await stream.Where(e => e.Sequence == watermark).SingleOrDefaultAsync(ct);
            var hash = VisitEventState.Hash(state);
            if (latest != null && latest.StateHash != hash)
            {
                // Refresh only the small operational graph; direct admin/fixture edits can also
                // invalidate old events without generating a stream entry.
                visit = await VisitEventState.Query(db).AsNoTracking().SingleAsync(v => v.Id == id, ct);
                state = VisitEventState.Capture(visit); hash = VisitEventState.Hash(state);
            }
            var reset = after == null || rows.Count > 50;
            return Results.Ok(new {
                visitId = id, cursor = Cursor(id, watermark), reset, pollAfterMs = 1000, state,
                events = (reset ? [] : rows).Select(e => {
                    var payload = JsonSerializer.Deserialize<VisitEventPayload>(e.PayloadJson, CommandBus.Json)!;
                    return new {
                        e.Id, e.VisitId, e.Key, occurredAt = DateTime.SpecifyKind(e.CreatedAt, DateTimeKind.Utc),
                        cursor = Cursor(id, e.Sequence), language = "vi", contentRevision = 1,
                        expiresAt = DateTime.SpecifyKind(e.CreatedAt.AddMinutes(2), DateTimeKind.Utc),
                        stale = e.StateHash != hash || e.CreatedAt.AddMinutes(2) <= DateTime.UtcNow,
                        state = payload.State, guidance = payload.Guidance
                    };
                })
            });
        }).WithTags("Visit events");
    }
}
