using System.Globalization;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Reception;

public record AllocatedTicketNumber(Guid ClinicLocationId, DateOnly IssuedOn, int SequenceNumber, string Number)
{
    // A bare 001 is not an identifier; display/lookup must include clinic and date.
    public string DisplayNumber => FormattableString.Invariant($"{ClinicLocationId:N}/{IssuedOn:yyyyMMdd}/{Number}");
}

/// <summary>Called inside CommandBus.Run; does not save the ticket or commit the caller's transaction.</summary>
public class TicketNumberAllocator(HospitalDb db, TimeProvider clock)
{
    static readonly TimeZoneInfo Vietnam = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");

    public async Task<AllocatedTicketNumber> AssignAsync(ExaminationTicket ticket, Guid clinicLocationId, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Ticket allocation requires the caller's SQL transaction.");
        if (ticket.ClinicLocationId is not null || ticket.IssuedOn is not null || ticket.SequenceNumber is not null || ticket.Number.Length != 0)
            throw new InvalidOperationException("An issued or legacy ticket must never be renumbered; read its stored number instead.");
        if (db.Entry(ticket).State != EntityState.Added)
            throw new InvalidOperationException("Number allocation is only allowed for a new ticket tracked by this command.");
        Check.That(await db.Set<ClinicRoom>().AnyAsync(x => x.ClinicLocationId == clinicLocationId, ct),
            "invalidClinic", "Ticket numbering requires a configured clinic room.");
        var issuedOn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), Vietnam).DateTime);
        var resource = FormattableString.Invariant($"hospital:ticket:{clinicLocationId:N}:{issuedOn:yyyyMMdd}");
        // Transaction-owned SQL lock also protects the missing-counter-row case across API processes.
        await db.Database.ExecuteSqlInterpolatedAsync($"DECLARE @r int; EXEC @r = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r < 0 THROW 51007, 'Ticket counter busy', 1;", ct);
        var id = Guid.NewGuid();
        var now = clock.GetUtcNow().UtcDateTime;
        await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE TicketDailyCounters SET LastNumber = LastNumber + 1, Version = Version + 1 WHERE ClinicLocationId = {clinicLocationId} AND IssuedOn = {issuedOn}; IF @@ROWCOUNT = 0 INSERT INTO TicketDailyCounters (Id, Version, CreatedAt, ClinicLocationId, IssuedOn, LastNumber) VALUES ({id}, 1, {now}, {clinicLocationId}, {issuedOn}, 1);", ct);
        var sequence = await db.Set<TicketDailyCounter>().AsNoTracking()
            .Where(x => x.ClinicLocationId == clinicLocationId && x.IssuedOn == issuedOn).Select(x => x.LastNumber).SingleAsync(ct);
        ticket.ClinicLocationId = clinicLocationId;
        ticket.IssuedOn = issuedOn;
        ticket.SequenceNumber = sequence;
        ticket.Number = sequence.ToString("D3", CultureInfo.InvariantCulture);
        return new(clinicLocationId, issuedOn, sequence, ticket.Number);
    }
}
