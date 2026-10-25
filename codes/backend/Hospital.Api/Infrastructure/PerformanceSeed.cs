using System.Text.Json;
using Hospital.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Infrastructure;

// Explicit CLI fixture only; never exposed as an HTTP endpoint or run on the demo database.
public static class PerformanceSeed
{
    public static async Task Run(HospitalDb db, IConfiguration config)
    {
        if (!config.GetValue<bool>("Demo:Enabled") || !db.Database.GetDbConnection().Database.StartsWith("HospitalAcceptance_", StringComparison.Ordinal))
            throw new InvalidOperationException("Performance fixtures require a dedicated HospitalAcceptance_ database and Demo enabled.");
        if (await db.Users.AnyAsync(u => u.Email == "load0@example.test")) return;
        var doctor = await db.Users.SingleAsync(u => u.Email == "doctor@demo.local");
        var receptionist = await db.Users.SingleAsync(u => u.Email == "reception@demo.local");
        var location = await db.Set<Location>().SingleAsync(l => l.Room == "A101");
        var lab = await db.Set<Location>().SingleAsync(l => l.Room == "B201");
        var service = await db.Set<HospitalService>().SingleAsync(s => s.Code == "LAB");
        var snapshot = JsonSerializer.Serialize(new { location.NameVi, location.NameEn, location.Building, location.Floor, location.Room }, CommandBus.Json);
        var labSnapshot = JsonSerializer.Serialize(new { lab.NameVi, lab.NameEn, lab.Building, lab.Floor, lab.Room }, CommandBus.Json);
        for (var userIndex = 0; userIndex < 20; userIndex++)
        {
            var patient = new Patient { Name = $"Synthetic performance patient {userIndex}", Contact = "Synthetic fixture" };
            var user = new UserAccount { Email = $"load{userIndex}@example.test", Name = patient.Name, PatientId = patient.Id };
            user.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(user, config["Demo:Password"]!);
            var session = new Session { PatientId = patient.Id, UserAccountId = user.Id, TokenHash = Crypto.Hash(Guid.NewGuid().ToString()), ExpiresAt = DateTime.UtcNow.AddDays(-1), Revoked = true };
            db.AddRange(patient, user, session);
            for (var index = 0; index < 25; index++)
            {
                var request = new RegistrationRequest { PatientId = patient.Id, SessionId = session.Id, DepartmentId = location.DepartmentId, Name = patient.Name, Status = "Confirmed" };
                var reception = new ReceptionRecord { RegistrationRequestId = request.Id, PatientId = patient.Id, ConfirmedBy = receptionist.Id, VerificationNote = "Synthetic performance fixture" };
                var visit = new Visit { PatientId = patient.Id, DepartmentId = location.DepartmentId, DoctorId = doctor.Id, ReceptionRecordId = reception.Id };
                visit.Ticket = new ExaminationTicket { VisitId = visit.Id, Number = $"LOAD-{userIndex:D2}-{index:D2}" };
                visit.Journey = new PatientJourney { VisitId = visit.Id, Status = "Active", ActivatedAt = DateTime.UtcNow };
                var consultation = new JourneyStep { PatientJourneyId = visit.Journey.Id, LocationId = location.Id, DepartmentId = location.DepartmentId, DestinationSnapshot = snapshot, Status = "Completed", CompletedAt = DateTime.UtcNow, Sequence = 1 };
                visit.Journey.Steps.Add(consultation);
                for (var step = 2; step <= 19; step++)
                {
                    var order = new DoctorOrder { VisitId = visit.Id, HospitalServiceId = service.Id, OrderedBy = doctor.Id, MappingVersion = 1 };
                    visit.Orders.Add(order);
                    var item = new JourneyStep { PatientJourneyId = visit.Journey.Id, DoctorOrderId = order.Id, HospitalServiceId = service.Id, LocationId = lab.Id, DepartmentId = lab.DepartmentId, DestinationSnapshot = labSnapshot, Kind = "Service", Authority = "Service", TemplateKey = "laboratory", Sequence = step, Status = "Ready", MappingVersion = 1 };
                    item.Dependencies.Add(new StepDependency { JourneyStepId = item.Id, PrerequisiteStepId = consultation.Id });
                    visit.Journey.Steps.Add(item);
                }
                var final = new JourneyStep { PatientJourneyId = visit.Journey.Id, LocationId = location.Id, DepartmentId = location.DepartmentId, DestinationSnapshot = snapshot, Kind = "ReturnConsultation", TemplateKey = "return", Sequence = 20 };
                foreach (var item in visit.Journey.Steps.Where(s => s.Kind == "Service")) final.Dependencies.Add(new StepDependency { JourneyStepId = final.Id, PrerequisiteStepId = item.Id });
                visit.Journey.Steps.Add(final);
                db.AddRange(request, reception, visit);
                db.Add(new SummaryVersion { VisitId = visit.Id, Revision = 1, Status = "Published", Language = "vi", Diagnosis = "Dữ liệu kiểm thử tải, không phải hồ sơ khám bệnh", Instructions = "Hướng dẫn kiểm thử", AuthorId = doctor.Id, AuthorName = doctor.Name, PublishedAt = DateTime.UtcNow });
            }
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
        }
        Console.WriteLine($"Performance fixture ready: {await db.Set<JourneyStep>().CountAsync()} total steps, 20 synthetic accounts, 500 synthetic visits.");
    }
}
