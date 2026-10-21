using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Identity;

public class Access(HospitalDb db, IHttpContextAccessor context)
{
    Session? cached;
    public async Task<Session> Current()
    {
        if (cached is not null) return cached;
        var http = context.HttpContext!;
        var bearer = http.Request.Headers.Authorization.ToString();
        var token = bearer.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? bearer[7..] : http.Request.Cookies["hospital_session"];
        if (string.IsNullOrEmpty(token)) throw new ApiException(401, "sessionRequired", "Sign in or continue as guest.");
        var hash = Crypto.Hash(token);
        var session = await db.Sessions.Include(s => s.UserAccount).ThenInclude(u => u!.Scopes).SingleOrDefaultAsync(s => s.TokenHash == hash);
        if (session is null || session.Revoked || session.ExpiresAt <= DateTime.UtcNow || session.UserAccount is { Active: false })
            throw new ApiException(401, "sessionExpired", "Access expired. Sign in or request verified recovery.");
        return cached = session;
    }
    public async Task<Session> Patient()
    {
        var s = await Current();
        Check.That(s.PatientId is not null && (s.IsGuest || s.UserAccount?.Role == "Patient"), "forbidden", "Patient access required.", 403);
        return s;
    }
    public async Task<UserAccount> Staff(params string[] roles)
    {
        var s = await Current();
        Check.That(s.UserAccount is not null && roles.Contains(s.UserAccount.Role), "forbidden", "This action is not permitted for your role.", 403);
        return s.UserAccount!;
    }
    public static void Scope(UserAccount u, Guid departmentId) => Check.That(u.Scopes.Any(s => s.DepartmentId == departmentId), "outOfScope", "This department is outside your assignment.", 403);
    public async Task<Visit> Visit(Guid id, bool content = false)
    {
        var s = await Current();
        var v = await db.FullVisits().SingleOrDefaultAsync(v => v.Id == id) ?? throw new ApiException(404, "notFound", "Record not found.");
        if (s.PatientId is not null)
        {
            Check.That(v.PatientId == s.PatientId, "forbidden", "You do not have access to this record.", 403);
            if (s.IsGuest) Check.That(await db.Set<AccessGrant>().AnyAsync(g => g.SessionId == s.Id && g.VisitId == id && g.ExpiresAt > DateTime.UtcNow), "forbidden", "Verified guest access required.", 403);
        }
        else
        {
            var u = s.UserAccount!;
            Check.That(u.Role != "Admin", "forbidden", "Clinical records are not part of administrator access.", 403);
            if (content) Check.That(u.Role == "Doctor" && v.DoctorId == u.Id, "forbidden", "Only the responsible doctor can access clinical drafts.", 403);
            if (u.Role == "Doctor") Check.That(v.DoctorId == u.Id, "outOfScope", "This Visit is not assigned to you.", 403);
            if (u.Role == "Service") Check.That(v.Journey.Steps.Any(st => st.Authority == "Service" && u.Scopes.Any(sc => sc.DepartmentId == st.DepartmentId)), "outOfScope", "No assigned service in this Visit.", 403);
            else Scope(u, v.DepartmentId);
        }
        return v;
    }
    public async Task<RegistrationRequest> Request(Guid id)
    {
        var s = await Current();
        var r = await db.Requests.Include(r => r.Patient).Include(r => r.Appointment).Include(r => r.Messages).SingleOrDefaultAsync(r => r.Id == id)
            ?? throw new ApiException(404, "notFound", "Request not found.");
        if (s.PatientId is not null)
            Check.That(r.PatientId == s.PatientId && (!s.IsGuest || r.SessionId == s.Id), "forbidden", "You do not have access to this request.", 403);
        else Scope(await Staff("Reception"), r.DepartmentId);
        return r;
    }
    public async Task<Visit> DoctorVisit(Guid id)
    {
        await Staff("Doctor");
        return await Visit(id, true);
    }
}
