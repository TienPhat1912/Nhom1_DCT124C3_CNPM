using System.Security.Claims;
using System.Text;
using HospitalVisitApi.Data;
using HospitalVisitApi.Models;
using HospitalVisitApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// === 1. Configuration & Database ===
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=hospital_visit.db";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

// === 2. Application Services ===
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IVisitService, VisitService>();

// === 3. Authentication & Authorization ===
var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
    throw new InvalidOperationException("Set Jwt__Secret to at least 32 characters in the server environment");
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

// === 4. CORS for Frontend Demo ===
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins((builder.Configuration["Cors:Origins"] ?? "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5174").Split(','))
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// === 5. Database Initialization & Seeding ===
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // EnsureCreated sets up schema from models with all tables and constraints
    await SchemaBootstrap.InitializeAsync(db);
    if (app.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("SeedDemo")) await SeedData.SeedAsync(db);
}

// === 6. Middleware Pipeline ===
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
// SQLite demo runs one API instance. Serialize mutations; DB unique constraints remain authoritative.
var mutations = new SemaphoreSlim(1, 1);
app.Use(async (context, next) =>
{
    var write = context.Request.Method is "POST" or "PUT" or "DELETE";
    if (write) await mutations.WaitAsync(context.RequestAborted);
    try { await next(context); }
    finally { if (write) mutations.Release(); }
});
var apiRoot = app.MapGroup("").AddEndpointFilter<AccessFilter>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Helper to extract caller identities
static (Guid? userId, UserRole? role, Guid? guestSessionId) GetCaller(ClaimsPrincipal user)
{
    Guid? userId = null;
    UserRole? role = null;
    Guid? guestId = null;

    var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (Guid.TryParse(idClaim, out var uid) && uid != Guid.Empty)
        userId = uid;

    var roleClaim = user.FindFirst(ClaimTypes.Role)?.Value;
    if (Enum.TryParse<UserRole>(roleClaim, out var r))
        role = r;

    var guestClaim = user.FindFirst("guestSessionId")?.Value;
    if (Guid.TryParse(guestClaim, out var gid))
        guestId = gid;

    return (userId, role, guestId);
}

// === 7. Health Check ===
apiRoot.MapGet("/health", async (AppDbContext db) => await db.Database.CanConnectAsync() ? Results.Ok(new
{
    status = "Healthy",
    service = "HospitalVisitApi",
    version = "1.0.0",
    timestamp = DateTime.UtcNow
}) : Results.StatusCode(503));

// === 8. Auth & Session Endpoints ===
apiRoot.MapPost("/api/auth/login", async (LoginRequest req, IAuthService auth) =>
{
    var res = await auth.LoginAsync(req);
    return res.Success ? Results.Ok(res) : Results.BadRequest(res);
});

apiRoot.MapPost("/api/auth/register", async (RegisterRequest req, IAuthService auth) =>
{
    var res = await auth.RegisterPatientAsync(req);
    return res.Success ? Results.Ok(res) : Results.BadRequest(res);
});

apiRoot.MapPost("/api/auth/guest", async (GuestSessionRequest? req, IAuthService auth) =>
{
    var res = await auth.CreateGuestSessionAsync(req?.Language);
    return res.Success ? Results.Ok(res) : Results.BadRequest(res);
});

apiRoot.MapPost("/api/auth/convert-guest", async (ConvertGuestDto req, ClaimsPrincipal user, IAuthService auth) =>
{
    var (callerId, _, _) = GetCaller(user);
    if (!callerId.HasValue) return Results.Unauthorized();

    var res = await auth.ConvertGuestToAccountAsync(req.GuestToken, callerId.Value);
    return res.Success ? Results.Ok(res) : Results.BadRequest(res);
});

apiRoot.MapPost("/api/auth/register-convert-guest", async (RegisterAndConvertDto req, IAuthService auth) =>
{
    var res = await auth.RegisterAndConvertGuestAsync(req.GuestToken, req.Register);
    return res.Success ? Results.Ok(res) : Results.BadRequest(res);
});

apiRoot.MapGet("/api/auth/me", async (ClaimsPrincipal user, IAuthService auth, AppDbContext db) =>
{
    var (userId, role, guestId) = GetCaller(user);
    if (userId.HasValue)
    {
        var u = await auth.GetUserByIdAsync(userId.Value);
        if (u == null) return Results.NotFound();
        var patient = await db.Patients.FirstOrDefaultAsync(p => p.UserId == u.Id);
        return Results.Ok(new UserDto(u.Id, u.Email, u.FullName, u.Role.ToString(), u.PreferredLanguage, patient?.Id, u.PhoneNumber));
    }
    if (guestId.HasValue)
    {
        var g = await db.GuestSessions.FindAsync(guestId.Value);
        if (g == null) return Results.NotFound();
        var patient = await db.Patients.FirstOrDefaultAsync(p => p.GuestSessionId == g.Id);
        return Results.Ok(new
        {
            isGuest = true,
            guestSessionId = g.Id,
            preferredLanguage = g.PreferredLanguage,
            patientId = patient?.Id,
            fullName = patient?.FullName ?? "Guest Patient"
        });
    }
    return Results.Unauthorized();
});

// === 9. External Appointment Adapter (Simulated Source) ===
apiRoot.MapGet("/api/appointments/{id}", async (string id, IVisitService visitService) =>
{
    var apt = await visitService.LookupAppointmentAsync(id);
    return apt != null ? Results.Ok(apt) : Results.NotFound(new { message = "Appointment not found in hospital booking system" });
});

// === 10. Registration Requests (Walk-in & Booked, BR-02) ===
apiRoot.MapPost("/api/registration/request", async (CreateRegistrationRequestDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    var res = await visitService.CreateRegistrationRequestAsync(dto, userId, guestId);
    return Results.Ok(res);
});

apiRoot.MapGet("/api/registration/request/{id:guid}", async (Guid id, IVisitService visitService) =>
{
    var req = await visitService.GetRegistrationRequestByIdAsync(id);
    return req != null ? Results.Ok(req) : Results.NotFound();
});

apiRoot.MapGet("/api/registration/request/by-qr/{token}", async (string token, IVisitService visitService) =>
{
    var req = await visitService.GetRegistrationRequestByQrAsync(token);
    return req != null ? Results.Ok(req) : Results.NotFound(new { message = "Invalid reception QR token" });
});

apiRoot.MapPost("/api/registration/request/{id:guid}/supplement-question", async (Guid id, SupplementQuestionDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (staffId, _, _) = GetCaller(user);
    var ok = await visitService.RequestSupplementAsync(id, dto.Question, staffId!.Value);
    return ok ? Results.Ok(new { success = true }) : Results.BadRequest(new { message = "Cannot request supplement for this registration" });
});

apiRoot.MapPost("/api/registration/request/{id:guid}/supplement-answer", async (Guid id, SupplementAnswerDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    var ok = await visitService.ProvideSupplementAsync(id, dto.Answer, userId, guestId);
    return ok ? Results.Ok(new { success = true }) : Results.BadRequest(new { message = "Cannot provide supplement" });
});

// === 11. Reception Confirmation & Ticket Issuance (BR-02, BR-03) ===
apiRoot.MapPost("/api/reception/confirm", async (ConfirmReceptionDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (staffId, _, _) = GetCaller(user);
    try
    {
        var res = await visitService.ConfirmReceptionAsync(dto, staffId!.Value);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

apiRoot.MapGet("/api/reception/reprint/{visitId:guid}", async (Guid visitId, IVisitService visitService) =>
{
    try
    {
        var ticket = await visitService.GetTicketForReprintAsync(visitId);
        return Results.Ok(ticket);
    }
    catch (Exception ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
});

// === 12. Ticket QR Redemption & Journey (BR-02, BR-16) ===
apiRoot.MapPost("/api/journey/redeem-ticket", async (RedeemTicketDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    try
    {
        var res = await visitService.RedeemTicketQrAsync(dto.QrToken, userId, guestId);
        return Results.Ok(res);
    }
    catch (UnauthorizedAccessException ex)
    {
        return Results.Json(new { message = ex.Message }, statusCode: 403);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

apiRoot.MapGet("/api/journey/{visitId:guid}", async (Guid visitId, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    try
    {
        var res = await visitService.GetCurrentJourneyAsync(visitId, userId, guestId);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
});

apiRoot.MapPost("/api/journey/{visitId:guid}/complete-pharmacy", async (Guid visitId, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    try
    {
        var ok = await visitService.CompletePharmacyGuidanceAsync(visitId, userId, guestId);
        return ok ? Results.Ok(new { success = true, message = "Pharmacy guidance completed" }) : Results.BadRequest();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

// === 13. Doctor Workspace (UC-07, BR-06, BR-25, UC-20) ===
apiRoot.MapGet("/api/doctor/visits", async (ClaimsPrincipal user, IVisitService visitService) =>
{
    var (doctorId, _, _) = GetCaller(user);
    var list = await visitService.GetVisitsForStaffAsync(UserRole.Doctor, doctorId!.Value, null);
    return Results.Ok(list);
});

apiRoot.MapGet("/api/doctor/orders/{visitId:guid}", async (Guid visitId, IVisitService visitService) =>
{
    var list = await visitService.GetDoctorOrdersForVisitAsync(visitId);
    return Results.Ok(list);
});

apiRoot.MapPost("/api/doctor/orders", async (CreateDoctorOrderDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (doctorId, _, _) = GetCaller(user);
    try
    {
        var res = await visitService.CreateDoctorOrderAsync(dto, doctorId!.Value);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

apiRoot.MapPost("/api/doctor/diagnosis/draft", async (SaveDiagnosisDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (doctorId, _, _) = GetCaller(user);
    try
    {
        var diag = await visitService.SaveDiagnosisDraftAsync(dto, doctorId!.Value);
        return Results.Ok(diag);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

apiRoot.MapPost("/api/doctor/diagnosis/publish/{id:guid}", async (Guid id, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (doctorId, _, _) = GetCaller(user);
    try
    {
        var published = await visitService.PublishDiagnosisAsync(id, doctorId!.Value);
        return Results.Ok(published);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

apiRoot.MapGet("/api/doctor/diagnosis/{visitId:guid}", async (Guid visitId, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (doctorId, _, _) = GetCaller(user);
    var diag = await visitService.GetDiagnosisForDoctorAsync(visitId, doctorId!.Value);
    return diag != null ? Results.Ok(diag) : Results.NotFound();
});

apiRoot.MapPost("/api/doctor/follow-up", async (SaveFollowUpDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (doctorId, _, _) = GetCaller(user);
    var fup = await visitService.SaveFollowUpAsync(dto, doctorId!.Value);
    return Results.Ok(fup);
});

apiRoot.MapGet("/api/doctor/follow-up/{visitId:guid}", async (Guid visitId, IVisitService visitService) =>
{
    var fup = await visitService.GetFollowUpForVisitAsync(visitId);
    return fup != null ? Results.Ok(fup) : Results.NotFound();
});

// === 14. Service Staff Workspace (UC-17) ===
apiRoot.MapPost("/api/services/step/{id:guid}/status", async (Guid id, UpdateStepStatusDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (staffId, _, _) = GetCaller(user);
    var ok = await visitService.UpdateStepStatusAsync(id, dto.Status, staffId!.Value, dto.Reason);
    return ok ? Results.Ok(new { success = true }) : Results.BadRequest(new { message = "Failed to update step status" });
});

// === 15. Cashier Settlement Workspace (UC-18, BR-10, BR-17) ===
apiRoot.MapPost("/api/settlement/record", async (RecordSettlementDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (cashierId, _, _) = GetCaller(user);
    try
    {
        var res = await visitService.RecordSettlementAsync(dto, cashierId!.Value);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

// === 16. Patient Content & Narration (BR-21, BR-22, UC-21) ===
apiRoot.MapGet("/api/content/diagnosis/{visitId:guid}", async (Guid visitId, string? lang, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    var diag = await visitService.GetPublishedDiagnosisForPatientAsync(visitId, userId, guestId, lang ?? "vi");
    return diag != null ? Results.Ok(diag) : Results.NotFound(new { message = "No published diagnosis available for this visit" });
});

// The server never substitutes a tone for speech. Clients narrate this exact authorized text.
apiRoot.MapGet("/api/content/audio/{diagnosisId:guid}", async (Guid diagnosisId, string? lang, string? section, ClaimsPrincipal user, AppDbContext db, IVisitService service) =>
{
    var diagnosis = await db.DiagnosisSummaries.FindAsync(diagnosisId);
    if (diagnosis == null) return Results.NotFound();
    var (userId, _, guestId) = GetCaller(user);
    var current = await service.GetPublishedDiagnosisForPatientAsync(diagnosis.VisitId, userId, guestId, lang ?? "vi");
    if (current == null || current.Id != diagnosisId) return Results.Conflict(new { message = "Narration version is no longer current" });
    if (section is not ("diagnosis" or "care")) return Results.BadRequest(new { message = "Select diagnosis or care section" });
    return Results.Ok(new { current.Id, current.Version, current.Language, section,
        text = section == "care" ? current.CareInstructions : string.Join(". ", new[] { current.Diagnosis, current.Explanation }.Where(t => !string.IsNullOrWhiteSpace(t))),
        provider = "device-speech", audioAvailable = false });
});

// === 17. Assistance & Notifications (UC-09, FR-AST) ===
apiRoot.MapPost("/api/assistance", async (CreateAssistanceDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    var req = await visitService.CreateAssistanceRequestAsync(dto, userId, guestId);
    return Results.Ok(req);
});

apiRoot.MapGet("/api/assistance", async (ClaimsPrincipal user, IVisitService visitService, AppDbContext db) =>
{
    var list = await visitService.GetAssistanceRequestsAsync((await db.Users.FindAsync(GetCaller(user).userId))?.StaffScope);
    return Results.Ok(list);
});

apiRoot.MapPut("/api/assistance/{id:guid}/status", async (Guid id, UpdateAssistanceStatusDto dto, ClaimsPrincipal user, IVisitService visitService) =>
{
    var (staffId, _, _) = GetCaller(user);
    var ok = await visitService.UpdateAssistanceStatusAsync(id, dto.Status, dto.Resolution, staffId!.Value);
    return ok ? Results.Ok(new { success = true }) : Results.BadRequest();
});

apiRoot.MapGet("/api/notifications", async (ClaimsPrincipal user, IVisitService visitService) =>
{
    var (userId, _, guestId) = GetCaller(user);
    var list = await visitService.GetNotificationsAsync(userId, guestId);
    return Results.Ok(list);
});

// === 18. Admin & Workspace Configurations ===
apiRoot.MapGet("/api/admin/departments", async (IVisitService visitService) => Results.Ok(await visitService.GetDepartmentsAsync()));
apiRoot.MapGet("/api/admin/services", async (IVisitService visitService) => Results.Ok(await visitService.GetServicesAsync()));
apiRoot.MapGet("/api/admin/mappings", async (IVisitService visitService) => Results.Ok(await visitService.GetMappingsAsync()));
apiRoot.MapPost("/api/admin/mappings", async (ServiceStepMapping mapping, IVisitService visitService) => Results.Ok(await visitService.SaveMappingAsync(mapping)));
apiRoot.MapGet("/api/admin/templates", async (IVisitService visitService) => Results.Ok(await visitService.GetTemplatesAsync()));
apiRoot.MapGet("/api/admin/visits", async (IVisitService visitService) => Results.Ok(await visitService.GetVisitsForStaffAsync(UserRole.Administrator, Guid.Empty, null)));

apiRoot.MapGet("/api/workspace/visits", async (ClaimsPrincipal user, AppDbContext db, IVisitService service) =>
{
    var (userId, _, _) = GetCaller(user);
    var staff = await db.Users.FindAsync(userId!.Value);
    return Results.Ok(await service.GetVisitsForStaffAsync(staff!.Role, staff.Id, staff.StaffScope));
});
apiRoot.MapGet("/api/patient/visits", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var (userId, _, guestId) = GetCaller(user);
    var visits = await db.Visits.Where(v => (userId.HasValue && v.UserId == userId) ||
        (guestId.HasValue && !v.UserId.HasValue && v.GuestSessionId == guestId))
        .OrderByDescending(v => v.CreatedAt).Select(v => new { visitId = v.Id, v.TicketNumber, v.Status,
            journeyStatus = v.Journey!.Status, v.CreatedAt, departmentVi = v.Department.NameVi, departmentEn = v.Department.NameEn }).ToListAsync();
    return Results.Ok(visits);
});
apiRoot.MapGet("/api/patient/follow-up/{visitId:guid}", async (Guid visitId, IVisitService service) =>
    Results.Ok(await service.GetFollowUpForVisitAsync(visitId)));

apiRoot.MapAdditionalEndpoints();

app.Run();

// === Helper Record Types ===
public record GuestSessionRequest(string? Language);
public record ConvertGuestDto(string GuestToken, string? ReturnTarget);
public record RegisterAndConvertDto(string GuestToken, RegisterRequest Register);
public record SupplementQuestionDto(string Question);
public record SupplementAnswerDto(string Answer);
public record RedeemTicketDto(string QrToken);
public record UpdateStepStatusDto(StepStatus Status, string? Reason);
public record UpdateAssistanceStatusDto(AssistanceStatus Status, string? Resolution);
