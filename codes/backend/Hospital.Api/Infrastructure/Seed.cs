using System.Text.Json;
using Hospital.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Infrastructure;
public static class Seed
{
    public static async Task Run(HospitalDb db, IConfiguration config)
    {
        if (!config.GetValue<bool>("Demo:Enabled") || await db.Users.AnyAsync()) return;
        var password = config["Demo:Password"];
        if (string.IsNullOrWhiteSpace(password) || password.Length < 12) throw new InvalidOperationException("Set Demo__Password using local environment configuration.");
        var departments = new[] {
            new Department { Code = "CONSULT", NameVi = "Khám tổng quát" },
            new Department { Code = "LAB", NameVi = "Xét nghiệm" },
            new Department { Code = "IMAGING", NameVi = "Chẩn đoán hình ảnh" },
            new Department { Code = "CASHIER", NameVi = "Thu ngân" },
            new Department { Code = "PHARMACY", NameVi = "Nhà thuốc" },
            new Department { Code = "OTHER", NameVi = "Khoa khác" }
        };
        db.AddRange(departments);
        var locations = new[] {
            new Location { DepartmentId = departments[0].Id, NameVi = "Phòng khám tổng quát", Floor = "1", Room = "A101" },
            new Location { DepartmentId = departments[1].Id, NameVi = "Phòng lấy mẫu", Floor = "2", Building = "B", Room = "B201" },
            new Location { DepartmentId = departments[2].Id, NameVi = "Phòng chẩn đoán hình ảnh", Floor = "2", Building = "B", Room = "B202" },
            new Location { DepartmentId = departments[3].Id, NameVi = "Quầy thu ngân", Floor = "1", Building = "C", Room = "C01" },
            new Location { DepartmentId = departments[4].Id, NameVi = "Quầy nhà thuốc", Floor = "1", Room = "P01" },
            new Location { DepartmentId = departments[0].Id, NameVi = "Quầy tiếp nhận", Floor = "1", Room = "R01" },
            new Location { DepartmentId = departments[5].Id, NameVi = "Phòng khoa khác", Floor = "3", Building = "D", Room = "D301" }
        };
        db.AddRange(locations);
        var patient = new Patient { Name = "Người dùng Demo", Contact = "demo-contact", Language = "vi" }; db.Add(patient);
        var roleDefinitions = new[] {
            ("patient", "Patient", "Bệnh nhân Demo", Array.Empty<Guid>()),
            ("reception", "Reception", "Tiếp nhận Demo", departments.Select(d => d.Id).ToArray()),
            ("doctor", "Doctor", "BS. Minh · Demo", new[] { departments[0].Id }),
            ("service", "Service", "Dịch vụ Demo", new[] { departments[1].Id, departments[2].Id }),
            ("cashier", "Cashier", "Thu ngân Demo", new[] { departments[0].Id, departments[3].Id }),
            ("admin", "Admin", "Quản trị Demo", Array.Empty<Guid>()),
            ("otherdoctor", "Doctor", "BS. Khác · Demo", new[] { departments[5].Id })
        };
        foreach (var (key, role, name, scopes) in roleDefinitions) {
            var u = new UserAccount { Email = key + "@demo.local", Role = role, Name = name, PatientId = role == "Patient" ? patient.Id : null };
            u.PasswordHash = new PasswordHasher<UserAccount>().HashPassword(u, password);
            foreach (var dep in scopes) u.Scopes.Add(new StaffScope { UserAccountId = u.Id, DepartmentId = dep }); db.Add(u);
        }
        var texts = new (string Key, string Vi, string En)[] {
            ("consultation", "Đến phòng khám được ghi trên phiếu. Theo dõi số thứ tự và chờ nhân viên gọi.", "Go to the consultation room on your ticket. Check your queue number and wait to be called."),
            ("return", "Quay lại phòng khám khi các dịch vụ đã hoàn tất. Chờ bác sĩ gọi để tiếp tục khám.", "Return to the consultation room after the required services. Wait for the doctor to call you."),
            ("laboratory", "Đến phòng lấy mẫu và xuất trình phiếu khám. Làm theo hướng dẫn của nhân viên xét nghiệm.", "Go to sample collection and show your examination ticket. Follow the laboratory staff's instructions."),
            ("imaging", "Đến phòng chẩn đoán hình ảnh và xuất trình phiếu khám. Chờ nhân viên hướng dẫn.", "Go to the imaging room and show your examination ticket. Wait for staff instructions."),
            ("settlement", "Đến quầy thu ngân để nhân viên xác nhận quyết toán cuối cùng hoặc xác nhận không cần thanh toán.", "Go to the settlement desk for staff to confirm final settlement or that no payment is required."),
            ("pharmacy", "Đến quầy nhà thuốc theo hướng dẫn đã được bác sĩ xác nhận. Hoàn thành hành trình chỉ ghi nhận bạn đã kết thúc hướng dẫn, không xác nhận thuốc đã được cấp phát.", "Go to the pharmacy following the doctor's confirmed instructions. Completing guidance does not certify that medication has been dispensed."),
            ("contact", "Vui lòng bổ sung thông tin liên hệ tại biểu mẫu và gửi lại để tiếp nhận kiểm tra.", "Please update your contact information in the form and resubmit it for reception review."),
            ("documents", "Vui lòng chuẩn bị giấy tờ cần thiết và trao đổi trực tiếp với nhân viên tiếp nhận.", "Please prepare the required documents and speak with reception staff.")
        };
        foreach (var (key, vi, _) in texts)
            db.Add(new GuidanceTemplate { Key = key, Language = "vi", Text = vi, Published = true, Category = key is "contact" or "documents" ? "Reception" : "Guidance" });
        foreach (var (code, vi, _, idx, template) in new[] { ("LAB", "Xét nghiệm theo chỉ định", "Ordered laboratory service", 1, "laboratory"), ("IMG", "Chẩn đoán hình ảnh theo chỉ định", "Ordered imaging service", 2, "imaging") }) {
            var service = new HospitalService { Code = code, NameVi = vi, DepartmentId = departments[idx].Id, LocationId = locations[idx].Id };
            db.Add(service); db.Add(new WorkflowMapping { HospitalServiceId = service.Id, Published = true,
                StepsJson = JsonSerializer.Serialize(new[] { new MappingNode("service", locations[idx].Id, template, "Service", []) }, CommandBus.Json) });
        }
        foreach (var target in locations.Where(l => l.Id != locations[5].Id)) {
            db.Add(new HospitalRoute { FromLocationId = locations[5].Id, ToLocationId = target.Id, Language = "vi", Instructions = $"Từ quầy tiếp nhận, theo biển chỉ dẫn đến tòa {target.Building}, tầng {target.Floor}, phòng {target.Room}. Nếu chưa rõ đường, hãy yêu cầu nhân viên hỗ trợ." });
        }
        await db.SaveChangesAsync();
    }
}
