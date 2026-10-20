using Hospital.Api.Infrastructure;

namespace Hospital.Api.Integrations;

public record VerifiedIdentity(string Provider, string Reference);
public record Booking(string Reference, string IdentityReference, DateTime ScheduledAt, string DepartmentCode, string Status);
public record OperationalEvent(string Source, string EventId, Guid VisitId, Guid StepId, string Status, int Version, string Reason);
public record SettlementEvent(string Source, string EventId, Guid VisitId, string Outcome, int WorkRevision);
public interface IIdentityAdapter { Task<VerifiedIdentity> Verify(string reference, string proof, CancellationToken ct); }
public interface IAppointmentAdapter
{
    Task<Booking[]> List(string identity, CancellationToken ct);
    Task<Booking> Lookup(string reference, CancellationToken ct);
    string? BookingUrl { get; }
}
public interface IOperationalAdapter { Task<OperationalEvent> Validate(OperationalEvent input, CancellationToken ct); }
public interface ISettlementAdapter { Task<SettlementEvent> Validate(SettlementEvent input, CancellationToken ct); }
public interface INarrationAdapter { Task<string> ResolveProvider(CancellationToken ct); }

// Deliberately deterministic fixtures. Never enabled as a production identity verifier.
public class SimulationAdapters(IConfiguration config) : IIdentityAdapter, IAppointmentAdapter, IOperationalAdapter, ISettlementAdapter, INarrationAdapter
{
    public string? BookingUrl => config["Providers:BookingUrl"];
    async Task CheckProvider(CancellationToken ct)
    {
        Check.That(config.GetValue<bool>("Demo:Enabled") && config["Providers:Mode"] == "Simulation", "providerUnavailable", "No production provider has been configured.", 503);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(config.GetValue<int>("Providers:TimeoutSeconds", 5)));
        try
        {
            if (config["Providers:FailureMode"] == "Timeout") await Task.Delay(Timeout.Infinite, timeout.Token);
            Check.That(config["Providers:FailureMode"] != "Unavailable", "providerUnavailable", "The provider is unavailable. Retry or ask reception.", 503);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new ApiException(504, "providerTimeout", "Provider timed out. Local records are unchanged."); }
    }
    public async Task<VerifiedIdentity> Verify(string reference, string proof, CancellationToken ct)
    {
        await CheckProvider(ct);
        Check.That(reference is "DEMO-001" or "DEMO-002" && proof == "SIM-VERIFY-" + reference, "verificationFailed", "External verification failed.", 403);
        return new("Simulation", reference);
    }
    public async Task<Booking[]> List(string identity, CancellationToken ct)
    {
        await CheckProvider(ct);
        return identity == "DEMO-001" ? [Fixture("BOOK-001", identity)] : [];
    }
    public async Task<Booking> Lookup(string reference, CancellationToken ct)
    {
        await CheckProvider(ct);
        Check.That(reference == "BOOK-001", "bookingNotFound", "No usable booking was found.", 404);
        return Fixture(reference, "DEMO-001");
    }
    static Booking Fixture(string reference, string identity) => new(reference, identity, new DateTime(2026, 10, 16, 2, 0, 0, DateTimeKind.Utc), "CONSULT", "Confirmed");
    public async Task<OperationalEvent> Validate(OperationalEvent input, CancellationToken ct) { await CheckProvider(ct); return input with { Source = "SimulationService" }; }
    public async Task<SettlementEvent> Validate(SettlementEvent input, CancellationToken ct) { await CheckProvider(ct); return input with { Source = "SimulationSettlement" }; }
    public async Task<string> ResolveProvider(CancellationToken ct) { await CheckProvider(ct); return "DeviceSpeech"; }
}
