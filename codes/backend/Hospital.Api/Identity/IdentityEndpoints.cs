using System.Net.Mail;
using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Identity;

public record Credentials(string Email, string Password, string Language = "vi");
public record Registration(string Email, string Password, string Name, string Contact, string Language = "vi");
public record GuestInput(string Language = "vi");
public record ProfileInput(string Name, string Contact, string Language, int Version);
public record ClaimInput(Guid? ReturnVisitId);
public record ConvertInput(string Claim, string Email, string Password, bool Register);
public record RecoveryInput(string Code);
public record SessionView(Guid SessionId, Guid? PatientId, string Role, string Name, string Language, bool IsGuest, DateTime ExpiresAt, string? Token);

public class SessionIssuer(HospitalDb db, IConfiguration config, IHttpContextAccessor accessor)
{
    public async Task<SessionView> Issue(Patient? patient, UserAccount? user, bool guest)
    {
        var token = Crypto.Token();
        var session = new Session { PatientId = patient?.Id, UserAccountId = user?.Id, IsGuest = guest,
            TokenHash = Crypto.Hash(token), ExpiresAt = DateTime.UtcNow.AddHours(config.GetValue<int>(guest ? "Access:GuestHours" : "Access:AccountHours")) };
        db.Add(session);
        await db.SaveChangesAsync();
        var http = accessor.HttpContext!;
        http.Response.OnStarting(() => {
            // A failed conversion must not overwrite the still-valid guest cookie.
            if (http.Items["CommandCommitted"] is true && http.Response.StatusCode < 400)
                http.Response.Cookies.Append("hospital_session", token, new CookieOptions { HttpOnly = true, Secure = http.Request.IsHttps || config.GetValue<bool>("Web:SecureCookies"),
                    SameSite = SameSiteMode.Strict, Expires = session.ExpiresAt, Path = "/" });
            return Task.CompletedTask;
        });
        return new(session.Id, patient?.Id, guest ? "Patient" : user!.Role, patient?.Name ?? user?.Name ?? "", patient?.Language ?? "vi", guest,
            session.ExpiresAt, http.Request.Headers["X-Client"] == "native" ? token : null);
    }
}
public static class IdentityEndpoints
{
    public static void MapIdentity(this WebApplication app)
    {
        var g = app.MapGroup("/api/auth").WithTags("Identity").RequireRateLimiting("auth");
        g.MapGet("/session", async (Access access, HospitalDb db) => {
            var s = await access.Current();
            var p = s.PatientId is {} id ? await db.Patients.FindAsync(id) : null;
            return new SessionView(s.Id, p?.Id, s.IsGuest ? "Patient" : s.UserAccount!.Role, p?.Name ?? s.UserAccount?.Name ?? "", p?.Language ?? "vi", s.IsGuest, s.ExpiresAt, null);
        });
        g.MapPost("/guest", (GuestInput input, HospitalDb db, SessionIssuer issuer, CommandBus bus) =>
            bus.Run("auth:guest", input, async () => {
                var p = new Patient { Language = Check.Language(input.Language) }; db.Add(p);
                return await issuer.Issue(p, null, true);
            }, false));
        g.MapPost("/register", (Registration input, HospitalDb db, SessionIssuer issuer, CommandBus bus) =>
            bus.Run("auth:register", input, async () => {
                var email = Email(input.Email); Password(input.Password);
                Check.That(!await db.Users.AnyAsync(u => u.Email == email), "accountExists", "This account already exists. Sign in instead.", 409);
                var p = new Patient { Name = Check.Text(input.Name, "name", 2, 120), Contact = Check.Text(input.Contact, "contact", 5, 80), Language = Check.Language(input.Language) };
                var u = new UserAccount { Email = email, PatientId = p.Id, Name = p.Name };
                u.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(u, input.Password);
                db.AddRange(p, u);
                return await issuer.Issue(p, u, false);
            }, false));
        g.MapPost("/login", (Credentials input, HospitalDb db, SessionIssuer issuer, CommandBus bus) =>
            bus.Run("auth:login", input, async () => {
                var user = await Authenticate(db, input.Email, input.Password);
                var p = user.PatientId is {} id ? await db.Patients.FindAsync(id) : null;
                if (p is not null) p.Language = Check.Language(input.Language);
                return await issuer.Issue(p, user, false);
            }, false));
        g.MapPost("/logout", async (Access access, HospitalDb db, HttpContext http) => {
            var s = await access.Current(); s.Revoked = true; await db.SaveChangesAsync();
            http.Response.Cookies.Delete("hospital_session"); return new { ok = true };
        });
        g.MapGet("/profile", async (Access access, HospitalDb db) => {
            var s = await access.Patient(); return await db.Patients.SingleAsync(p => p.Id == s.PatientId);
        });
        g.MapPut("/profile", async (ProfileInput input, Access access, HospitalDb db, CommandBus bus) => {
            var s = await access.Patient();
            return await bus.Run($"{s.Id}:profile", input, async () => {
                var p = await db.Patients.SingleAsync(p => p.Id == s.PatientId); Check.Version(p, input.Version);
                p.Name = Check.Text(input.Name, "name", 2, 120); p.Contact = Check.Text(input.Contact, "contact", 5, 80); p.Language = Check.Language(input.Language);
                return new { p.Id };
            });
        });
        g.MapPost("/link-claim", async (ClaimInput input, Access access, HospitalDb db, CommandBus bus) => {
            var s = await access.Patient(); Check.That(s.IsGuest, "guestRequired", "Guest context required.");
            return await bus.Run($"{s.Id}:claim", input, async () => {
                if (input.ReturnVisitId is {} v) await access.Visit(v);
                var token = Crypto.Token(); db.Add(new LinkClaim { SessionId = s.Id, Hash = Crypto.Hash(token), ExpiresAt = DateTime.UtcNow.AddMinutes(15), ReturnVisitId = input.ReturnVisitId });
                return new { claim = token, input.ReturnVisitId };
            }, false);
        });
        g.MapPost("/convert", async (ConvertInput input, Access access, HospitalDb db, CommandBus bus, SessionIssuer issuer) => {
            var guest = await access.Patient(); Check.That(guest.IsGuest, "guestRequired", "Guest context required.");
            return await bus.Run($"{guest.Id}:convert", input, async () => {
                var hash = Crypto.Hash(input.Claim);
                var claim = await db.Set<LinkClaim>().SingleOrDefaultAsync(c => c.SessionId == guest.Id && c.Hash == hash);
                Check.That(claim is not null && !claim.Consumed && claim.ExpiresAt > DateTime.UtcNow, "claimInvalid", "This link claim is invalid or expired.", 403);
                var patient = await db.Patients.SingleAsync(p => p.Id == guest.PatientId);
                var email = Email(input.Email); UserAccount user;
                if (input.Register)
                {
                    Password(input.Password);
                    Check.That(!await db.Users.AnyAsync(u => u.Email == email), "accountExists", "Account exists. Choose sign in to link.", 409);
                    Check.Text(patient.Name, "name", 2, 120); Check.Text(patient.Contact, "contact", 5, 80);
                    user = new UserAccount { Email = email, PatientId = patient.Id, Name = patient.Name };
                    user.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(user, input.Password); db.Add(user);
                }
                else
                {
                    user = await Authenticate(db, email, input.Password);
                    Check.That(user.Role == "Patient", "identityConflict", "Only a patient account can receive guest access.", 409);
                    if (user.PatientId != patient.Id)
                    {
                        var oldId = user.PatientId;
                        Check.That(!await db.Visits.AnyAsync(v => v.PatientId == oldId) && !await db.Requests.AnyAsync(r => r.PatientId == oldId)
                            && !await db.Set<ExternalIdentity>().AnyAsync(e => e.PatientId == oldId), "identityConflict", "This account already owns another patient record. Reception verification is required.", 409);
                        user.PatientId = patient.Id;
                        foreach (var oldSession in await db.Sessions.Where(s => s.UserAccountId == user.Id).ToListAsync()) oldSession.Revoked = true;
                    }
                }
                claim!.Consumed = true;
                foreach (var old in await db.Sessions.Where(s => s.IsGuest && s.PatientId == patient.Id).ToListAsync()) old.Revoked = true;
                bus.Audit(user.Id, "GuestLinked", claim.ReturnVisitId, "Stable patient identity retained", "Identity");
                var session = await issuer.Issue(patient, user, false);
                return new { session, claim.ReturnVisitId };
            }, false);
        });
        g.MapPost("/recover", (RecoveryInput input, HospitalDb db, CommandBus bus, SessionIssuer issuer) =>
            bus.Run("auth:recovery", input, async () => {
                var hash = Crypto.Hash(input.Code);
                var claim = await db.Set<RecoveryClaim>().SingleOrDefaultAsync(c => c.Hash == hash);
                Check.That(claim is not null && !claim.Consumed && claim.ExpiresAt > DateTime.UtcNow, "claimInvalid", "Recovery code invalid or expired.", 403);
                var p = await db.Patients.SingleAsync(p => p.Id == claim!.PatientId);
                Check.That(!await db.Users.AnyAsync(u => u.PatientId == p.Id), "signInRequired", "This patient already has an account. Sign in.", 409);
                claim!.Consumed = true;
                var result = await issuer.Issue(p, null, true);
                db.Add(new AccessGrant { SessionId = result.SessionId, VisitId = claim.VisitId, ExpiresAt = result.ExpiresAt });
                return new { session = result, visitId = claim.VisitId };
            }, false));
    }
    public static string Email(string value)
    {
        value = Check.Text(value, "email", 5, 254).ToLowerInvariant();
        Check.That(MailAddress.TryCreate(value, out var address) && address.Address == value, "validation", "Invalid email address."); return value;
    }
    static void Password(string value) => Check.That(value?.Length is >= 12 and <= 128 && value.Any(char.IsLetter) && value.Any(char.IsDigit), "passwordPolicy", "Use 12–128 characters including a letter and a number.");
    static async Task<UserAccount> Authenticate(HospitalDb db, string email, string password)
    {
        Check.Text(password, "password", 1, 128);
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == Email(email));
        Check.That(user is { Active: true } && !string.IsNullOrEmpty(user.PasswordHash) && new PasswordHasher<UserAccount>().VerifyHashedPassword(user, user.PasswordHash, password) != PasswordVerificationResult.Failed,
            "invalidCredentials", "Email or password is incorrect.", 401);
        return user!;
    }
}
