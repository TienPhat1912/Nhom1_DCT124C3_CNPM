using System.Text.Json;
using System.Text.Json.Nodes;
using Hospital.Api.Infrastructure;

namespace Hospital.Api.Content;

// Runs AFTER the endpoint's authorization and reads. Only explicit hospital-authored fields
// are translated; names of people, identifiers, patient input and original documents are excluded.
public sealed class LocalizedResponseFilter(ITranslationService translator) : IEndpointFilter
{
    static readonly string[] BodyFields = ["text", "diagnosis", "explanation", "instructions", "resolution"];
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var request = context.HttpContext.Request;
        var path = request.Path.Value ?? "";
        var enabled = (HttpMethods.IsGet(request.Method) && !path.Contains("/drafts") && !path.Contains("/admin/") && !path.Contains("/resources")) || path.EndsWith("/narration");
        if (!enabled) return await next(context);
        var language = Languages.Normalize(context.Arguments.OfType<NarrationInput>().FirstOrDefault()?.Language
            ?? (request.Query["language"].FirstOrDefault() ?? request.Headers["X-Hospital-Language"].FirstOrDefault()));
        var result = await next(context);
        if (result is null || result is IResult) return result;
        var json = JsonSerializer.SerializeToNode(result, CommandBus.Json)!;
        var groups = new List<(JsonObject Node, List<(string Source, string Target)> Fields)>();
        var arrays = new List<(JsonArray Array, int Index, string Text)>();
        Collect(json, "", groups, arrays);
        var translated = await translator.Translate(groups.SelectMany(g => g.Fields.Select(f => g.Node[f.Source]!.GetValue<string>())).Concat(arrays.Select(a => a.Text)), language, context.HttpContext.RequestAborted);
        foreach (var (array, index, text) in arrays) array[index] = translated[text].Text;
        foreach (var (node, fields) in groups)
        {
            // A clinical paragraph uses one actual language, even if one field fails to translate.
            var fallback = fields.Any(f => translated[node[f.Source]!.GetValue<string>()].Fallback);
            foreach (var (source, target) in fields)
            {
                var text = node[source]!.GetValue<string>();
                node[target] = fallback ? text : translated[text].Text;
            }
            if (node.ContainsKey("contentLanguage")) node["contentLanguage"] = fallback ? "vi" : language;
            else if (node.ContainsKey("language")) node["language"] = fallback ? "vi" : language;
            node["requestedLanguage"] = language;
            node["fallback"] = fallback;
            node["translationStatus"] = fallback ? "unavailable" : language == "vi" ? "source" : "translated";
            var body = fields.Where(f => BodyFields.Contains(f.Target)).OrderBy(f => f.Target).Select(f => node[f.Target]?.GetValue<string>() ?? "").ToArray();
            if (body.Length > 0) node["contentKey"] = Crypto.Hash(JsonSerializer.Serialize(new { language = fallback ? "vi" : language, body }));
            if (node["section"] is JsonValue section && node["diagnosis"] is not null)
                node["text"] = section.GetValue<string>() == "Diagnosis" ? node["diagnosis"] + "\n" + node["explanation"] : node["instructions"]?.GetValue<string>();
            if (node.ContainsKey("cacheKey")) node["cacheKey"] = Crypto.Hash(node["cacheKey"] + ":" + node["language"] + ":" + node["text"]);
        }
        if (path.EndsWith("/narration") && context.Arguments.OfType<NarrationInput>().FirstOrDefault()?.ContentKey is { Length: > 0 } expected)
            Check.That(json["contentKey"]?.GetValue<string>() == expected, "sourceChanged", "Translation changed. Refresh the displayed content before playback.", 409);
        return Results.Json(json, CommandBus.Json);
    }
    static void Collect(JsonNode? node, string parent, List<(JsonObject Node, List<(string Source, string Target)> Fields)> groups, List<(JsonArray Array, int Index, string Text)> arrays)
    {
        if (node is JsonArray array) {
            for (var i = 0; i < array.Count; i++) {
                if (parent is "specialties" or "doctorSpecialties" && array[i] is JsonValue value && value.TryGetValue<string>(out var text)) arrays.Add((array, i, text));
                else Collect(array[i], parent, groups, arrays);
            }
            return;
        }
        if (node is not JsonObject obj) return;
        var fields = new List<(string, string)>();
        bool Text(string key) => obj[key] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s);
        if (Text("nameVi")) fields.Add(("nameVi", "name"));
        if (Text("departmentNameVi")) fields.Add(("departmentNameVi", "departmentName"));
        if (Text("emergencyVi")) fields.Add(("emergencyVi", "emergency"));
        if (parent is "specialties" or "clinics" && Text("name")) fields.Add(("name", "name"));
        foreach (var field in BodyFields)
            if (Text(field) && !(field == "text" && Text("diagnosis") && obj.ContainsKey("section"))) fields.Add((field, field));
        if (fields.Count > 0) groups.Add((obj, fields));
        foreach (var (key, value) in obj)
            if (key is not ("original" or "clinicalRecord" or "source" or "sourceVariants" or "warnings" or "translations")) Collect(value, key, groups, arrays);
    }
}
