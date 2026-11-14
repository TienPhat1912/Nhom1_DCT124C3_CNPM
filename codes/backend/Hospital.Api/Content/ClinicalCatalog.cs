using System.Text.Json;
using System.Text.RegularExpressions;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Content;

public static class ClinicalCatalog
{
    public static readonly string[] Kinds = ["symptoms", "signs", "diagnoses", "templates"];
    record Input(int Version, string Code, string NameVi, bool Active, string? DiagnosisTemplate, string? ExplanationTemplate, string? InstructionsTemplate);
    static Input Parse(JsonElement body, string kind, bool update)
    {
        string[] fields = kind == "templates" ? ["version", "code", "nameVi", "active", "language", "diagnosisTemplate", "explanationTemplate", "instructionsTemplate"] : ["version", "code", "nameVi", "active"];
        Check.That(body.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
        var names = body.EnumerateObject().Select(p => p.Name).ToArray();
        Check.That(names.Length == fields.Length && names.Distinct().Count() == fields.Length && names.All(fields.Contains), "validation", "Only catalog input fields are accepted.");
        var version = body.GetProperty("version"); var active = body.GetProperty("active");
        Check.That(version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out var _) && (update ? version.GetInt32() > 0 : version.GetInt32() == 0)
            && active.ValueKind is JsonValueKind.True or JsonValueKind.False, "validation", "Use version 0 for creation and the current positive version for updates.");
        string Text(string field, int min, int max) {
            var value = body.GetProperty(field);
            Check.That(value.ValueKind == JsonValueKind.String, "validation", $"{field} must be text.");
            return Check.Text(value.GetString(), field, min, max);
        }
        var code = Text("code", 2, 40).ToUpperInvariant();
        Check.That(Regex.IsMatch(code, "^[A-Z][A-Z0-9_-]{1,39}$", RegexOptions.CultureInvariant), "validation", "Code must start with a letter and contain only A-Z, digits, underscore or hyphen.");
        string? diagnosis = null, explanation = null, instructions = null;
        if (kind == "templates") {
            Check.That(Text("language", 2, 10) == "vi", "sourceMustBeVietnamese", "Clinical templates must have a Vietnamese source.");
            diagnosis = Text("diagnosisTemplate", 1, 4000); explanation = Text("explanationTemplate", 0, 4000); instructions = Text("instructionsTemplate", 1, 6000);
            Check.That(diagnosis.Contains("{{diagnoses}}", StringComparison.Ordinal), "validation", "Diagnosis text must include the explicitly selected diagnoses.");
            foreach (var text in new[] { diagnosis, explanation, instructions }) {
                var remainder = text.Replace("{{symptoms}}", "").Replace("{{signs}}", "").Replace("{{diagnoses}}", "");
                Check.That(!remainder.Contains('{') && !remainder.Contains('}'), "validation", "Only {{symptoms}}, {{signs}} and {{diagnoses}} placeholders are supported.");
            }
        }
        return new(version.GetInt32(), code, Text("nameVi", 2, 200), active.GetBoolean(), diagnosis, explanation, instructions);
    }

    public static object View(Entity entity) => entity switch {
        SymptomCatalog x => new { x.Id, x.Version, createdAt = Utc(x.CreatedAt), x.Code, x.NameVi, x.Kind, x.Active, x.IsDemo },
        DiagnosisCatalog x => new { x.Id, x.Version, createdAt = Utc(x.CreatedAt), x.Code, x.NameVi, kind = "Diagnosis", x.Active, x.IsDemo },
        ClinicalTemplate x => new { x.Id, x.Version, createdAt = Utc(x.CreatedAt), x.Code, x.NameVi, kind = "Template", x.Active, x.IsDemo,
            x.Language, x.DiagnosisTemplate, x.ExplanationTemplate, x.InstructionsTemplate },
        _ => throw new InvalidOperationException("Unsupported catalog entity.")
    };
    static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
    static async Task<object> Page<T>(IQueryable<T> query, bool activeOnly, string? search, int offset) where T : Entity
    {
        if (activeOnly) query = query.Where(x => EF.Property<bool>(x, "Active"));
        if (!string.IsNullOrEmpty(search)) query = query.Where(x => EF.Property<string>(x, "Code").Contains(search) || EF.Property<string>(x, "NameVi").Contains(search));
        var rows = await query.AsNoTracking().OrderBy(x => EF.Property<string>(x, "Code")).ThenBy(x => x.Id).Skip(offset).Take(101).ToArrayAsync();
        return new { items = rows.Take(100).Select(x => View(x)), offset, hasMore = rows.Length > 100 };
    }
    static Task<object> Read(string kind, bool activeOnly, string? search, int offset, HospitalDb db) => kind switch {
        "symptoms" => Page(db.Set<SymptomCatalog>().Where(x => x.Kind == "Symptom"), activeOnly, search, offset),
        "signs" => Page(db.Set<SymptomCatalog>().Where(x => x.Kind == "Sign"), activeOnly, search, offset),
        "diagnoses" => Page(db.Set<DiagnosisCatalog>(), activeOnly, search, offset),
        _ => Page(db.Set<ClinicalTemplate>(), activeOnly, search, offset)
    };
    static async Task<Entity> Find(string kind, Guid id, HospitalDb db) => kind switch {
        "symptoms" or "signs" => (Entity?)await db.Set<SymptomCatalog>().SingleOrDefaultAsync(x => x.Id == id && x.Kind == (kind == "symptoms" ? "Symptom" : "Sign")) ?? throw Missing(),
        "diagnoses" => (Entity?)await db.Set<DiagnosisCatalog>().SingleOrDefaultAsync(x => x.Id == id) ?? throw Missing(),
        _ => (Entity?)await db.Set<ClinicalTemplate>().SingleOrDefaultAsync(x => x.Id == id) ?? throw Missing()
    };
    static ApiException Missing() => new(404, "notFound", "Catalog entry not found.");
    static async Task<object> Save(string kind, Guid? id, JsonElement body, Access access, HospitalDb db, CommandBus bus)
    {
        var admin = await access.Staff("Admin");
        Check.That(Kinds.Contains(kind), "notFound", "Catalog not found.", 404);
        var input = Parse(body, kind, id != null);
        return await bus.Run<object>($"prd-v2:{admin.Id}:clinical-catalog:{kind}:{id}", input, async () => {
            Entity entry = id is {} existing ? await Find(kind, existing, db) : kind switch {
                "symptoms" or "signs" => new SymptomCatalog { Kind = kind == "symptoms" ? "Symptom" : "Sign" },
                "diagnoses" => new DiagnosisCatalog(), _ => new ClinicalTemplate()
            };
            object? before = null;
            if (id != null) {
                Check.Version(entry, input.Version); before = View(entry);
                Check.That(db.Entry(entry).Property<string>("Code").CurrentValue == input.Code, "catalogCodeImmutable", "Code is a stable identifier. Create another entry for a different code.", 409);
            } else db.Add(entry);
            db.Entry(entry).Property("Code").CurrentValue = input.Code;
            db.Entry(entry).Property("NameVi").CurrentValue = input.NameVi;
            db.Entry(entry).Property("Active").CurrentValue = input.Active;
            if (entry is ClinicalTemplate template) {
                template.DiagnosisTemplate = input.DiagnosisTemplate!; template.ExplanationTemplate = input.ExplanationTemplate!; template.InstructionsTemplate = input.InstructionsTemplate!;
            }
            // A no-op update still records an explicit configuration revision.
            if (id != null) db.Entry(entry).Property("NameVi").IsModified = true;
            await db.SaveChangesAsync();
            var result = View(entry);
            bus.Audit(admin.Id, id == null ? "ClinicalCatalogCreated" : input.Active ? "ClinicalCatalogUpdated" : "ClinicalCatalogDisabled",
                detail: JsonSerializer.Serialize(new { kind, id = entry.Id, before, after = result }, CommandBus.Json), source: "Admin");
            return result;
        });
    }
    public static void MapClinicalCatalog(this WebApplication app)
    {
        var group = app.MapGroup("/api/v2").WithTags("Clinical catalog");
        group.AddEndpointFilter(async (ctx, next) => {
            Check.That(app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "V2 workflow is disabled.", 503);
            return await next(ctx);
        });
        group.MapGet("/clinical-catalog/{kind}", async (string kind, string? search, int? offset, Access access, HospitalDb db) => {
            await access.Staff("Doctor"); Check.That(Kinds.Contains(kind), "notFound", "Catalog not found.", 404);
            Check.That((offset ?? 0) >= 0, "validation", "Use a non-negative offset.");
            return await Read(kind, true, Check.Text(search, "search", 0, 100), offset ?? 0, db);
        });
        group.MapGet("/admin/clinical-catalog/{kind}", async (string kind, string? search, int? offset, Access access, HospitalDb db) => {
            await access.Staff("Admin"); Check.That(Kinds.Contains(kind), "notFound", "Catalog not found.", 404);
            Check.That((offset ?? 0) >= 0, "validation", "Use a non-negative offset.");
            return await Read(kind, false, Check.Text(search, "search", 0, 100), offset ?? 0, db);
        });
        group.MapPost("/admin/clinical-catalog/{kind}", (string kind, JsonElement body, Access access, HospitalDb db, CommandBus bus) => Save(kind, null, body, access, db, bus));
        group.MapPut("/admin/clinical-catalog/{kind}/{id:guid}", (string kind, Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus) => Save(kind, id, body, access, db, bus));
    }
}
