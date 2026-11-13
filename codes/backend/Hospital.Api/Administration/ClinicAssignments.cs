using System.Text.Json;
using Hospital.Api.Domain;
using Hospital.Api.Identity;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Administration;

public record ClinicDoctorsInput(int Version, Guid[] DoctorIds);
public record ActiveDoctorInput(int Version, Guid? DoctorId);
public record AssignmentDoctor(Guid Id, string Name);
public record ClinicAssignmentView(Guid ClinicLocationId, int Version, Guid[] DoctorIds,
    AssignmentDoctor? ActiveDoctor, int ActiveVisitCount, bool CanChangeDoctor,
    Guid DepartmentId, string NameVi, string Room, bool Available, bool ActiveDoctorUsable);

public static class ClinicAssignments
{
    public static void MapClinicAssignments(this RouteGroupBuilder group)
    {
        group.MapGet("/clinics", async (Access access, HospitalDb db) => {
            await access.Staff("Admin");
            return await Views(await db.Set<Location>().AsNoTracking().OrderBy(l => l.NameVi).ToArrayAsync(), db);
        });
        group.MapGet("/clinics/{id:guid}/assignment", async (Guid id, Access access, HospitalDb db) => {
            await access.Staff("Admin");
            return await View(await Location(id, db), db);
        });
        group.MapPut("/clinics/{id:guid}/doctors", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus) => {
            var actor = await access.Staff("Admin");
            var version = ParseVersion(body, "doctorIds");
            Check.That(body.GetProperty("doctorIds").ValueKind == JsonValueKind.Array, "validation", "Doctor IDs must be an array.");
            var values = body.GetProperty("doctorIds").EnumerateArray().ToArray();
            Check.That(values.Length <= 500 && values.All(v => v.ValueKind == JsonValueKind.String && v.TryGetGuid(out var id) && id != Guid.Empty), "validation", "Choose valid doctor IDs.");
            var input = new ClinicDoctorsInput(version, values.Select(v => v.GetGuid()).ToArray());
            Check.That(input.DoctorIds.Distinct().Count() == input.DoctorIds.Length, "validation", "Choose distinct doctors.");
            return await bus.Run($"prd-v2:{actor.Id}:clinic-doctors:{id}", input, async () => {
                await RequireAdmin(actor.Id, db);
                var location = await Location(id, db);
                var room = await Room(id, input.Version, db);
                var members = await db.Set<ClinicDoctor>().Where(a => a.ClinicLocationId == id).ToListAsync();
                var before = members.Select(a => a.DoctorId).Order().ToArray();
                var after = input.DoctorIds.Order().ToArray();
                if (before.SequenceEqual(after)) return await View(location, db);
                await RequireAvailable(location, db);
                await RequireNoVisits(id, before.Union(after).ToArray(), db);
                Check.That(room?.ActiveDoctorId == null || after.Contains(room.ActiveDoctorId.Value),
                    "activeDoctorMustBeCleared", "Clear the active doctor before removing their room membership.", 409);
                foreach (var doctorId in after.Except(before)) {
                    await RequireUsableDoctor(doctorId, location.DepartmentId, db);
                    Check.That(!await db.Set<ClinicDoctor>().AnyAsync(a => a.DoctorId == doctorId),
                        "doctorAlreadyAssigned", "Remove the doctor's existing room membership first.", 409);
                    db.Add(new ClinicDoctor { ClinicLocationId = id, DoctorId = doctorId });
                }
                db.RemoveRange(members.Where(a => !after.Contains(a.DoctorId)));
                Touch(room, id, db);
                bus.Audit(actor.Id, "ClinicDoctorsConfigured", detail: JsonSerializer.Serialize(new { clinicLocationId = id, before, after }, CommandBus.Json), source: "Admin");
                await db.SaveChangesAsync();
                return await View(location, db);
            });
        }).Accepts<ClinicDoctorsInput>("application/json").Produces<ClinicAssignmentView>()
            .ProducesProblem(409, "application/json").ProducesProblem(422, "application/json");
        group.MapPut("/clinics/{id:guid}/active-doctor", async (Guid id, JsonElement body, Access access, HospitalDb db, CommandBus bus) => {
            var actor = await access.Staff("Admin");
            var version = ParseVersion(body, "doctorId");
            var value = body.GetProperty("doctorId");
            Check.That(value.ValueKind == JsonValueKind.Null || (value.ValueKind == JsonValueKind.String && value.TryGetGuid(out var doctorId) && doctorId != Guid.Empty), "validation", "Choose a valid doctor ID or null.");
            var input = new ActiveDoctorInput(version, value.ValueKind == JsonValueKind.Null ? null : value.GetGuid());
            return await bus.Run($"prd-v2:{actor.Id}:clinic-active-doctor:{id}", input, async () => {
                await RequireAdmin(actor.Id, db);
                var location = await Location(id, db);
                var room = await Room(id, input.Version, db);
                var before = room?.ActiveDoctorId;
                if (before == input.DoctorId) return await View(location, db);
                await RequireAvailable(location, db);
                var members = await db.Set<ClinicDoctor>().Where(a => a.ClinicLocationId == id).Select(a => a.DoctorId).ToArrayAsync();
                await RequireNoVisits(id, members.Concat(input.DoctorId is {} doctorId ? new[] { doctorId } : []).ToArray(), db);
                if (input.DoctorId is {} selected) {
                    Check.That(members.Contains(selected), "doctorNotInClinic", "Choose a doctor belonging to this clinic.");
                    await RequireUsableDoctor(selected, location.DepartmentId, db);
                }
                room = Touch(room, id, db);
                room.ActiveDoctorId = input.DoctorId;
                bus.Audit(actor.Id, "ClinicActiveDoctorConfigured", detail: JsonSerializer.Serialize(new { clinicLocationId = id, before, after = input.DoctorId }, CommandBus.Json), source: "Admin");
                await db.SaveChangesAsync();
                return await View(location, db);
            });
        }).Accepts<ActiveDoctorInput>("application/json").Produces<ClinicAssignmentView>()
            .ProducesProblem(409, "application/json").ProducesProblem(422, "application/json");
    }

    static int ParseVersion(JsonElement body, string field)
    {
        Check.That(body.ValueKind == JsonValueKind.Object, "validation", "An object is required.");
        var fields = body.EnumerateObject().Select(p => p.Name).ToArray();
        Check.That(fields.Length == 2 && fields.Distinct().Count() == 2 && fields.Contains("version") && fields.Contains(field), "validation", "Only assignment fields are allowed.");
        var version = body.GetProperty("version");
        Check.That(version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out var _) && version.GetInt32() >= 0, "validation", "A nonnegative integer assignment version is required.");
        return version.GetInt32();
    }

    static async Task RequireAdmin(Guid id, HospitalDb db) => Check.That(
        await db.Users.AsNoTracking().AnyAsync(u => u.Id == id && u.Active && u.Role == "Admin"),
        "forbidden", "Administrator authority required.", 403);

    static async Task<Location> Location(Guid id, HospitalDb db) =>
        await db.Set<Location>().SingleOrDefaultAsync(l => l.Id == id) ?? throw new ApiException(404, "notFound", "Clinic location not found.");

    static async Task<ClinicRoom?> Room(Guid id, int version, HospitalDb db)
    {
        var room = await db.Set<ClinicRoom>().FromSqlInterpolated($"SELECT * FROM ClinicRoom WITH (UPDLOCK,HOLDLOCK) WHERE ClinicLocationId={id}").SingleOrDefaultAsync();
        Check.That(version >= 0 && (room?.Version ?? 0) == version, "conflict", "Clinic assignment changed. Refresh and review again.", 409);
        return room;
    }

    static ClinicRoom Touch(ClinicRoom? room, Guid id, HospitalDb db)
    {
        if (room == null) { room = new ClinicRoom { ClinicLocationId = id }; db.Add(room); }
        else db.Entry(room).Property(r => r.Version).IsModified = true;
        return room;
    }

    static async Task RequireAvailable(Location location, HospitalDb db) => Check.That(
        location.Active && await db.Set<Department>().AnyAsync(d => d.Id == location.DepartmentId && d.Active),
        "clinicUnavailable", "Choose an active clinic and department.", 409);

    static async Task RequireUsableDoctor(Guid id, Guid departmentId, HospitalDb db)
    {
        var user = await db.Users.AsNoTracking().Include(u => u.Scopes).SingleOrDefaultAsync(u => u.Id == id);
        Check.That(user is { Role: "Doctor" } && user.Scopes.Any(s => s.DepartmentId == departmentId),
            "doctorNotInClinic", "Choose a Doctor with the clinic's department scope.");
        Check.That(user!.Active && !string.IsNullOrWhiteSpace(user.PasswordHash),
            "doctorUnavailable", "Choose an enabled Doctor with login credentials.", 409);
    }

    // Include legacy consultation destinations and doctors whose old Visits have no clinic column.
    static IQueryable<Visit> ActiveVisits(Guid id, Guid[] doctors, HospitalDb db) => db.Visits.Where(v => v.Status == "Active"
        && (v.ClinicLocationId == id || doctors.Contains(v.DoctorId)
            || v.Journey.Steps.Any(s => s.Kind == "Consultation" && s.LocationId == id)));

    static async Task RequireNoVisits(Guid id, Guid[] doctors, HospitalDb db) => Check.That(
        !await ActiveVisits(id, doctors, db).AnyAsync(), "clinicHasActiveVisits", "Close all active Visits before changing clinic assignments.", 409);

    static async Task<ClinicAssignmentView> View(Location location, HospitalDb db)
    {
        return (await Views([location], db))[0];
    }

    static async Task<ClinicAssignmentView[]> Views(Location[] locations, HospitalDb db)
    {
        var ids = locations.Select(l => l.Id).ToArray();
        var rooms = await db.Set<ClinicRoom>().AsNoTracking().Where(r => ids.Contains(r.ClinicLocationId)).ToDictionaryAsync(r => r.ClinicLocationId);
        var assignments = await db.Set<ClinicDoctor>().AsNoTracking().Where(a => ids.Contains(a.ClinicLocationId)).ToListAsync();
        var doctorIds = assignments.Select(a => a.DoctorId).ToArray();
        var doctors = await db.Users.AsNoTracking().Include(u => u.Scopes).Where(u => doctorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        var departments = await db.Set<Department>().Where(d => d.Active).Select(d => d.Id).ToArrayAsync();
        var visits = await db.Visits.Where(v => v.Status == "Active").Select(v => new {
            v.Id, v.DoctorId, v.ClinicLocationId,
            destinations = v.Journey.Steps.Where(s => s.Kind == "Consultation").Select(s => s.LocationId).ToArray()
        }).ToListAsync();
        return locations.Select(location => {
            var room = rooms.GetValueOrDefault(location.Id);
            var members = assignments.Where(a => a.ClinicLocationId == location.Id).Select(a => a.DoctorId).Order().ToArray();
            var doctor = room?.ActiveDoctorId is {} activeId ? doctors.GetValueOrDefault(activeId) : null;
            var count = visits.Count(v => v.ClinicLocationId == location.Id || members.Contains(v.DoctorId) || v.destinations.Contains(location.Id));
            var available = location.Active && departments.Contains(location.DepartmentId);
            return new ClinicAssignmentView(location.Id, room?.Version ?? 0, members, doctor == null ? null : new(doctor.Id, doctor.Name), count,
                available && count == 0, location.DepartmentId, location.NameVi, location.Room, available,
                available && doctor is { Active: true, Role: "Doctor" } && !string.IsNullOrWhiteSpace(doctor.PasswordHash)
                    && doctor.Scopes.Any(s => s.DepartmentId == location.DepartmentId) && members.Contains(doctor.Id));
        }).ToArray();
    }
}
