using System.Text.Json;
using Hospital.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Infrastructure;

// The same versioned source files are consumed by the web/mobile map and this API.
public record CatalogDepartment(string Id, string Code, string NameVi, string NameEn, string? Building, string[] Floors, string Marker);
public record CatalogSpecialty(Guid Id, string DepartmentKey, string Name);
public record CatalogClinic(Guid Id, string DepartmentKey, Guid SpecialtyId, string Name, string? Room);
public record CatalogClinician(Guid Id, string Name, string DepartmentKey, bool IsDoctor, string[] Titles, Guid[] SpecialtyIds, Guid[] ClinicIds, JsonElement[] SourceVariants);
public record CatalogRoster(string Version, JsonElement Source, CatalogSpecialty[] Specialties, CatalogClinic[] Clinics, CatalogClinician[] Clinicians, JsonElement[] Warnings);
public static class HospitalCatalog
{
    static T Read<T>(string resource) {
        using var stream = typeof(HospitalCatalog).Assembly.GetManifestResourceStream(resource) ?? throw new InvalidOperationException($"Missing catalog {resource}");
        return JsonSerializer.Deserialize<T>(stream, CommandBus.Json) ?? throw new InvalidOperationException($"Invalid catalog {resource}");
    }
    public static readonly CatalogDepartment[] Departments = Read<CatalogDepartment[]>("Hospital.Departments.json");
    public static readonly CatalogRoster Roster = Read<CatalogRoster>("Hospital.Roster.json");
    public static CatalogClinician? Clinician(Guid id) => Roster.Clinicians.FirstOrDefault(d => d.Id == id);
    public static string[] Specialties(Guid id) => Clinician(id) is {} doctor ? Roster.Specialties.Where(s => doctor.SpecialtyIds.Contains(s.Id)).Select(s => s.Name).ToArray() : [];
    public static async Task<object> Directory(HospitalDb db) {
        var deps = await db.Set<Department>().Where(d => d.Active).ToListAsync();
        var users = await db.Users.Where(d => d.Role == "Doctor" && d.Active).ToDictionaryAsync(d => d.Id);
        var locations = await db.Set<Location>().Where(l => l.Active).ToDictionaryAsync(l => l.Id);
        Guid? DepartmentId(string key) {
            var code = Departments.Single(d => d.Id == key).Code;
            return deps.FirstOrDefault(d => d.Code == code)?.Id;
        }
        return new {
            Roster.Source, Roster.Version, Roster.Warnings,
            departments = Departments.Where(d => DepartmentId(d.Id) is not null).Select(d => new {
                id = DepartmentId(d.Id), mapKey = d.Id, d.Code, nameVi = deps.Single(x => x.Id == DepartmentId(d.Id)).NameVi,
                nameEn = deps.Single(x => x.Id == DepartmentId(d.Id)).NameEn, d.Building, d.Floors,
                locationConfirmed = d.Building is not null && d.Floors.Length > 0
            }),
            specialties = Roster.Specialties.Where(s => DepartmentId(s.DepartmentKey) is not null).Select(s => new { s.Id, departmentId = DepartmentId(s.DepartmentKey), s.Name }),
            clinics = Roster.Clinics.Where(c => DepartmentId(c.DepartmentKey) is not null && locations.ContainsKey(c.Id)).Select(c => new {
                c.Id, departmentId = DepartmentId(c.DepartmentKey), c.SpecialtyId, c.Name, c.Room,
                building = locations[c.Id].Building, floor = locations[c.Id].Floor,
                locationConfirmed = locations[c.Id].Building != "?" && locations[c.Id].Floor != "?"
            }),
            clinicians = Roster.Clinicians.Where(d => DepartmentId(d.DepartmentKey) is not null && (!d.IsDoctor || users.ContainsKey(d.Id))).Select(d => new {
                d.Id, name = users.GetValueOrDefault(d.Id)?.Name ?? d.Name, departmentId = DepartmentId(d.DepartmentKey),
                d.IsDoctor, d.Titles, d.SpecialtyIds, d.ClinicIds, d.SourceVariants,
                directoryOnly = !d.IsDoctor || string.IsNullOrEmpty(users[d.Id].PasswordHash)
            })
        };
    }
    public static async Task Sync(HospitalDb db, IConfiguration config) {
        // An atomic, versioned, additive import also works on an already populated database.
        // Never reset patient history, staff credentials, manual locations or access scopes.
        if (!config.GetValue("Catalog:Enabled", true)) return;
        if (await db.Set<AuditEvent>().AnyAsync(a => a.Source == "Catalog" && a.SourceEventId == Roster.Version)) return;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var departments = await db.Set<Department>().ToListAsync();
        var byKey = new Dictionary<string, Department>();
        foreach (var source in Departments) {
            var d = departments.SingleOrDefault(d => d.Code == source.Code);
            if (d is null) {
                d = new Department { Code = source.Code, NameVi = source.NameVi, NameEn = source.NameEn };
                db.Add(d); departments.Add(d);
            } else if ((d.Code == "CONSULT" && d.NameVi == "Khám tổng quát") || (d.Code == "IMAGING" && d.NameVi == "Chẩn đoán hình ảnh")) {
                d.NameVi = source.NameVi; d.NameEn = source.NameEn;
            }
            byKey.Add(source.Id, d);
        }
        var locationIds = (await db.Set<Location>().Select(l => l.Id).ToListAsync()).ToHashSet();
        foreach (var clinic in Roster.Clinics.Where(c => !locationIds.Contains(c.Id))) {
            db.Add(new Location { Id = clinic.Id, DepartmentId = byKey[clinic.DepartmentKey].Id,
                NameVi = clinic.Name, NameEn = clinic.Name, Room = clinic.Room ?? "?", Building = "?", Floor = "?" });
        }
        var users = await db.Users.Include(u => u.Scopes).ToListAsync();
        foreach (var doctor in Roster.Clinicians.Where(d => d.IsDoctor)) {
            if (users.Any(u => u.Id == doctor.Id)) continue;
            // Directory entries are assignable staff records, without login credentials.
            // An administrator may provision an actual account with a real email + password.
            var u = new UserAccount { Id = doctor.Id, Name = doctor.Name, Role = "Doctor",
                Email = $"directory-{doctor.Id:N}@example.invalid", PasswordHash = "" };
            u.Scopes.Add(new StaffScope { UserAccountId = u.Id, DepartmentId = byKey[doctor.DepartmentKey].Id });
            db.Add(u);
        }
        // Only the explicit demonstration reception account receives the expanded demo scope.
        if (config.GetValue<bool>("Demo:Enabled")) {
            var reception = users.SingleOrDefault(u => u.Email == "reception@demo.local" && u.Role == "Reception");
            if (reception is not null)
                foreach (var d in byKey.Values.Where(d => reception.Scopes.All(s => s.DepartmentId != d.Id)))
                    reception.Scopes.Add(new StaffScope { UserAccountId = reception.Id, DepartmentId = d.Id });
        }
        db.Add(new AuditEvent { Source = "Catalog", SourceEventId = Roster.Version, ActorId = Guid.Empty,
            Type = "HospitalCatalogImported", Detail = $"{Departments.Length} directory entries; {Roster.Clinicians.Length} clinician records; source period 2025-08" });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }
}
