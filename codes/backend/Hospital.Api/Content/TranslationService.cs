using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hospital.Api.Infrastructure;
using Microsoft.Extensions.Caching.Memory;

namespace Hospital.Api.Content;

public static class Languages
{
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
public interface ITranslationService
{
    Task<IReadOnlyDictionary<string, TranslatedText>> Translate(IEnumerable<string> texts, string language, CancellationToken ct);
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
                    var endpoint = config["Translation:Endpoint"] ?? "https://api.cognitive.microsofttranslator.com";
                    if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && !uri.IsLoopback)) throw new InvalidOperationException("Translation endpoint must use HTTPS.");
                    using var request = new HttpRequestMessage(HttpMethod.Post, endpoint.TrimEnd('/') + "/translate?api-version=3.0&from=vi&to=" + (language == "zh" ? "zh-Hans" : language));
                    request.Headers.Add("Ocp-Apim-Subscription-Key", config["Translation:Key"]);
                    if (!string.IsNullOrWhiteSpace(config["Translation:Region"])) request.Headers.Add("Ocp-Apim-Subscription-Region", config["Translation:Region"]);
                    request.Content = JsonContent.Create(batch.Select(t => new { Text = t }));
                    using var response = await clients.CreateClient("translation").SendAsync(request, timeout.Token);
                    response.EnsureSuccessStatusCode();
                    using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(timeout.Token), cancellationToken: timeout.Token);
                    if (json.RootElement.ValueKind != JsonValueKind.Array || json.RootElement.GetArrayLength() != batch.Count) throw new JsonException("Incomplete translation response.");
                    var values = json.RootElement.EnumerateArray().Select(x => {
                        var items = x.GetProperty("translations");
                        if (items.GetArrayLength() == 0) throw new JsonException("Missing translation.");
                        return items[0];
                    }).ToArray();
                    if (values.Any(x => x.GetProperty("to").GetString() != (language == "zh" ? "zh-Hans" : language) || string.IsNullOrWhiteSpace(x.GetProperty("text").GetString()))) throw new JsonException("Invalid translation response.");
                    for (var i = 0; i < batch.Count; i++)
                    {
                        var translated = new TranslatedText(values[i].GetProperty("text").GetString()!, language, false, "Azure");
                        result[batch[i]] = translated;
                        cache.Set(Key(batch[i], language), translated, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(Math.Clamp(config.GetValue("Translation:CacheMinutes", 60), 1, 1440)), Size = (batch[i].Length + translated.Text.Length) * 2L + 256 });
                    }
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or InvalidOperationException or KeyNotFoundException || (ex is OperationCanceledException && !ct.IsCancellationRequested))
            {
                // Never log source text, credentials or provider response bodies.
                logger.LogWarning("Translation unavailable ({Type}); returning Vietnamese source.", ex.GetType().Name);
                retryAfter = DateTimeOffset.UtcNow.AddSeconds(15);
            }
            return result;
        }
        finally { gate.Release(); }
    }
    static string Key(string text, string language) => language + ":" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    public void Dispose() { cache.Dispose(); gate.Dispose(); }
}
