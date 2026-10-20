using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Administration;

public static class AdminDashboard
{
    public static async Task<IResult> Read(int? days, Access access, HospitalDb db, CancellationToken ct)
    {
        await access.Staff("Admin");
        var period = days ?? 7;
        Check.That(period is 7 or 30, "validation", "Choose a 7-day or 30-day period.");

        // Hospital reporting uses Vietnam calendar days, independently of the server's time zone.
        var now = DateTime.UtcNow;
        var today = now.AddHours(7).Date;
        var start = today.AddDays(1 - period).AddHours(-7);
        var todayStart = today.AddHours(-7);
        var end = todayStart.AddDays(1);
        var visits = db.Visits.AsNoTracking();

        var admitted = await visits.Where(v => v.CreatedAt >= start && v.CreatedAt < end)
            .GroupBy(v => v.CreatedAt.AddHours(7).Date)
            .Select(g => new { Date = g.Key, Count = g.Count() }).ToListAsync(ct);
        var closed = await visits.Where(v => v.ClosedAt >= start && v.ClosedAt < end && v.Status == "Closed")
            .GroupBy(v => v.ClosedAt!.Value.AddHours(7).Date)
            .Select(g => new { Date = g.Key, Count = g.Count() }).ToListAsync(ct);
        var activeVisits = await visits.Where(v => v.Status == "Active")
            .GroupBy(v => v.DepartmentId)
            .Select(g => new { DepartmentId = g.Key, Count = g.Count() }).ToListAsync(ct);
        var pendingRequests = await db.Requests.CountAsync(r => r.Status == "Submitted" || r.Status == "NeedsInformation", ct);
        var assistance = await db.Set<AssistanceRequest>().AsNoTracking()
            .Where(a => a.Status == "Open" || a.Status == "Acknowledged")
            .GroupBy(a => a.DepartmentId)
            .Select(g => new { DepartmentId = g.Key, Count = g.Count() }).ToListAsync(ct);
        var steps = await db.Set<JourneyStep>().AsNoTracking()
            .Where(s => s.Status == "Waiting" || s.Status == "Ready" || s.Status == "InProgress")
            .GroupBy(s => s.DepartmentId)
            .Select(g => new {
                DepartmentId = g.Key,
                Waiting = g.Count(s => s.Status == "Waiting" || s.Status == "Ready"),
                InProgress = g.Count(s => s.Status == "InProgress")
            }).ToListAsync(ct);
        var departments = await db.Set<Department>().AsNoTracking()
            .Select(d => new { d.Id, d.NameVi, d.NameEn, d.Active }).ToListAsync(ct);
        var activeStaff = await db.Users.CountAsync(u => u.Active && u.Role != "Patient", ct);
        var activeServices = await db.Set<HospitalService>().CountAsync(s => s.Active, ct);
        var servicesWithoutMapping = await db.Set<HospitalService>().CountAsync(s => s.Active &&
            !db.Set<WorkflowMapping>().Any(m => m.HospitalServiceId == s.Id && m.Published), ct);

        var admittedByDay = admitted.ToDictionary(x => x.Date, x => x.Count);
        var closedByDay = closed.ToDictionary(x => x.Date, x => x.Count);
        var visitsByDepartment = activeVisits.ToDictionary(x => x.DepartmentId, x => x.Count);
        var assistanceByDepartment = assistance.ToDictionary(x => x.DepartmentId, x => x.Count);
        var stepsByDepartment = steps.ToDictionary(x => x.DepartmentId);
        return Results.Ok(new {
            generatedAt = now,
            timeZone = "Asia/Ho_Chi_Minh",
            days = period,
            summary = new {
                visitsToday = admittedByDay.GetValueOrDefault(today),
                closedToday = closedByDay.GetValueOrDefault(today),
                activeVisits = activeVisits.Sum(x => x.Count),
                pendingRequests,
                openAssistance = assistance.Sum(x => x.Count)
            },
            daily = Enumerable.Range(0, period).Select(i => {
                var date = today.AddDays(1 - period + i);
                return new {
                    date = date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                    admitted = admittedByDay.GetValueOrDefault(date),
                    closed = closedByDay.GetValueOrDefault(date)
                };
            }),
            departments = departments.Select(d => new {
                d.Id, d.NameVi, d.NameEn, d.Active,
                activeVisits = visitsByDepartment.GetValueOrDefault(d.Id),
                waitingSteps = stepsByDepartment.GetValueOrDefault(d.Id)?.Waiting ?? 0,
                inProgressSteps = stepsByDepartment.GetValueOrDefault(d.Id)?.InProgress ?? 0,
                openAssistance = assistanceByDepartment.GetValueOrDefault(d.Id)
            }).Where(d => d.Active || d.activeVisits + d.waitingSteps + d.inProgressSteps + d.openAssistance > 0)
                .OrderByDescending(d => d.activeVisits).ThenBy(d => d.NameVi),
            configuration = new {
                activeDepartments = departments.Count(d => d.Active),
                activeStaff,
                activeServices,
                servicesWithoutMapping
            }
        });
    }
}
