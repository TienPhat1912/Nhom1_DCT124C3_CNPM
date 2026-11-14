using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Reception;

public static class GuestRecoveryLookup
{
    public static void MapGuestRecoveryLookup(this WebApplication app)
    {
        app.MapGet("/api/reception/guest-tickets", async (int number, DateOnly issuedOn, Guid? clinicLocationId, Access access, HospitalDb db) => {
            var user = await access.Staff("Reception");
            Check.That(number >= 1, "validation", "Enter a positive ticket number.");
            var scope = user.Scopes.Select(s => s.DepartmentId).ToArray();
            var rows = await db.Set<ExaminationTicket>()
                .Where(t => t.SequenceNumber == number && t.IssuedOn == issuedOn
                    && (clinicLocationId == null || t.ClinicLocationId == clinicLocationId)
                    && db.Visits.Any(v => v.Id == t.VisitId && scope.Contains(v.DepartmentId)
                        && !db.Users.Any(u => u.PatientId == v.PatientId)))
                .OrderBy(t => t.ClinicLocationId).ThenBy(t => t.VisitId).Take(101)
                .Select(t => new { t.VisitId, t.Number, t.IssuedOn, t.ClinicLocationId, t.PatientSnapshot, t.ClinicSnapshot }).ToListAsync();
            // Historical snapshots identify the printed ticket; never infer a Visit from name alone.
            return new { hasMore = rows.Count > 100, items = rows.Take(100).Select(t => new {
                t.VisitId, t.Number, t.IssuedOn, t.ClinicLocationId,
                patient = t.PatientSnapshot == null ? null : JsonSerializer.Deserialize<PatientTicketSnapshot>(t.PatientSnapshot, CommandBus.Json),
                clinic = t.ClinicSnapshot == null ? null : JsonSerializer.Deserialize<ClinicTicketSnapshot>(t.ClinicSnapshot, CommandBus.Json)
            }) };
        }).WithTags("Guest recovery");
    }
}
