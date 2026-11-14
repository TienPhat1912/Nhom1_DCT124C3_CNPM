using System.Text.Json;
using System.Text.RegularExpressions;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Journeys;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Content;

public static class Examinations
{
    public record Selection(Guid Id, int Version);
    public record Input(int Version, Selection[] SymptomSelections, Selection[] SignSelections, Selection[] DiagnosisSelections, Selection Template);
    record Preview(Guid VisitId, Guid DoctorId, DateTime ExpiresAt, Input Selections, string Hash);
    record Capture(ClinicalTemplate Template, SymptomCatalog[] Symptoms, SymptomCatalog[] Signs, DiagnosisCatalog[] Diagnoses, object Content);
    static void Fields(JsonElement value, params string[] fields) {
        Check.That(value.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
        var names = value.EnumerateObject().Select(p => p.Name).ToArray();
        Check.That(names.Length == fields.Length && names.Distinct().Count() == fields.Length && names.All(fields.Contains), "validation", "Unexpected examination fields.");
    }
    static int Version(JsonElement v) { Check.That(v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var _) && v.GetInt32() > 0, "validation", "Positive integer version required."); return v.GetInt32(); }
    static Selection Select(JsonElement v) { Fields(v, "id", "version"); Check.That(v.GetProperty("id").ValueKind == JsonValueKind.String && v.GetProperty("id").TryGetGuid(out var _), "validation", "Valid catalog id required."); return new(v.GetProperty("id").GetGuid(), Version(v.GetProperty("version"))); }
    static Input Parse(JsonElement body) {
        Fields(body, "version", "symptomSelections", "signSelections", "diagnosisSelections", "template");
        Selection[] List(string name) {
            var a = body.GetProperty(name); Check.That(a.ValueKind == JsonValueKind.Array && a.GetArrayLength() <= 50, "validation", "Choose at most 50 entries per category.");
            var items = a.EnumerateArray().Select(Select).ToArray(); Check.That(items.Select(x => x.Id).Distinct().Count() == items.Length, "validation", "Duplicate selections are forbidden."); return items;
        }
        var input = new Input(Version(body.GetProperty("version")), List("symptomSelections"), List("signSelections"), List("diagnosisSelections"), Select(body.GetProperty("template")));
        Check.That(input.DiagnosisSelections.Length > 0, "validation", "Select at least one diagnosis."); return input;
    }
    static async Task Subject(Guid id, UserAccount actor, HospitalDb db) {
        var v = await db.Visits.AsNoTracking().SingleOrDefaultAsync(v => v.Id == id) ?? throw new ApiException(404, "notFound", "Visit not found.");
        Check.That(v.DoctorId == actor.Id && v.ClinicLocationId != null, "outOfScope", "Visit is not assigned to you.", 403);
        await DoctorConsultations.Authorize(db, actor.Id, v.ClinicLocationId!.Value);
    }
    static void Ready(Visit v, int version) {
        Check.Version(v, version);
        Check.That(v.Status == "Active" && v.Journey.Status == "Active" && v.ExamStatus == "InConsultation" && v.Ticket.SnapshotSource == "Captured"
            && v.Journey.Steps.Count(s => (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") && s.Status == "InProgress") == 1
            && !v.Orders.Any(o => o.Status is "NotCompleted" or "Ordered"), "requestLocked", "Accept the patient and resolve all services before completing the examination.", 409);
    }
    static async Task<Capture> CaptureInput(Input input, HospitalDb db) {
        await db.Database.ExecuteSqlRawAsync("SELECT Id FROM SymptomCatalog WITH (UPDLOCK,HOLDLOCK); SELECT Id FROM DiagnosisCatalog WITH (UPDLOCK,HOLDLOCK); SELECT Id FROM ClinicalTemplate WITH (UPDLOCK,HOLDLOCK);");
        async Task<SymptomCatalog[]> Symptoms(Selection[] selections, string kind) {
            var ids = selections.Select(x => x.Id).ToArray(); var items = await db.Set<SymptomCatalog>().AsNoTracking().Where(x => ids.Contains(x.Id)).ToArrayAsync();
            Check.That(items.Length == selections.Length && items.All(x => x.Active && x.Kind == kind && selections.Any(s => s.Id == x.Id && s.Version == x.Version)), "previewStale", "Catalog changed. Review selections again.", 409);
            return selections.Select(s => items.Single(x => x.Id == s.Id)).ToArray();
        }
        var symptoms = await Symptoms(input.SymptomSelections, "Symptom"); var signs = await Symptoms(input.SignSelections, "Sign");
        var ids = input.DiagnosisSelections.Select(s => s.Id).ToArray(); var diagnoses = await db.Set<DiagnosisCatalog>().AsNoTracking().Where(x => ids.Contains(x.Id)).ToArrayAsync();
        Check.That(diagnoses.Length == ids.Length && diagnoses.All(x => x.Active && input.DiagnosisSelections.Any(s => s.Id == x.Id && s.Version == x.Version)), "previewStale", "Diagnosis catalog changed.", 409);
        diagnoses = input.DiagnosisSelections.Select(s => diagnoses.Single(x => x.Id == s.Id)).ToArray();
        var template = await db.Set<ClinicalTemplate>().AsNoTracking().SingleOrDefaultAsync(t => t.Id == input.Template.Id);
        Check.That(template != null && template.Active && template.Version == input.Template.Version && template.Language == "vi", "previewStale", "Template changed.", 409);
        string Render(string text, int max) => Check.Text(Regex.Replace(text, @"\{\{(symptoms|signs|diagnoses)\}\}", m => m.Groups[1].Value switch {
            "symptoms" => string.Join(", ", symptoms.Select(x => x.NameVi)), "signs" => string.Join(", ", signs.Select(x => x.NameVi)), _ => string.Join(", ", diagnoses.Select(x => x.NameVi)) }), "renderedContent", 0, max);
        var content = new { language = "vi", diagnosis = Render(template!.DiagnosisTemplate, 4000), explanation = Render(template.ExplanationTemplate, 4000), instructions = Render(template.InstructionsTemplate, 6000) };
        Check.Text(content.diagnosis, "diagnosis", 1, 4000); Check.Text(content.instructions, "instructions", 1, 6000);
        return new(template, symptoms, signs, diagnoses, content);
    }
    static string Hash(Capture value) => Crypto.Hash(JsonSerializer.Serialize(value, CommandBus.Json));
    public static async Task<object?> Record(Guid id, HospitalDb db) {
        var r = await db.Set<ClinicalRecord>().AsNoTracking().Include(r => r.Symptoms).Include(r => r.Diagnoses).SingleOrDefaultAsync(r => r.VisitId == id);
        if (r == null) return null;
        object Snapshot(Guid id, int version, string code, string nameVi) => new { id, version, code, nameVi };
        DateTime Utc(DateTime x) => DateTime.SpecifyKind(x, DateTimeKind.Utc);
        return new { r.Id, r.Version, createdAt = Utc(r.CreatedAt), r.VisitId,
            symptoms = r.Symptoms.Where(s => s.Kind == "Symptom").OrderBy(s => s.CodeSnapshot).Select(s => Snapshot(s.SymptomCatalogId, s.CatalogVersion, s.CodeSnapshot, s.NameViSnapshot)),
            signs = r.Symptoms.Where(s => s.Kind == "Sign").OrderBy(s => s.CodeSnapshot).Select(s => Snapshot(s.SymptomCatalogId, s.CatalogVersion, s.CodeSnapshot, s.NameViSnapshot)),
            diagnoses = r.Diagnoses.OrderBy(s => s.CodeSnapshot).Select(s => Snapshot(s.DiagnosisCatalogId, s.CatalogVersion, s.CodeSnapshot, s.NameViSnapshot)),
            template = new { id = r.TemplateId, version = r.TemplateVersion }, content = new { r.Language, r.Diagnosis, r.Explanation, r.Instructions },
            author = new { id = r.AuthorId, name = r.AuthorName }, confirmedAt = Utc(r.ConfirmedAt), publishedAt = Utc(r.PublishedAt) };
    }
    public static void MapExaminations(this WebApplication app) {
        var protector = app.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector("hospital:examination-preview:v1");
        var g = app.MapGroup("/api/v2");
        g.AddEndpointFilter(async (ctx, next) => { Check.That(app.Configuration.GetValue<bool>("Workflow:PrdV2Enabled"), "workflowNotEnabled", "V2 workflow is disabled.", 503); return await next(ctx); });
        g.MapGet("/visits/{id:guid}/clinical-record", async (Guid id, Access access, HospitalDb db) => { await access.Visit(id, true); var record = await Record(id, db); return record == null ? (IResult)Results.Text("null", "application/json") : Results.Json(record); });
        g.MapPost("/visits/{id:guid}/examination/preview", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus) => {
            var actor = await access.Staff("Doctor"); await Subject(id, actor, db); var input = Parse(body);
            return await bus.Run<object>($"examination-preview:{id}", input, async () => {
                await Subject(id, actor, db); var visit = await db.FullVisits().SingleAsync(v => v.Id == id); Ready(visit, input.Version);
                var captured = await CaptureInput(input, db);
                var token = protector.Protect(JsonSerializer.Serialize(new Preview(id, actor.Id, DateTime.UtcNow.AddMinutes(5), input, Hash(captured)), CommandBus.Json));
                return new { previewId = token, visitId = id, visitVersion = input.Version, selections = input, content = captured.Content };
            }, idempotent: false);
        });
        g.MapPost("/visits/{id:guid}/examination/complete", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var actor = await access.Staff("Doctor"); await Subject(id, actor, db); Fields(body, "version", "previewId"); var version = Version(body.GetProperty("version"));
            Check.That(body.GetProperty("previewId").ValueKind == JsonValueKind.String, "validation", "Preview required."); var token = Check.Text(body.GetProperty("previewId").GetString(), "previewId", 1, 32000);
            return await bus.Run<object>($"prd-v2:{actor.Id}:examination:{id}", new { version, previewId = token }, async () => {
                await Subject(id, actor, db); var visit = await db.FullVisits().SingleAsync(v => v.Id == id); Ready(visit, version);
                Preview? preview;
                try { preview = JsonSerializer.Deserialize<Preview>(protector.Unprotect(token), CommandBus.Json); } catch (Exception ex) when (ex is System.Security.Cryptography.CryptographicException or JsonException) { throw new ApiException(409, "previewStale", "Review the examination again."); }
                Check.That(preview != null && preview.VisitId == id && preview.DoctorId == actor.Id && preview.Selections.Version == version && preview.ExpiresAt > DateTime.UtcNow, "previewStale", "Preview expired or belongs to another examination.", 409);
                var capture = await CaptureInput(preview!.Selections, db); Check.That(Hash(capture) == preview.Hash, "previewStale", "Catalog or template changed. Review again.", 409);
                var content = JsonSerializer.SerializeToElement(capture.Content, CommandBus.Json); var now = DateTime.UtcNow;
                var record = new ClinicalRecord { VisitId = id, AuthorId = actor.Id, AuthorName = actor.Name, TemplateId = capture.Template.Id, TemplateVersion = capture.Template.Version,
                    TemplateSnapshot = JsonSerializer.Serialize(capture.Template, CommandBus.Json), Diagnosis = content.GetProperty("diagnosis").GetString()!, Explanation = content.GetProperty("explanation").GetString()!, Instructions = content.GetProperty("instructions").GetString()!, ConfirmedAt = now, PublishedAt = now };
                foreach (var s in capture.Symptoms.Concat(capture.Signs)) record.Symptoms.Add(new ClinicalSymptom { SymptomCatalogId = s.Id, CatalogVersion = s.Version, Kind = s.Kind, CodeSnapshot = s.Code, NameViSnapshot = s.NameVi, IsDemoSnapshot = s.IsDemo });
                foreach (var d in capture.Diagnoses) record.Diagnoses.Add(new ClinicalDiagnosis { DiagnosisCatalogId = d.Id, CatalogVersion = d.Version, CodeSnapshot = d.Code, NameViSnapshot = d.NameVi, IsDemoSnapshot = d.IsDemo });
                db.Add(record);
                foreach (var step in visit.Journey.Steps.Where(s => (s.Kind == "Consultation" || s.Kind == "ReturnConsultation") && s.Status == "InProgress")) { step.Status = "Completed"; step.CompletedAt = now; }
                visit.ExamStatus = "Completed"; visit.ExaminationCompletedAt = now; db.Entry(visit.Journey).Property(j => j.Version).IsModified = true;
                workflow.Evaluate(visit); bus.Audit(actor.Id, "ExaminationCompleted", id, record.Id.ToString()); bus.Notify(visit.PatientId, id, "contentPublished");
                await db.SaveChangesAsync(); return new { visit = await DoctorConsultations.View(visit, db, canView: true), record = await Record(id, db) };
            });
        });
    }
}
