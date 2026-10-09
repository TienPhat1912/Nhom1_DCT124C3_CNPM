using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HospitalVisitApi.Data;
using HospitalVisitApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HospitalVisitApi.Services;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request);
    Task<AuthResult> RegisterPatientAsync(RegisterRequest request);
    Task<GuestAuthResult> CreateGuestSessionAsync(string? language);
    Task<AuthResult> ConvertGuestToAccountAsync(string guestToken, Guid targetUserId);
    Task<AuthResult> RegisterAndConvertGuestAsync(string guestToken, RegisterRequest registerRequest);
    Task<AuthResult?> RefreshSessionAsync(string token);
    Task<User?> GetUserByIdAsync(Guid userId);
    Task<GuestSession?> GetGuestSessionByTokenAsync(string token);
    string GenerateJwtToken(Guid userId, UserRole role, Guid? guestSessionId = null);
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password, string FullName, string? PhoneNumber, string Language = "vi");
public record ConvertGuestRequest(string GuestToken, string? ReturnTarget);
public record AuthResult(bool Success, string? Token, UserDto? User, string? Error);
public record GuestAuthResult(bool Success, string? Token, string? GuestToken, Guid? GuestSessionId, string? Error);
public record UserDto(Guid Id, string Email, string FullName, string Role, string PreferredLanguage, Guid? PatientId, string? PhoneNumber = null);

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email.Trim().ToLowerInvariant());
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return new AuthResult(false, null, null, "Invalid email or password");

        var patientId = await _db.Patients
            .Where(p => p.UserId == user.Id)
            .Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync();

        var token = GenerateJwtToken(user.Id, user.Role);
        var dto = new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.PreferredLanguage, patientId, user.PhoneNumber);
        return new AuthResult(true, token, dto, null);
    }

    public async Task<AuthResult> RegisterPatientAsync(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !System.Net.Mail.MailAddress.TryCreate(request.Email, out _) ||
            string.IsNullOrWhiteSpace(request.FullName) || request.FullName.Length > 100 ||
            string.IsNullOrEmpty(request.Password) || request.Password.Length < 8 || request.Password.Length > 72)
            return new AuthResult(false, null, null, "Valid email, name and password (8?72 characters) required");
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return new AuthResult(false, null, null, "Email already registered");

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber,
            Role = UserRole.Patient, // Self-registration can ONLY create Patient role (BR-01, PRD 5.1)
            PreferredLanguage = request.Language
        };
        _db.Users.Add(user);

        var patient = new Patient
        {
            UserId = user.Id,
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber,
            PreferredLanguage = request.Language
        };
        _db.Patients.Add(patient);

        await _db.SaveChangesAsync();

        var token = GenerateJwtToken(user.Id, user.Role);
        var dto = new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.PreferredLanguage, patient.Id, user.PhoneNumber);
        return new AuthResult(true, token, dto, null);
    }

    public async Task<GuestAuthResult> CreateGuestSessionAsync(string? language)
    {
        var guestToken = GenerateSecureToken();
        var session = new GuestSession
        {
            Token = guestToken,
            PreferredLanguage = language ?? "vi",
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };
        _db.GuestSessions.Add(session);
        await _db.SaveChangesAsync();

        var jwtToken = GenerateJwtToken(Guid.Empty, UserRole.Patient, session.Id);
        return new GuestAuthResult(true, jwtToken, guestToken, session.Id, null);
    }

    // === Guest to Account Conversion (UC-16, BR-13, BR-14, BR-15) ===
    public async Task<AuthResult> ConvertGuestToAccountAsync(string guestToken, Guid targetUserId)
    {
        var continuation = await _db.GuestConversionContexts.Include(c => c.GuestSession)
            .FirstOrDefaultAsync(c => c.ContinuationToken == guestToken && !c.IsConsumed && c.ExpiresAt > DateTime.UtcNow);
        var session = continuation?.GuestSession ?? await _db.GuestSessions.FirstOrDefaultAsync(g => g.Token == guestToken);
        if (session == null || session.ExpiresAt < DateTime.UtcNow)
            return new AuthResult(false, null, null, "Invalid or expired guest session");

        if (session.IsConsumed)
            return new AuthResult(false, null, null, "Guest session has already been linked to an account");

        var user = await _db.Users.FindAsync(targetUserId);
        if (user == null || user.Role != UserRole.Patient)
            return new AuthResult(false, null, null, "Target patient account not found");

        var userPatient = await _db.Patients.FirstOrDefaultAsync(p => p.UserId == user.Id);
        var guestPatient = await _db.Patients.FirstOrDefaultAsync(p => p.GuestSessionId == session.Id);

        using var tx = await _db.Database.BeginTransactionAsync();

        if (guestPatient != null)
        {
            if (userPatient != null && userPatient.Id != guestPatient.Id)
            {
                // Never merge an established identity without staff verification.
                bool hasRecords = await _db.Visits.AnyAsync(v => v.PatientId == userPatient.Id) ||
                    await _db.RegistrationRequests.AnyAsync(r => r.PatientId == userPatient.Id) ||
                    await _db.AssistanceRequests.AnyAsync(r => r.PatientId == userPatient.Id) ||
                    await _db.ExternalIdentities.AnyAsync(r => r.PatientId == userPatient.Id);
                if (hasRecords) return new AuthResult(false, null, null, "Identity conflict: reception verification required");
                _db.Patients.Remove(userPatient);
            }
            guestPatient.UserId = user.Id;
            guestPatient.GuestSessionId = null;
            guestPatient.UpdatedAt = DateTime.UtcNow;
            userPatient = guestPatient;
            foreach (var visit in await _db.Visits.Where(v => v.PatientId == guestPatient.Id).ToListAsync())
            {
                visit.UserId = user.Id;
                visit.GuestSessionId = null;
            }
            foreach (var request in await _db.RegistrationRequests.Where(r => r.PatientId == guestPatient.Id).ToListAsync())
                request.GuestSessionId = null;
            foreach (var notification in await _db.AppNotifications.Where(n => n.GuestSessionId == session.Id).ToListAsync())
            {
                notification.UserId = user.Id;
                notification.GuestSessionId = null;
            }
        }

        // Mark guest session consumed and linked
        session.IsConsumed = true;
        session.LinkedUserId = user.Id;
        if (continuation != null) continuation.IsConsumed = true;

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        var token = GenerateJwtToken(user.Id, user.Role);
        var dto = new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.PreferredLanguage, userPatient?.Id, user.PhoneNumber);
        return new AuthResult(true, token, dto, null);
    }

    public async Task<AuthResult> RegisterAndConvertGuestAsync(string guestToken, RegisterRequest registerRequest)
    {
        if (await GetGuestSessionByTokenAsync(guestToken) == null)
            return new AuthResult(false, null, null, "Invalid, expired or consumed guest claim");
        var regResult = await RegisterPatientAsync(registerRequest);
        if (!regResult.Success || regResult.User == null)
            return regResult;

        return await ConvertGuestToAccountAsync(guestToken, regResult.User.Id);
    }

    public async Task<AuthResult?> RefreshSessionAsync(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var key = Encoding.UTF8.GetBytes(_config["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt secret is not configured"));
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false
            }, out _);

            var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId) && userId != Guid.Empty)
            {
                var user = await _db.Users.FindAsync(userId);
                if (user == null) return null;

                var patientId = await _db.Patients
                    .Where(p => p.UserId == user.Id)
                    .Select(p => (Guid?)p.Id)
                    .FirstOrDefaultAsync();

                var newToken = GenerateJwtToken(user.Id, user.Role);
                var dto = new UserDto(user.Id, user.Email, user.FullName, user.Role.ToString(), user.PreferredLanguage, patientId, user.PhoneNumber);
                return new AuthResult(true, newToken, dto, null);
            }
        }
        catch
        {
            return null;
        }
        return null;
    }

    public async Task<User?> GetUserByIdAsync(Guid userId) =>
        await _db.Users.FindAsync(userId);

    public async Task<GuestSession?> GetGuestSessionByTokenAsync(string token)
    {
        var session = await _db.GuestSessions.FirstOrDefaultAsync(g => g.Token == token && g.ExpiresAt > DateTime.UtcNow && !g.IsConsumed);
        if (session != null) return session;
        return await _db.GuestConversionContexts.Where(c => c.ContinuationToken == token && !c.IsConsumed && c.ExpiresAt > DateTime.UtcNow &&
            !c.GuestSession.IsConsumed && c.GuestSession.ExpiresAt > DateTime.UtcNow).Select(c => c.GuestSession).FirstOrDefaultAsync();
    }

    public string GenerateJwtToken(Guid userId, UserRole role, Guid? guestSessionId = null)
    {
        var key = Encoding.UTF8.GetBytes(_config["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt secret is not configured"));
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Role, role.ToString()),
            new("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString())
        };

        if (guestSessionId.HasValue)
            claims.Add(new Claim("guestSessionId", guestSessionId.Value.ToString()));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(24),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var handler = new JwtSecurityTokenHandler();
        var secToken = handler.CreateToken(tokenDescriptor);
        return handler.WriteToken(secToken);
    }

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }
}
