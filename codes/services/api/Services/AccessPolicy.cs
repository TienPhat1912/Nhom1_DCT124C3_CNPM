using System.Security.Claims;
using HospitalVisitApi.Data;
using HospitalVisitApi.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalVisitApi.Services;

public static class AccessPolicy
{
    public static bool InScope(User staff, Guid departmentId) =>
        staff.Role == UserRole.Administrator ||
        (staff.StaffScope ?? "").Split(',', StringSplitOptions.TrimEntries).Contains(departmentId.ToString());

    public static async Task CheckVisitAsync(AppDbContext db, Guid visitId, Guid? userId, Guid? guestId)
    {
        var visit = await db.Visits.FindAsync(visitId) ?? throw new KeyNotFoundException("Visit not found");
        if (userId.HasValue)
        {
            var user = await db.Users.FindAsync(userId);
            if (user?.Role == UserRole.Patient && visit.UserId == userId) return;
            if (user?.Role == UserRole.Administrator) return;
            if (user?.Role == UserRole.Doctor && visit.AssignedDoctorId == userId && InScope(user, visit.DepartmentId)) return;
            if (user?.Role == UserRole.Receptionist && InScope(user, visit.DepartmentId)) return;
            if (user?.Role == UserRole.Cashier && InScope(user, Data.SeedData.DeptCashier)) return;
            if (user?.Role == UserRole.ServiceStaff && await db.JourneySteps.AnyAsync(s =>
                s.Journey.VisitId == visitId && s.Service != null &&
                (user.StaffScope ?? "").Contains(s.Service.DepartmentId.ToString()))) return;
        }
        if (guestId.HasValue && visit.GuestSessionId == guestId && !visit.UserId.HasValue &&
            await db.GuestSessions.AnyAsync(g => g.Id == guestId && !g.IsConsumed && g.ExpiresAt > DateTime.UtcNow)) return;
        throw new UnauthorizedAccessException("Access to this patient context is denied");
    }
}

// Every endpoint is protected here; public entry never supplies access to patient records.
public sealed class AccessFilter(AppDbContext db) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            var http = context.HttpContext;
            var path = http.Request.Path.Value!;
            var publicPaths = new[] { "/health", "/api/auth/login", "/api/auth/register", "/api/auth/guest", "/api/auth/register-convert-guest" };
            if (publicPaths.Contains(path)) return await next(context);
            if (http.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
            Guid.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId);
            Guid.TryParse(http.User.FindFirstValue("guestSessionId"), out var guestId);
            var staff = userId == Guid.Empty ? null : await db.Users.FindAsync(userId);
            if (staff == null && !await db.GuestSessions.AnyAsync(g => g.Id == guestId && !g.IsConsumed && g.ExpiresAt > DateTime.UtcNow))
                return Results.Unauthorized();
            var role = staff?.Role ?? UserRole.Patient;
            bool Has(params UserRole[] roles) => roles.Contains(role);
            bool denied =
                (path.StartsWith("/api/reception/") && !Has(UserRole.Receptionist)) ||
                (path.StartsWith("/api/doctor/") && !Has(UserRole.Doctor)) ||
                (path.StartsWith("/api/services/") && !Has(UserRole.Doctor, UserRole.ServiceStaff)) ||
                (path.StartsWith("/api/settlement/") && !Has(UserRole.Cashier)) ||
                (path.StartsWith("/api/admin/") && !(http.Request.Method == "GET" &&
                    new[] { "/api/admin/departments", "/api/admin/services", "/api/admin/templates" }.Contains(path)) && !Has(UserRole.Administrator)) ||
                (path.StartsWith("/api/workspace/") && Has(UserRole.Patient)) ||
                (path == "/api/assistance" && http.Request.Method == "GET" && !Has(UserRole.Receptionist, UserRole.ServiceStaff, UserRole.Administrator)) ||
                (path.StartsWith("/api/assistance/") && !Has(UserRole.Receptionist, UserRole.ServiceStaff)) ||
                (path.Contains("supplement-question") && !Has(UserRole.Receptionist)) ||
                (path.Contains("/by-qr/") && !Has(UserRole.Receptionist)) ||
                (path.StartsWith("/api/content/") && !Has(UserRole.Patient)) ||
                (path.Contains("complete-pharmacy") && !Has(UserRole.Patient)) ||
                (path == "/api/registration/request" && !Has(UserRole.Patient));
            if (denied) return Results.Forbid();
            if (path.StartsWith("/api/appointments/") && http.Request.Method == "GET" && role != UserRole.Receptionist &&
                !await db.ExternalIdentities.AnyAsync(i => i.Patient.UserId == userId)) return Results.Forbid();

            Guid? visitId = null;
            if (Guid.TryParse(http.Request.RouteValues["visitId"]?.ToString(), out var routeVisit)) visitId = routeVisit;
            foreach (var arg in context.Arguments)
            {
                if (arg?.GetType().GetProperty("VisitId")?.GetValue(arg) is Guid id) visitId = id;
                if (arg is ConfirmReceptionDto confirm && staff != null && !AccessPolicy.InScope(staff, confirm.DepartmentId)) return Results.Forbid();
            }
            if (Guid.TryParse(http.Request.RouteValues["id"]?.ToString(), out var resourceId))
            {
                if (path.Contains("diagnosis/publish")) visitId = (await db.DiagnosisSummaries.FindAsync(resourceId))?.VisitId;
                if (path.StartsWith("/api/services/step")) visitId = await db.JourneySteps.Where(s => s.Id == resourceId).Select(s => (Guid?)s.Journey.VisitId).FirstOrDefaultAsync();
                if (path.StartsWith("/api/registration/request/"))
                {
                    var request = await db.RegistrationRequests.Include(r => r.Patient).FirstOrDefaultAsync(r => r.Id == resourceId);
                    if (request == null) return Results.NotFound();
                    if (role == UserRole.Receptionist)
                    {
                        if (!AccessPolicy.InScope(staff!, request.DepartmentId ?? Data.SeedData.DeptGeneral)) return Results.Forbid();
                    }
                    else if (request.Patient.UserId != userId && (request.GuestSessionId != guestId || guestId == Guid.Empty)) return Results.Forbid();
                }
            }
            if (path.Contains("/by-qr/") && staff != null)
            {
                var qr = http.Request.RouteValues["token"]?.ToString();
                var request = await db.RegistrationRequests.FirstOrDefaultAsync(r => r.ReceptionQrToken == qr);
                if (request != null && !AccessPolicy.InScope(staff, request.DepartmentId ?? Data.SeedData.DeptGeneral)) return Results.Forbid();
            }
            if (path.StartsWith("/api/assistance/") && staff != null)
            {
                var assistance = await db.AssistanceRequests.FindAsync(resourceId);
                if (assistance?.VisitId is Guid assistanceVisit) await AccessPolicy.CheckVisitAsync(db, assistanceVisit, userId, null);
                else if (role != UserRole.Receptionist || !AccessPolicy.InScope(staff, Data.SeedData.DeptGeneral)) return Results.Forbid();
            }
            if (visitId.HasValue) await AccessPolicy.CheckVisitAsync(db, visitId.Value, userId == Guid.Empty ? null : userId, guestId == Guid.Empty ? null : guestId);
            return await next(context);
        }
        catch (UnauthorizedAccessException ex) { return Results.Json(new { message = ex.Message }, statusCode: 403); }
        catch (KeyNotFoundException ex) { return Results.NotFound(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Results.BadRequest(new { message = ex.Message }); }
        catch (ArgumentException ex) { return Results.BadRequest(new { message = ex.Message }); }
    }
}
