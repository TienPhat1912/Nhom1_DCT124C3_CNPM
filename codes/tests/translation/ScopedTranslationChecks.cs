using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Hospital.Api.Content;
using Hospital.Api.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

static class ScopedTranslationChecks
{
    static void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
    static IConfigurationRoot Config() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["Translation:Provider"] = "Azure", ["Translation:Key"] = "test-only-secret", ["Translation:TimeoutSeconds"] = "1",
        ["Translation:MaxAttempts"] = "2", ["Translation:RetryDelayMilliseconds"] = "0", ["Translation:CacheVersion"] = "1"
    }).Build();
    static void Fallback(TextTranslation result, string original) => Check(result is { Status: "Unavailable", Translated: null, Fallback: true }
        && result.Original == original, "Unavailable must preserve original, never label it translated");

    public static async Task Run()
    {
        var config = Config(); var fake = new ScopedProvider(); var logs = new SafeLogger();
        using var service = new TranslationService(config, fake, logs);
        var input = new TranslationInput("  private original\n", "en", "vi", 1, "RegistrationRequest:one:Description");
        foreach (var source in new[] { "en", "zh", "ja", "ko", "ru" }) {
            var result = await service.Translate(input with { SourceLanguage = source }, default);
            Check(result is { Status: "Translated", TargetLanguage: "vi", Fallback: false } && result.Translated == "vi:" + input.Original && result.SourceLanguage == source, source + " to Vietnamese");
            Check(fake.Requests.Last().Source == (source == "zh" ? "zh-Hans" : source) && fake.Requests.Last().Target == "vi", "Explicit Azure source and target");
        }
        var outbound = await service.Translate(input with { SourceLanguage = "vi", TargetLanguage = "en" }, default);
        Check(outbound.Translated == "en:" + input.Original && outbound.SourceLanguage == "vi", "Vietnamese outbound remains available");
        var calls = fake.Calls;
        var same = await service.Translate(input with { SourceLanguage = "vi" }, default);
        Check(same is { Status: "NotRequired", Translated: null, Fallback: false } && same.Original == input.Original && fake.Calls == calls, "vi to vi does not call provider or fabricate translation");
        Check((await service.Translate(input with { Original = " \n " }, default)).Status == "NotRequired", "Blank content is preserved without a provider call");
        var alias = await service.Translate(input with { SourceLanguage = "zh-Hans" }, default);
        Check(alias.SourceLanguage == "zh" && fake.Calls == calls, "Canonical aliases reuse the correct source-language cache");
        Check(fake.Requests.All(r => r.Text == input.Original && !r.Query.Contains("RegistrationRequest")), "Preserve raw whitespace; never send record IDs/context to provider");

        var isolated = input with { Original = "sensitive-context-original", Context = "Assistance:one:Description" };
        var before = fake.Calls;
        await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => service.Translate(isolated, default)));
        Check(fake.Calls == before + 1, "Simultaneous scoped misses use one successful provider response");
        await service.Translate(isolated, default); Check(fake.Calls == before + 1, "Scoped cache hit");
        await service.Translate(isolated with { Context = "Assistance:two:Description" }, default);
        await service.Translate(isolated with { Context = "RegistrationRequest:one:Description" }, default);
        await service.Translate(isolated with { SourceVersion = 2 }, default);
        await service.Translate(isolated with { Original = isolated.Original + " edited" }, default);
        await service.Translate(isolated with { SourceLanguage = "ja" }, default);
        await service.Translate(isolated with { TargetLanguage = "ja" }, default);
        Check(fake.Calls == before + 7, "Context, kind, version, source hash, source language and target language isolate cache entries");
        config["Translation:CacheVersion"] = "2";
        await service.Translate(isolated, default); Check(fake.Calls == before + 8, "Provider cache version invalidates earlier derived text");
        config["Translation:Endpoint"] = "https://another-provider.example.test";
        await service.Translate(isolated, default); Check(fake.Calls == before + 9, "Endpoint identity invalidates scoped cache");

        var serialized = JsonSerializer.SerializeToElement(outbound, CommandBus.Json);
        Check(serialized.EnumerateObject().Count() == 7 && serialized.GetProperty("original").GetString() == input.Original
            && !serialized.TryGetProperty("context", out _), "Public DTO excludes server context and provider credentials");
        foreach (var invalid in new[] { input with { SourceVersion = 0 }, input with { Context = "" }, input with { SourceLanguage = "" },
            input with { TargetLanguage = "" }, input with { Original = new string('x', 12001) }, input with { SourceLanguage = "xx" } }) {
            try { await service.Translate(invalid, default); throw new Exception("Invalid request was accepted"); }
            catch (ApiException e) when (e.Status == 422) { }
        }

        foreach (var failure in new[] { "503", "429", "400", "401", "403", "network", "malformed", "empty", "wrongLanguage", "echo", "echoTrim", "timeout" }) {
            var failing = new ScopedProvider { Failure = failure }; var capture = new SafeLogger();
            using var unavailable = new TranslationService(Config(), failing, capture);
            var watch = Stopwatch.StartNew(); Fallback(await unavailable.Translate(input, default), input.Original);
            Check(watch.Elapsed < TimeSpan.FromSeconds(3), "Whole operation has a bounded timeout, including retries");
            Check(failing.Calls == (failure is "503" or "429" or "network" ? 2 : 1), "Retry only transient HTTP failures: " + failure);
            Check(capture.Messages.All(m => !m.Contains(input.Original) && !m.Contains(input.Context) && !m.Contains("test-only-secret") && !m.Contains("sensitive-provider-body")), "No sensitive source, context, key or provider body in logs");
            failing.Failure = null;
            Check((await unavailable.Translate(input, default)).Status == "Translated", "A failed result must not poison the cache or block explicit retry");
        }
        var recovering = new ScopedProvider { FailuresLeft = 1, Failure = "503" };
        using var retrying = new TranslationService(Config(), recovering, logs);
        Check((await retrying.Translate(input, default)).Status == "Translated" && recovering.Calls == 2, "Transient first failure recovers within one request");

        using var offline = new TranslationService(new ConfigurationBuilder().Build(), fake, logs);
        Fallback(await offline.Translate(input, default), input.Original);
        Check((await offline.Translate(input with { Original = "Quầy tiếp nhận", SourceLanguage = "vi", TargetLanguage = "en" }, default)).Status == "Translated", "Bundled outbound dictionary remains available offline");
        foreach (var endpoint in new[] { "http://public.example.test", "ftp://localhost", "https://user:secret@example.test", "https://example.test?key=secret", "https://example.test#secret" }) {
            var invalidConfig = Config(); invalidConfig["Translation:Endpoint"] = endpoint;
            var unused = new ScopedProvider(); using var invalidService = new TranslationService(invalidConfig, unused, logs);
            Fallback(await invalidService.Translate(input, default), input.Original); Check(unused.Calls == 0, "Reject unsafe endpoint before sending source text");
        }
        using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
        try { await service.Translate(input, cancelled.Token); throw new Exception("Expected caller cancellation"); }
        catch (OperationCanceledException) when (cancelled.IsCancellationRequested) { }
        var slow = new ScopedProvider { Failure = "timeout" };
        using var cancellable = new TranslationService(Config(), slow, logs);
        using var abort = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        try { await cancellable.Translate(input, abort.Token); throw new Exception("Expected in-flight cancellation"); }
        catch (OperationCanceledException) when (abort.IsCancellationRequested) { }
        slow.Failure = null; Check((await cancellable.Translate(input, default)).Status == "Translated", "Cancellation releases the single-flight gate");
        Console.WriteLine("PB-017 scoped translation checks passed: source/target, six locales, raw original, context/version cache, retries/timeouts/cancellation, DTO and log privacy.");
    }

    sealed class SafeLogger : ILogger<TranslationService>
    {
        public List<string> Messages { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
    sealed class ScopedProvider : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls;
        public int FailuresLeft = int.MaxValue;
        public string? Failure;
        public List<(string Source, string Target, string Text, string Query)> Requests { get; } = [];
        public HttpClient CreateClient(string name) => new(this, false);
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++; var failure = FailuresLeft-- > 0 ? Failure : null;
            var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(request.RequestUri!.Query);
            var source = query["from"].ToString(); var target = query["to"].ToString();
            var input = await request.Content!.ReadFromJsonAsync<JsonElement>(ct); var original = input[0].GetProperty("text").GetString()!;
            Requests.Add((source, target, original, request.RequestUri.Query));
            Check(request.Headers.GetValues("Ocp-Apim-Subscription-Key").Single() == "test-only-secret", "Server-side credential");
            if (int.TryParse(failure, out var status)) return new((HttpStatusCode)status) { Content = new StringContent("sensitive-provider-body") };
            if (failure == "network") throw new HttpRequestException("sensitive-provider-body");
            if (failure == "timeout") await Task.Delay(Timeout.Infinite, ct);
            if (failure == "malformed") return new(HttpStatusCode.OK) { Content = new StringContent("[]") };
            return new(HttpStatusCode.OK) { Content = JsonContent.Create(new[] { new { translations = new[] {
                new { to = failure == "wrongLanguage" ? "xx" : target, text = failure == "empty" ? "" : failure == "echo" ? original : failure == "echoTrim" ? original.Trim() : (target == "zh-Hans" ? "zh" : target) + ":" + original }
            } } }) };
        }
    }
}
