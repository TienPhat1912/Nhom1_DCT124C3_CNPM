using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Integrations;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Content;
public record DraftInput(string Diagnosis, string Explanation, string Instructions, string Language, string DocumentReference, Guid? DraftId = null, int Version = 0);
public record PublishInput(int Version, bool Reviewed);
public record FollowUpInput(Guid DepartmentId, DateTime RecommendedAt, string Text, string Language, bool Reviewed, Guid? Id = null, int Version = 0);
public record NarrationInput(string Kind, string Section, Guid? StepId, Guid? MessageId, int SourceRevision, string Language, string? ContentKey = null);
public record ResolvedSummary(Guid Id, int Revision, string Language, bool Fallback, string Diagnosis, string Explanation, string Instructions,
    string AuthorName, DateTime? PublishedAt, string DocumentReference, object Original);
public class ContentReader(HospitalDb db)
{
    public async Task<ResolvedSummary?> Current(Guid visitId, string language)
    {
        if (await db.Visits.AnyAsync(v => v.Id == visitId && v.ExamStatus != null)) {
            var record = await db.Set<ClinicalRecord>().AsNoTracking().SingleOrDefaultAsync(r => r.VisitId == visitId);
            return record == null ? null : new(record.Id, record.Version, "vi", language != "vi", record.Diagnosis, record.Explanation, record.Instructions,
                record.AuthorName, DateTime.SpecifyKind(record.PublishedAt, DateTimeKind.Utc), "", new { record.Language, record.Diagnosis, record.Explanation, record.Instructions });
        }
        var v = await db.Set<SummaryVersion>().Where(s => s.VisitId == visitId && s.Status == "Published").OrderByDescending(s => s.Revision).FirstOrDefaultAsync();
        if (v is null) return null;
        return new(v.Id, v.Revision, "vi", language != "vi", v.Diagnosis, v.Explanation,
            v.Instructions, v.AuthorName, v.PublishedAt, v.DocumentReference, new { v.Language, v.Diagnosis, v.Explanation, v.Instructions });
    }
}
public static class ContentEndpoints
{
    public static void MapContent(this WebApplication app)
    {
        var g = app.MapGroup("/api").AddEndpointFilter<LocalizedResponseFilter>().WithTags("Doctor content and narration");
        g.AddEndpointFilter(async (ctx, next) => {
            if (ctx.HttpContext.Request.Path.Value?.Contains("/drafts", StringComparison.Ordinal) == true && ctx.HttpContext.Request.RouteValues["id"] is string raw && Guid.TryParse(raw, out var visitId)) {
                var visit = await ctx.HttpContext.RequestServices.GetRequiredService<Access>().DoctorVisit(visitId);
                Check.That(visit.ExamStatus == null, "legacyCommandDisabled", "Use the examination preview and confirmation workflow.", 410);
            }
            return await next(ctx);
        });
        g.MapGet("/visits/{id:guid}/content", async (Guid id, string? language, Access access, HospitalDb db, ContentReader reader, IAppointmentAdapter appointments) => {
            await access.Visit(id, true);
            return new { summary = await reader.Current(id, language ?? "vi"), followUps = await db.Set<FollowUpRecommendation>().Where(f => f.VisitId == id && f.Status == "Published").OrderByDescending(f => f.CreatedAt).ToListAsync(), bookingUrl = appointments.BookingUrl };
        });
        g.MapGet("/visits/{id:guid}/drafts", async (Guid id, Access access, HospitalDb db) => {
            await access.DoctorVisit(id); return await db.Set<SummaryVersion>().Where(s => s.VisitId == id).OrderByDescending(s => s.Revision).ToListAsync();
        });
        g.MapPost("/visits/{id:guid}/drafts", async (Guid id, DraftInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Doctor"); return await bus.Run($"{u.Id}:draft:{id}", input, async () => {
                await access.DoctorVisit(id); SummaryVersion draft;
                if (input.DraftId is {} draftId) {
                    draft = await db.Set<SummaryVersion>().SingleOrDefaultAsync(s => s.Id == draftId && s.VisitId == id && s.Status == "Draft") ?? throw new ApiException(409, "draftLocked", "Only a private draft can be edited.");
                    Check.Version(draft, input.Version);
                } else {
                    var revision = (await db.Set<SummaryVersion>().Where(s => s.VisitId == id).MaxAsync(s => (int?)s.Revision) ?? 0) + 1;
                    draft = new SummaryVersion { VisitId = id, Revision = revision, AuthorId = u.Id, AuthorName = u.Name }; db.Add(draft);
                }
                draft.Diagnosis = Check.Text(input.Diagnosis, "diagnosis", 0, 4000); draft.Explanation = Check.Text(input.Explanation, "explanation", 0, 4000);
                draft.Instructions = Check.Text(input.Instructions, "instructions", 0, 6000); draft.Language = Languages.Source(input.Language);
                draft.DocumentReference = Check.Text(input.DocumentReference, "documentReference", 0, 500);
                // This is a hospital document reference, never an uploaded legal medical record.
                bus.Audit(u.Id, "DraftSaved", id, $"revision:{draft.Revision}"); return new { draft.Id, draft.Revision };
            });
        });
        g.MapPost("/visits/{id:guid}/drafts/{draftId:guid}/publish", async (Guid id, Guid draftId, PublishInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Doctor"); return await bus.Run($"{u.Id}:publish:{draftId}", input, async () => {
                var visit = await access.DoctorVisit(id);
                var draft = await db.Set<SummaryVersion>().SingleOrDefaultAsync(s => s.Id == draftId && s.VisitId == id && s.Status == "Draft") ?? throw new ApiException(409, "draftLocked", "Draft is no longer editable.");
                Check.Version(draft, input.Version); Check.That(input.Reviewed, "reviewRequired", "Review the diagnosis and care instructions before publishing.");
                Check.Text(draft.Diagnosis, "diagnosis", 1, 4000); Check.Text(draft.Instructions, "instructions", 1, 6000);
                foreach (var previous in await db.Set<SummaryVersion>().Where(s => s.VisitId == id && s.Status == "Published").ToListAsync()) {
                    Check.That(previous.Revision < draft.Revision, "draftSuperseded", "A newer source version was already published. Start a new correction.", 409); previous.Status = "Superseded";
                }
                draft.Status = "Published"; draft.PublishedAt = DateTime.UtcNow;
                bus.Notify(visit.PatientId, id, "contentPublished"); bus.Audit(u.Id, "SummaryPublished", id, $"revision:{draft.Revision}"); return new { draft.Id, draft.Revision };
            });
        });
        g.MapPost("/visits/{id:guid}/follow-ups", async (Guid id, FollowUpInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Doctor"); return await bus.Run($"{u.Id}:followUp:{id}", input, async () => {
                var v = await access.DoctorVisit(id); Check.That(input.Reviewed, "reviewRequired", "Review the recommendation before publishing.");
                Check.That(await db.Set<Department>().AnyAsync(d => d.Id == input.DepartmentId && d.Active), "departmentInvalid", "Choose an active department.");
                Check.That(input.RecommendedAt > v.CreatedAt && input.RecommendedAt < DateTime.UtcNow.AddYears(5), "validation", "Recommendation date must follow this attendance.");
                if (input.Id is {} previousId) {
                    var previous = await db.Set<FollowUpRecommendation>().SingleOrDefaultAsync(f => f.Id == previousId && f.VisitId == id);
                    Check.That(previous is not null, "notFound", "Recommendation not found.", 404); Check.Version(previous!, input.Version); previous!.Status = "Superseded";
                }
                var rec = new FollowUpRecommendation { VisitId = id, AuthorId = u.Id, DepartmentId = input.DepartmentId, RecommendedAt = input.RecommendedAt.ToUniversalTime(), Text = Check.Text(input.Text, "text", 1, 2000), Language = Languages.Source(input.Language) };
                db.Add(rec); bus.Notify(v.PatientId, id, "followUpPublished"); bus.Audit(u.Id, "FollowUpPublished", id); return new { rec.Id, isAppointment = false };
            });
        });
        g.MapPost("/visits/{id:guid}/narration", async (Guid id, NarrationInput input, Access access, HospitalDb db, ContentReader reader, INarrationAdapter provider, CancellationToken ct) => {
            var v = await access.Visit(id, input.Kind == "Summary"); string text; string language; int revision; string identity; string? diagnosis = null; string? explanation = null; string? instructions = null;
            if (input.Kind == "Summary") {
                var summary = await reader.Current(id, input.Language) ?? throw new ApiException(404, "notPublished", "Doctor content is not yet published.");
                Check.That(summary.Revision == input.SourceRevision, "sourceChanged", "Content was corrected. Refresh before playback.", 409);
                Check.That(input.Section is "Diagnosis" or "Instructions", "validation", "Choose a supported section.");
                diagnosis = summary.Diagnosis; explanation = summary.Explanation; instructions = summary.Instructions;
                text = input.Section == "Diagnosis" ? summary.Diagnosis + "\n" + summary.Explanation : summary.Instructions; language = summary.Language; revision = summary.Revision; identity = summary.Id.ToString();
            } else {
                Check.That(input.Kind == "Step", "validation", "Unsupported narration content.");
                var step = v.Journey.Steps.SingleOrDefault(s => s.Id == input.StepId) ?? throw new ApiException(404, "notFound", "Step not found.");
                var candidates = await db.Set<GuidanceTemplate>().Where(t => t.Key == step.TemplateKey && t.Published).OrderByDescending(t => t.Revision).ToListAsync();
                var t = candidates.FirstOrDefault(t => t.Language == "vi");
                Check.That(t is not null, "templateUnavailable", "No approved narration text is available.", 503);
                Check.That(input.SourceRevision == t!.Revision, "sourceChanged", "Instruction updated. Refresh before playback.", 409);
                text = t.Text; language = t.Language; revision = t.Revision; identity = t.Id.ToString();
            }
            var engine = await provider.ResolveProvider(ct);
            return new { text, diagnosis, explanation, instructions, section = input.Section, language, revision, provider = engine, fallback = language != input.Language, cacheKey = Crypto.Hash($"{identity}:{revision}:{language}:{input.Section}:{text}") };
        });
        g.MapPost("/requests/{id:guid}/messages/{messageId:guid}/narration", async (Guid id, Guid messageId, NarrationInput? input, Access access, INarrationAdapter provider, CancellationToken ct) => {
            var r = await access.Request(id); var m = r.Messages.SingleOrDefault(m => m.Id == messageId) ?? throw new ApiException(404, "notFound", "Message not found.");
            return new { text = m.Text, language = m.Language, revision = 1, provider = await provider.ResolveProvider(ct), cacheKey = Crypto.Hash(m.Text + m.Language) };
        });
    }
}
