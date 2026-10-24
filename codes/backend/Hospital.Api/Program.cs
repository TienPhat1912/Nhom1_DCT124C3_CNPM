using System.Threading.RateLimiting;
using Hospital.Api.Administration;
using Hospital.Api.Content;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Integrations;
using Hospital.Api.Journeys;
using Hospital.Api.Reception;
using Hospital.Api.Support;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<HospitalDb>(o => o.UseSqlServer(builder.Configuration.GetConnectionString("Hospital") ?? "Server=localhost,14339;Database=HospitalGuidance;Integrated Security=true;TrustServerCertificate=true"));
builder.Services.AddHttpContextAccessor();
builder.Services.AddDataProtection().SetApplicationName("HospitalGuidance");
builder.Services.AddScoped<Access>(); builder.Services.AddScoped<SessionIssuer>(); builder.Services.AddScoped<CommandBus>(); builder.Services.AddScoped<QrService>();
builder.Services.AddScoped<Workflow>(); builder.Services.AddScoped<JourneyReader>(); builder.Services.AddScoped<ContentReader>();
builder.Services.AddSingleton<SimulationAdapters>();
builder.Services.AddSingleton<IIdentityAdapter>(s => s.GetRequiredService<SimulationAdapters>());
builder.Services.AddSingleton<IAppointmentAdapter>(s => s.GetRequiredService<SimulationAdapters>());
builder.Services.AddSingleton<IOperationalAdapter>(s => s.GetRequiredService<SimulationAdapters>());
builder.Services.AddSingleton<ISettlementAdapter>(s => s.GetRequiredService<SimulationAdapters>());
builder.Services.AddSingleton<INarrationAdapter>(s => s.GetRequiredService<SimulationAdapters>());
builder.Services.AddOpenApi();
var webOrigins = new[] { builder.Configuration["Web:Origin"] ?? "http://localhost:5180" }
    .Concat(builder.Configuration.GetSection("Web:AdditionalOrigins").Get<string[]>() ?? [])
    .Distinct(StringComparer.Ordinal).ToArray();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(webOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", http => RateLimitPartition.GetSlidingWindowLimiter(http.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new SlidingWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 }));
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 128 * 1024);
var app = builder.Build();
app.Use(async (ctx, next) => {
    ctx.Response.Headers.CacheControl = "no-store"; ctx.Response.Headers["X-Content-Type-Options"] = "nosniff"; ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    try {
        if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method) && ctx.Request.Path.StartsWithSegments("/api")) {
            Check.That(ctx.Request.Headers["X-Hospital-Client"].ToString() == "1", "requestOrigin", "A supported application client is required.", 403);
            var origin = ctx.Request.Headers.Origin.ToString();
            Check.That(string.IsNullOrEmpty(origin) || webOrigins.Contains(origin, StringComparer.Ordinal), "requestOrigin", "Request origin is not permitted.", 403);
        }
        await next();
    }
    catch (ApiException ex) { ctx.Response.StatusCode = ex.Status; await ctx.Response.WriteAsJsonAsync(new { type = "about:blank", title = ex.Code, status = ex.Status, detail = ex.Message, errors = ex.Fields, traceId = ctx.TraceIdentifier }); }
    catch (DbUpdateConcurrencyException) { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { title = "conflict", status = 409, detail = "Record changed. Refresh and retry.", traceId = ctx.TraceIdentifier }); }
    catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: 2601 or 2627 }) { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { title = "duplicate", status = 409, detail = "A record with this unique identity already exists.", traceId = ctx.TraceIdentifier }); }
    catch (BadHttpRequestException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { title = "validation", status = 400, detail = "Invalid request data.", traceId = ctx.TraceIdentifier }); }
    catch (Exception ex) when (ex is not OperationCanceledException) {
        app.Logger.LogError("Request failure {Type}; trace {TraceId}", ex.GetType().Name, ctx.TraceIdentifier);
        ctx.Response.StatusCode = 500; await ctx.Response.WriteAsJsonAsync(new { title = "serverError", status = 500, detail = "The operation was not confirmed. Retry using the same event key.", traceId = ctx.TraceIdentifier });
    }
});
if (!app.Environment.IsDevelopment()) { app.UseHsts(); app.UseHttpsRedirection(); }
app.UseCors(); app.UseRateLimiter();
app.MapGet("/health", async (HospitalDb db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok", database = "SqlServer" }) : Results.StatusCode(503));
app.MapOpenApi();
app.MapIdentity(); app.MapReception(); app.MapJourneys(); app.MapContent(); app.MapSupport(); app.MapAdmin();
if (!args.Contains("--no-migrate")) {
    using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<HospitalDb>();
    await db.Database.MigrateAsync(); await Seed.Run(db, app.Configuration);
    await HospitalCatalog.Sync(db, app.Configuration);
    if (args.Contains("--seed-performance")) await PerformanceSeed.Run(db, app.Configuration);
}
if (!args.Contains("--migrate-only") && !args.Contains("--seed-performance")) app.Run();
public partial class Program;
