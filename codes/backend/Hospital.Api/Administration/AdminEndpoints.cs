using Hospital.Api.Content;
using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Hospital.Api.Journeys;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Administration;
public record DepartmentInput(Guid? Id, int Version, string Code, string NameVi, bool Active);
public record LocationInput(Guid? Id, int Version, Guid DepartmentId, string NameVi, string Building, string Floor, string Room, bool Active);
public record ServiceInput(Guid? Id, int Version, string Code, string NameVi, Guid DepartmentId, Guid LocationId, bool Active, bool ReturnRequired);
public record MappingInput(Guid ServiceId, MappingNode[] Steps, bool Publish);
public record TemplateInput(string Key, string Language, string Text, string Category, bool Publish);
public record RouteInput(Guid? Id, int Version, Guid FromLocationId, Guid ToLocationId, string Language, string Instructions, bool Active);
public record StaffInput(Guid? Id, int Version, string Email, string Name, string Role, Guid[] DepartmentIds, bool Active, string? Password);
public static class AdminEndpoints
{
    public static void MapAdmin(this WebApplication app)
    {
        app.MapGet("/api/staff/profile", async (Access access, HospitalDb db) => {
            var u = await access.Staff("Admin", "Doctor", "Reception", "Service", "Cashier");
            var ids = u.Scopes.Select(s => s.DepartmentId).ToArray();
            var clinicIds = HospitalCatalog.Clinician(u.Id)?.ClinicIds ?? [];
            return new { u.Id, u.Name, u.Role,
                departments = await db.Set<Department>().Where(d => ids.Contains(d.Id)).ToListAsync(),
                specialties = HospitalCatalog.Specialties(u.Id),
                clinics = await db.Set<Location>().Where(l => clinicIds.Contains(l.Id) && l.Active).ToListAsync() };
        }).AddEndpointFilter<LocalizedResponseFilter>().WithTags("Configuration");
        app.MapGet("/api/directory", (HospitalDb db) => HospitalCatalog.Directory(db)).AddEndpointFilter<LocalizedResponseFilter>().WithTags("Configuration");
        app.MapGet("/api/config", async (HospitalDb db, IConfiguration config) => new {
            name = "An Tâm · Hospital Guide", catalogVersion = HospitalCatalog.Roster.Version, demo = config.GetValue<bool>("Demo:Enabled"),
            departments = await db.Set<Department>().Where(d => d.Active).ToListAsync(), locations = await db.Set<Location>().Where(l => l.Active).ToListAsync(),
            services = await db.Set<HospitalService>().Where(s => s.Active).ToListAsync(),
            form = new { nameMin = 2, nameMax = 120, contactMin = 5, contactMax = 80, descriptionMax = 2000 },
            guestHours = config.GetValue<int>("Access:GuestHours", 24), pollSeconds = 5,
            emergencyVi = "Nếu cần trợ giúp khẩn cấp, hãy đến ngay quầy tiếp nhận hoặc báo nhân viên bệnh viện.",
            emergencyEn = "For urgent help, go directly to reception or alert hospital staff."
        }).AddEndpointFilter<LocalizedResponseFilter>().WithTags("Configuration");
        app.MapGet("/api/reception/resources", async (Access access, HospitalDb db) => {
            var u = await access.Staff("Reception"); var deps = u.Scopes.Select(s => s.DepartmentId).ToArray();
            var doctors = await db.Users.Include(x => x.Scopes).Where(x => x.Role == "Doctor" && x.Active && x.Scopes.Any(s => deps.Contains(s.DepartmentId))).OrderBy(x => x.CreatedAt).ToListAsync();
            return new { doctors = doctors.Select(x => new { x.Id, x.Name, departments = x.Scopes.Select(s => s.DepartmentId), specialties = HospitalCatalog.Specialties(x.Id), clinicIds = HospitalCatalog.Clinician(x.Id)?.ClinicIds ?? [], directoryOnly = string.IsNullOrEmpty(x.PasswordHash) }),
                clinics = HospitalCatalog.Roster.Clinics.Select(c => new { c.Id, specialty = HospitalCatalog.Roster.Specialties.Single(s => s.Id == c.SpecialtyId).Name }),
                templates = await db.Set<GuidanceTemplate>().Where(t => t.Category == "Reception" && t.Published).OrderByDescending(t => t.Revision).ToListAsync() };
        });
        var g = app.MapGroup("/api/admin").WithTags("Administration");
        g.MapGet("/dashboard", AdminDashboard.Read);
        g.MapGet("/configuration", async (Access access, HospitalDb db) => {
            await access.Staff("Admin");
            var staff = await db.Users.Include(u => u.Scopes).Where(u => u.Role != "Patient").ToListAsync();
            return new {
                departments = await db.Set<Department>().ToListAsync(), locations = await db.Set<Location>().ToListAsync(), services = await db.Set<HospitalService>().ToListAsync(),
                mappings = await db.Set<WorkflowMapping>().OrderByDescending(m => m.Revision).ToListAsync(), templates = await db.Set<GuidanceTemplate>().OrderByDescending(t => t.Revision).ToListAsync(), routes = await db.Set<HospitalRoute>().ToListAsync(),
                staff = staff.Select(u => new { u.Id, u.Version, u.Email, u.Name, u.Role, u.Active, departmentIds = u.Scopes.Select(s => s.DepartmentId), specialties = HospitalCatalog.Specialties(u.Id), directoryOnly = string.IsNullOrEmpty(u.PasswordHash) })
            };
        });
        g.MapPost("/departments", async (DepartmentInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Admin"); return await bus.Run($"{u.Id}:department", input, async () => {
                var d = await GetOrNew<Department>(input.Id, input.Version, db);
                Check.That(input.Id is null || d.Code == input.Code || (d.Code is not ("CONSULT" or "CASHIER" or "PHARMACY") && !HospitalCatalog.Departments.Any(c => c.Code == d.Code)), "configurationInUse", "Operational department codes are stable identifiers; edit their display names and destinations instead.", 409);
                if (!input.Active) Check.That(!await db.Visits.AnyAsync(v => v.DepartmentId == d.Id && v.Status == "Active") && !await db.Requests.AnyAsync(r => r.DepartmentId == d.Id && r.Status != "Confirmed" && r.Status != "Withdrawn"), "activeReferences", "Department has active reception or Visits.", 409);
                d.Code = Check.Text(input.Code, "code", 2, 40).ToUpperInvariant(); d.NameVi = Check.Text(input.NameVi, "nameVi", 2, 120); d.Active = input.Active;
                bus.Audit(u.Id, "DepartmentConfigured", detail: d.Id.ToString(), source: "Admin"); return new { d.Id };
            });
        });
        g.MapPost("/locations", async (LocationInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Admin"); return await bus.Run($"{u.Id}:location", input, async () => {
                var l = await GetOrNew<Location>(input.Id, input.Version, db);
                Check.That(await db.Set<Department>().AnyAsync(d => d.Id == input.DepartmentId && d.Active), "departmentInvalid", "Active department required.");
                if (!input.Active || (input.Id is not null && l.DepartmentId != input.DepartmentId)) Check.That(!await db.Set<JourneyStep>().AnyAsync(s => s.LocationId == l.Id && s.Status != "Completed" && s.Status != "Cancelled" && s.Status != "Skipped"), "activeReferences", "Location is referenced by unfinished steps.", 409);
                l.DepartmentId = input.DepartmentId; l.NameVi = Check.Text(input.NameVi, "nameVi", 2, 120); l.Building = Check.Text(input.Building, "building", 1, 30);
                l.Floor = Check.Text(input.Floor, "floor", 1, 30); l.Room = Check.Text(input.Room, "room", 1, 30); l.Active = input.Active;
                bus.Audit(u.Id, "LocationConfigured", detail: l.Id.ToString(), source: "Admin"); return new { l.Id };
            });
        });
        g.MapPost("/services", async (ServiceInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Admin"); return await bus.Run($"{u.Id}:service", input, async () => {
                var s = await GetOrNew<HospitalService>(input.Id, input.Version, db);
                Check.That(await db.Set<Location>().AnyAsync(l => l.Id == input.LocationId && l.Active && l.DepartmentId == input.DepartmentId), "destinationInvalid", "Location must belong to the selected department.");
                s.Code = Check.Text(input.Code, "code", 2, 40).ToUpperInvariant(); s.NameVi = Check.Text(input.NameVi, "nameVi", 2, 120);
                s.DepartmentId = input.DepartmentId; s.LocationId = input.LocationId; s.Active = input.Active; s.ReturnRequired = input.ReturnRequired;
                bus.Audit(u.Id, "ServiceConfigured", detail: s.Id.ToString(), source: "Admin"); return new { s.Id };
            });
        });
        g.MapPost("/mappings", async (MappingInput input, Access access, HospitalDb db, CommandBus bus, Workflow workflow) => {
            var u = await access.Staff("Admin"); return await bus.Run($"{u.Id}:mapping", input, async () => {
                Check.That(await db.Set<HospitalService>().AnyAsync(s => s.Id == input.ServiceId && s.Active), "serviceUnavailable", "Active service required.");
                var m = new WorkflowMapping { HospitalServiceId = input.ServiceId, Revision = (await db.Set<WorkflowMapping>().Where(m => m.HospitalServiceId == input.ServiceId).MaxAsync(m => (int?)m.Revision) ?? 0) + 1,
                    StepsJson = JsonSerializer.Serialize(input.Steps, CommandBus.Json), Published = input.Publish };
                await workflow.ValidateMapping(m); db.Add(m); bus.Audit(u.Id, "MappingConfigured", detail: m.Id.ToString(), source: "Admin"); return new { m.Id, m.Revision };
            });
        });
        g.MapPost("/templates", async (TemplateInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Admin"); return await bus.Run($"{u.Id}:template", input, async () => {
                Check.That(input.Category is "Guidance" or "Reception", "validation", "Only operational templates can be administered here.");
                var key = Check.Text(input.Key, "key", 2, 100); var language = Languages.Source(input.Language);
                var t = new GuidanceTemplate { Key = key, Language = language, Category = input.Category, Text = Check.Text(input.Text, "text", 2, 4000), Published = input.Publish, ApprovedBy = input.Publish ? u.Id : null,
                    Revision = (await db.Set<GuidanceTemplate>().Where(t => t.Key == key && t.Language == language).MaxAsync(t => (int?)t.Revision) ?? 0) + 1 };
                db.Add(t); bus.Audit(u.Id, "TemplateConfigured", detail: t.Id.ToString(), source: "Admin"); return new { t.Id, t.Revision };
            });
        });
        g.MapPost("/routes", async (RouteInput input, Access access, HospitalDb db, CommandBus bus) => {
            var u = await access.Staff("Admin"); return await bus.Run($"{u.Id}:route", input, async () => {
                Check.That(input.FromLocationId != input.ToLocationId && await db.Set<Location>().CountAsync(l => (l.Id == input.FromLocationId || l.Id == input.ToLocationId) && l.Active) == 2, "destinationInvalid", "Choose two active locations.");
                var r = await GetOrNew<HospitalRoute>(input.Id, input.Version, db); r.FromLocationId = input.FromLocationId; r.ToLocationId = input.ToLocationId;
                r.Language = Languages.Source(input.Language); r.Instructions = Check.Text(input.Instructions, "instructions", 3, 4000); r.Active = input.Active;
                bus.Audit(u.Id, "RouteConfigured", detail: r.Id.ToString(), source: "Admin"); return new { r.Id };
            });
        });
        g.MapPost("/staff", async (StaffInput input, Access access, HospitalDb db, CommandBus bus) => {
            var admin = await access.Staff("Admin"); return await bus.Run($"{admin.Id}:staff", input, async () => {
                Check.That(new[] { "Reception", "Doctor", "Service", "Cashier", "Admin" }.Contains(input.Role), "validation", "Choose a supported staff role.");
                Check.That(input.Role == "Admin" || input.DepartmentIds.Length > 0, "validation", "Staff department scope is required.");
                Check.That(await db.Set<Department>().CountAsync(d => input.DepartmentIds.Contains(d.Id) && d.Active) == input.DepartmentIds.Distinct().Count(), "departmentInvalid", "Choose active departments.");
                var user = input.Id is {} uid ? await db.Users.Include(u => u.Scopes).SingleOrDefaultAsync(u => u.Id == uid && u.Role != "Patient") : null;
                if (input.Id is not null) { Check.That(user is not null, "notFound", "Staff account not found.", 404); Check.Version(user!, input.Version); }
                else { user = new UserAccount(); db.Add(user); }
                Check.That(user!.Id != admin.Id || (input.Active && input.Role == "Admin"), "selfLockout", "Do not remove your own administrator access.");
                if (input.Role != "Doctor" || !input.Active) Check.That(!await db.Visits.AnyAsync(v => v.DoctorId == user.Id && v.Status == "Active"), "activeReferences", "Doctor has active assigned Visits.", 409);
                if (input.Role == "Doctor") Check.That(!await db.Visits.AnyAsync(v => v.DoctorId == user.Id && v.Status == "Active" && !input.DepartmentIds.Contains(v.DepartmentId)), "activeReferences", "Keep department access for assigned active Visits.", 409);
                user.Email = IdentityEndpoints.Email(input.Email); user.Name = Check.Text(input.Name, "name", 2, 120); user.Role = input.Role; user.Active = input.Active;
                if (input.Id is null || !string.IsNullOrEmpty(input.Password)) { Check.That(input.Password?.Length is >= 12 and <= 128 && input.Password.Any(char.IsDigit), "passwordPolicy", "Use 12–128 characters including a number."); user.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(user, input.Password!); }
                foreach (var old in user.Scopes.Where(s => !input.DepartmentIds.Contains(s.DepartmentId)).ToList()) { db.Remove(old); user.Scopes.Remove(old); }
                foreach (var dep in input.DepartmentIds.Distinct().Where(dep => user.Scopes.All(s => s.DepartmentId != dep))) user.Scopes.Add(new StaffScope { DepartmentId = dep, UserAccountId = user.Id });
                foreach (var session in await db.Sessions.Where(s => s.UserAccountId == user.Id).ToListAsync()) session.Revoked = true;
                bus.Audit(admin.Id, "StaffConfigured", detail: user.Id.ToString(), source: "Admin"); return new { user.Id };
            });
        });
        g.MapGet("/audit", async (Access access, HospitalDb db) => {
            await access.Staff("Admin"); return await db.Set<AuditEvent>().Where(e => e.Source == "Admin" || e.Source == "Identity").OrderByDescending(e => e.CreatedAt).Take(100).ToListAsync();
        });
    }
    static async Task<T> GetOrNew<T>(Guid? id, int version, HospitalDb db) where T : Entity, new()
    {
        if (id is null) { var entity = new T(); db.Add(entity); return entity; }
        var existing = await db.Set<T>().FindAsync(id.Value) ?? throw new ApiException(404, "notFound", "Configuration record not found."); Check.Version(existing, version); return existing;
    }
}
