using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hospital.Api.Infrastructure;
using Microsoft.Extensions.Caching.Memory;

namespace Hospital.Api.Content;

public static class Languages
{
    public static readonly string[] Primary = ["vi", "en", "zh", "ja"];
    // Preserve old preferences/source documents and older clients, without advertising them.
    public static readonly string[] Supported = ["vi", "en", "zh", "ko", "ja", "ru"];
    public static string Normalize(string? language)
    {
        var value = (language ?? "vi").Trim().ToLowerInvariant();
        if (value is "zh-hans" or "zh-cn") value = "zh";
        Check.That(Supported.Contains(value), "languageUnsupported", "Choose vi, en, zh, ko, ja or ru.");
        return value;
    }
    public static string Source(string? language)
    {
        Check.That(Normalize(language) == "vi", "sourceLanguageRequired", "Hospital content must be entered in Vietnamese.");
        return "vi";
    }
}

public record TranslatedText(string Text, string Language, bool Fallback, string Provider);
// Context is server-owned (e.g. RegistrationRequest:{id}:Description), never a client-supplied scope.
public record TranslationInput(string Original, string SourceLanguage, string TargetLanguage, int SourceVersion, string Context);
public record TextTranslation(string Original, string SourceLanguage, string TargetLanguage, int SourceVersion,
    string Status, string? Translated, bool Fallback);
public interface ITranslationService
{
    Task<IReadOnlyDictionary<string, TranslatedText>> Translate(IEnumerable<string> texts, string language, CancellationToken ct);
    Task<TextTranslation> Translate(TranslationInput input, CancellationToken ct);
}

// Only derived text lives in this bounded, expiring memory cache. No translation is written to SQL.
public sealed class TranslationService : ITranslationService, IDisposable
{
    readonly IConfiguration config;
    readonly IHttpClientFactory clients;
    readonly ILogger<TranslationService> logger;
    readonly MemoryCache cache = new(new MemoryCacheOptions { SizeLimit = 8 * 1024 * 1024 });
    readonly SemaphoreSlim gate = new(1, 1);
    readonly Dictionary<string, Dictionary<string, string>> phrases;
    DateTimeOffset retryAfter;

    public TranslationService(IConfiguration config, IHttpClientFactory clients, ILogger<TranslationService> logger)
    {
        this.config = config; this.clients = clients; this.logger = logger;
        using var stream = typeof(TranslationService).Assembly.GetManifestResourceStream("Hospital.Translations.json");
        phrases = stream is null ? [] : JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(stream)!;
    }
    public async Task<IReadOnlyDictionary<string, TranslatedText>> Translate(IEnumerable<string> texts, string language, CancellationToken ct)
    {
        language = Languages.Normalize(language);
        var result = texts.Distinct(StringComparer.Ordinal).ToDictionary(t => t, t => new TranslatedText(t, "vi", language != "vi", "Source"), StringComparer.Ordinal);
        if (language == "vi") return result;
        // Single flight avoids duplicate provider calls from polling and simultaneous playback.
        await gate.WaitAsync(ct);
        try
        {
            var missing = new List<string>();
            foreach (var text in result.Keys)
            {
                if (string.IsNullOrWhiteSpace(text)) { result[text] = new(text, language, false, "Source"); continue; }
                if (phrases.TryGetValue(text, out var translations) && translations.TryGetValue(language, out var translated))
                    result[text] = new(translated, language, false, "Dictionary");
                else if (cache.TryGetValue<TranslatedText>(Key(text, language), out var hit) && hit is not null) result[text] = hit;
                else missing.Add(text);
            }
            if (missing.Count == 0 || config["Translation:Provider"] != "Azure" || string.IsNullOrWhiteSpace(config["Translation:Key"]) || retryAfter > DateTimeOffset.UtcNow) return result;
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(config.GetValue("Translation:TimeoutSeconds", 5), 1, 10)));
            // Keep requests below the provider's character and item limits.
            var batches = new List<List<string>>();
            foreach (var text in missing)
            {
                if (batches.Count == 0 || batches[^1].Count >= 100 || batches[^1].Sum(t => t.Length) + text.Length > 40000) batches.Add([]);
                batches[^1].Add(text);
            }
            try
            {
                foreach (var batch in batches)
                {
                    var values = await RequestTranslations(batch, "vi", language, timeout.Token);
                    for (var i = 0; i < batch.Count; i++)
                    {
                        var translated = new TranslatedText(values[i], language, false, "Azure");
                        result[batch[i]] = translated;
                        cache.Set(Key(batch[i], language), translated, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(Math.Clamp(config.GetValue("Translation:CacheMinutes", 60), 1, 1440)), Size = (batch[i].Length + translated.Text.Length) * 2L + 256 });
                    }
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or FormatException || (ex is OperationCanceledException && !ct.IsCancellationRequested))
            {
                // Never log source text, credentials or provider response bodies.
                logger.LogWarning("Translation unavailable ({Type}); returning Vietnamese source.", ex.GetType().Name);
                retryAfter = DateTimeOffset.UtcNow.AddSeconds(15);
            }
            return result;
        }
        finally { gate.Release(); }
    }
    public async Task<TextTranslation> Translate(TranslationInput input, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        Check.That(input.Original is { Length: <= 12000 } && !string.IsNullOrWhiteSpace(input.SourceLanguage)
            && !string.IsNullOrWhiteSpace(input.TargetLanguage) && input.SourceVersion > 0
            && !string.IsNullOrWhiteSpace(input.Context) && input.Context.Length <= 256,
            "validation", "Explicit source, target, source version and server context are required.");
        var source = Languages.Normalize(input.SourceLanguage); var target = Languages.Normalize(input.TargetLanguage);
        TextTranslation Result(string status, string? translated = null) => new(input.Original, source, target, input.SourceVersion, status, translated, status == "Unavailable");
        if (source == target || string.IsNullOrWhiteSpace(input.Original)) return Result("NotRequired");
        var key = "scoped:" + Crypto.Hash(JsonSerializer.Serialize(new {
            source, target, input.SourceVersion, input.Context, input.Original,
            provider = config["Translation:Provider"], endpoint = config["Translation:Endpoint"], version = config["Translation:CacheVersion"] ?? "1"
        }));
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(config.GetValue("Translation:TimeoutSeconds", 5), 1, 10)));
        var acquired = false;
        try
        {
            await gate.WaitAsync(timeout.Token); acquired = true;
            if (cache.TryGetValue<TranslatedText>(key, out var hit) && hit != null) return Result("Translated", hit.Text);
            string? text = null;
            if (source == "vi" && phrases.TryGetValue(input.Original, out var variants) && variants.TryGetValue(target, out var known)) text = known;
            else if (config["Translation:Provider"] == "Azure" && !string.IsNullOrWhiteSpace(config["Translation:Key"]))
            {
                var attempts = Math.Clamp(config.GetValue("Translation:MaxAttempts", 2), 1, 3);
                for (var attempt = 1; attempt <= attempts; attempt++)
                {
                    try { text = (await RequestTranslations([input.Original], source, target, timeout.Token))[0]; break; }
                    catch (HttpRequestException ex) when (attempt < attempts && !timeout.IsCancellationRequested
                        && (ex.StatusCode == null || (int)ex.StatusCode is 408 or 429 or >= 500))
                    { await Task.Delay(TimeSpan.FromMilliseconds(Math.Clamp(config.GetValue("Translation:RetryDelayMilliseconds", 100), 0, 500)), timeout.Token); }
                }
            }
            // An echoed original must not masquerade as a successful translation.
            if (string.IsNullOrWhiteSpace(text) || text.Trim() == input.Original.Trim()) return Result("Unavailable");
            cache.Set(key, new TranslatedText(text, target, false, source == "vi" && phrases.ContainsKey(input.Original) ? "Dictionary" : "Azure"),
                new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(Math.Clamp(config.GetValue("Translation:CacheMinutes", 60), 1, 1440)), Size = (input.Original.Length + text.Length) * 2L + 256 });
            return Result("Translated", text);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException or FormatException
            || (ex is OperationCanceledException && !ct.IsCancellationRequested))
        {
            logger.LogWarning("Translation unavailable ({Type}); returning original source.", ex.GetType().Name);
            return Result("Unavailable");
        }
        finally { if (acquired) gate.Release(); }
    }

    async Task<string[]> RequestTranslations(IReadOnlyList<string> batch, string source, string target, CancellationToken ct)
    {
        var endpoint = config["Translation:Endpoint"] ?? "https://api.cognitive.microsofttranslator.com";
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || !(uri.Scheme == "https" || (uri.Scheme == "http" && uri.IsLoopback))
            || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0) throw new InvalidOperationException("Configure a valid HTTPS translation endpoint.");
        static string AzureLanguage(string language) => language == "zh" ? "zh-Hans" : language;
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint.TrimEnd('/')
            + "/translate?api-version=3.0&from=" + AzureLanguage(source) + "&to=" + AzureLanguage(target));
        request.Headers.Add("Ocp-Apim-Subscription-Key", config["Translation:Key"]);
        if (!string.IsNullOrWhiteSpace(config["Translation:Region"])) request.Headers.Add("Ocp-Apim-Subscription-Region", config["Translation:Region"]);
        request.Content = JsonContent.Create(batch.Select(t => new { Text = t }));
        using var response = await clients.CreateClient("translation").SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        if (json.RootElement.ValueKind != JsonValueKind.Array || json.RootElement.GetArrayLength() != batch.Count) throw new JsonException("Incomplete translation response.");
        return json.RootElement.EnumerateArray().Select(item => {
            var translations = item.GetProperty("translations");
            if (translations.ValueKind != JsonValueKind.Array || translations.GetArrayLength() != 1) throw new JsonException("Missing translation.");
            var value = translations[0];
            if (value.GetProperty("to").GetString() != AzureLanguage(target) || string.IsNullOrWhiteSpace(value.GetProperty("text").GetString())) throw new JsonException("Invalid translation response.");
            return value.GetProperty("text").GetString()!;
        }).ToArray();
    }
    static string Key(string text, string language) => language + ":" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    public void Dispose() { cache.Dispose(); gate.Dispose(); }
}
