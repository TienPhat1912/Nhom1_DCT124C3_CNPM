using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Hospital.Api.Content;
using Hospital.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

static void Check(bool condition, string description) { if (!condition) throw new Exception(description); }
var fake = new Provider();
// Allow cold-start/JIT work on CI; only timeout checks need the minimum deadline.
static IConfigurationRoot Config(int timeoutSeconds = 5) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Translation:Provider"] = "Azure", ["Translation:Key"] = "test-only", ["Translation:TimeoutSeconds"] = timeoutSeconds.ToString()
}).Build();
var config = Config();
using var service = new TranslationService(config, fake, NullLogger<TranslationService>.Instance);
var source = "Nội dung thử nghiệm chưa có trong từ điển";
foreach (var language in Languages.Supported)
{
    var result = await service.Translate(["Quầy tiếp nhận", source], language, default);
    Check(result.Values.All(x => !x.Fallback && x.Language == language),
        $"Actual language for {language}: {JsonSerializer.Serialize(result.Values)}; provider calls: {fake.Calls}");
    Check(result[source].Text == (language == "vi" ? source : language + ":" + source), "Provider result");
}
Check(fake.Calls == 5, "Vietnamese and dictionary hits bypass provider");
await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => service.Translate([source], "ja", default)));
Check(fake.Calls == 5, "Concurrent cache hits must not call provider again");
await service.Translate([source + " đã sửa"], "ja", default);
Check(fake.Calls == 6, "Source edits invalidate cached translations");
await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => service.Translate([source + " concurrent"], "ja", default)));
Check(fake.Calls == 7, "Simultaneous misses should make one provider call");

var filter = new LocalizedResponseFilter(service);
async Task<JsonNode> Localize(object payload, string language, NarrationInput? narration = null)
{
    var http = new DefaultHttpContext();
    http.Request.Path = narration is null ? "/api/visits/test/content" : "/api/visits/test/narration";
    http.Request.Method = narration is null ? "GET" : "POST";
    http.Request.Headers["X-Hospital-Language"] = language;
    var context = new DefaultEndpointFilterInvocationContext(http, narration is null ? [] : [narration]);
    var result = await filter.InvokeAsync(context, _ => ValueTask.FromResult<object?>(payload));
    return (JsonNode)((IValueHttpResult)result!).Value!;
}
var display = await Localize(new { diagnosis = source, explanation = "Giải thích thử nghiệm", instructions = "Hướng dẫn thử nghiệm", language = "vi",
    patientName = "Nguyễn Văn A", room = "B201", original = new { diagnosis = source } }, "ko");
Check(display["patientName"]!.GetValue<string>() == "Nguyễn Văn A" && display["room"]!.GetValue<string>() == "B201", "Never translate identity or room codes");
Check(display["original"]!["diagnosis"]!.GetValue<string>() == source, "Original must remain Vietnamese");
var assistance = await Localize(new { resolution = source, description = "Người bệnh tự khai", patientName = "Nguyễn Văn A" }, "ja");
Check(assistance["resolution"]!.GetValue<string>() == "ja:" + source && assistance["description"]!.GetValue<string>() == "Người bệnh tự khai", "Translate staff resolution without altering patient input");
var audio = await Localize(new { diagnosis = source, explanation = "Giải thích thử nghiệm", instructions = "Hướng dẫn thử nghiệm", text = source + "\nGiải thích thử nghiệm", section = "Diagnosis", language = "vi", cacheKey = "test" }, "ko",
    new("Summary", "Diagnosis", null, null, 1, "ko", display["contentKey"]!.GetValue<string>()));
Check(audio["text"]!.GetValue<string>() == display["diagnosis"] + "\n" + display["explanation"], "Display and narration must use exactly the same translation");
try { await Localize(new { text = "Quầy tiếp nhận", language = "vi" }, "ja", new("Step", "", null, null, 1, "ja", "stale")); throw new Exception("Expected stale content rejection"); }
catch (ApiException e) when (e.Code == "sourceChanged") { }
var deniedHttp = new DefaultHttpContext(); deniedHttp.Request.Method = "GET"; deniedHttp.Request.Path = "/api/visits/private/content"; deniedHttp.Request.QueryString = new("?language=ja");
var before = fake.Calls;
try { await filter.InvokeAsync(new DefaultEndpointFilterInvocationContext(deniedHttp), _ => throw new ApiException(403, "forbidden", "Denied")); }
catch (ApiException e) when (e.Status == 403) { }
Check(fake.Calls == before, "Authorization must precede translation and cache reads");

foreach (var failure in new[] { "http", "timeout", "malformed", "emptyTranslation", "wrongLanguage" })
{
    using var unavailable = new TranslationService(Config(failure == "timeout" ? 1 : 5), new Provider { Failure = failure }, NullLogger<TranslationService>.Instance);
    var result = await unavailable.Translate([source], "ru", default);
    Check(result[source] is { Language: "vi", Fallback: true } && result[source].Text == source, "Honest fallback on " + failure);
}
using var offline = new TranslationService(new ConfigurationBuilder().Build(), fake, NullLogger<TranslationService>.Instance);
var absent = await offline.Translate([source], "zh", default);
Check(absent[source] is { Language: "vi", Fallback: true }, "Unconfigured provider must not pretend to translate");
var offlineHttp = new DefaultHttpContext(); offlineHttp.Request.Method = "GET"; offlineHttp.Request.Path = "/api/visits/test/content"; offlineHttp.Request.Headers["X-Hospital-Language"] = "ja";
var mixed = await new LocalizedResponseFilter(offline).InvokeAsync(new DefaultEndpointFilterInvocationContext(offlineHttp), _ => ValueTask.FromResult<object?>(new { diagnosis = "Quầy tiếp nhận", instructions = source, language = "vi" }));
var mixedValue = (JsonNode)((IValueHttpResult)mixed!).Value!;
Check(mixedValue["diagnosis"]!.GetValue<string>() == "Quầy tiếp nhận" && mixedValue["language"]!.GetValue<string>() == "vi", "Clinical fallback is atomic across fields");
try { Languages.Source("en"); throw new Exception("Expected Vietnamese-only rejection"); } catch (ApiException) { }
try { Languages.Normalize("xx"); throw new Exception("Expected unsupported-language rejection"); } catch (ApiException) { }
Check(Languages.Normalize("zh-Hans") == "zh", "Canonical Chinese locale");
Console.WriteLine("Translation checks passed: six languages, batching/cache, edits, access, original preservation, narration binding and five failure modes.");
await ScopedTranslationChecks.Run();
if (args.Contains("--migration")) await MigrationChecks.Run();

sealed class Provider : HttpMessageHandler, IHttpClientFactory
{
    public int Calls;
    public string? Failure;
    public HttpClient CreateClient(string name) => new(this, false);
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Calls++;
        if (Failure == "timeout") await Task.Delay(Timeout.Infinite, ct);
        if (Failure == "http") return new(HttpStatusCode.ServiceUnavailable);
        if (Failure == "malformed") return new(HttpStatusCode.OK) { Content = new StringContent("[]") };
        if (request.Headers.GetValues("Ocp-Apim-Subscription-Key").Single() != "test-only") throw new Exception("Missing server credential");
        var language = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(request.RequestUri!.Query)["to"].ToString();
        var input = await request.Content!.ReadFromJsonAsync<JsonElement>(ct);
        if (Failure == "emptyTranslation") return new(HttpStatusCode.OK) { Content = JsonContent.Create(input.EnumerateArray().Select(_ => new { translations = Array.Empty<object>() })) };
        return new(HttpStatusCode.OK) { Content = JsonContent.Create(input.EnumerateArray().Select(x => new { translations = new[] {
            new { to = Failure == "wrongLanguage" ? "en" : language, text = (language == "zh-Hans" ? "zh" : language) + ":" + x.GetProperty("text").GetString() }
        } })) };
    }
}
