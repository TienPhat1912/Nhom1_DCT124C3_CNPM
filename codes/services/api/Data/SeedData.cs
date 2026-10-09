using HospitalVisitApi.Models;
using Microsoft.EntityFrameworkCore;

namespace HospitalVisitApi.Data;

/// <summary>
/// Idempotent seed with synthetic data for demo.
/// Includes patients, staff accounts, departments, services, mappings, and templates.
/// </summary>
public static class SeedData
{
    // Well-known IDs for demo
    public static readonly Guid DeptCardiology = Guid.Parse("11111111-0001-0000-0000-000000000001");
    public static readonly Guid DeptLaboratory = Guid.Parse("11111111-0001-0000-0000-000000000002");
    public static readonly Guid DeptImaging = Guid.Parse("11111111-0001-0000-0000-000000000003");
    public static readonly Guid DeptPharmacy = Guid.Parse("11111111-0001-0000-0000-000000000004");
    public static readonly Guid DeptCashier = Guid.Parse("11111111-0001-0000-0000-000000000005");
    public static readonly Guid DeptGeneral = Guid.Parse("11111111-0001-0000-0000-000000000006");

    public static readonly Guid SvcBloodTest = Guid.Parse("22222222-0001-0000-0000-000000000001");
    public static readonly Guid SvcXRay = Guid.Parse("22222222-0001-0000-0000-000000000002");
    public static readonly Guid SvcUltrasound = Guid.Parse("22222222-0001-0000-0000-000000000003");
    public static readonly Guid SvcConsultation = Guid.Parse("22222222-0001-0000-0000-000000000004");
    public static readonly Guid SvcReturnConsult = Guid.Parse("22222222-0001-0000-0000-000000000005");
    public static readonly Guid SvcPayment = Guid.Parse("22222222-0001-0000-0000-000000000006");
    public static readonly Guid SvcPharmacy = Guid.Parse("22222222-0001-0000-0000-000000000007");

    public static readonly Guid UserReceptionist = Guid.Parse("33333333-0001-0000-0000-000000000001");
    public static readonly Guid UserDoctor = Guid.Parse("33333333-0001-0000-0000-000000000002");
    public static readonly Guid UserServiceStaff = Guid.Parse("33333333-0001-0000-0000-000000000003");
    public static readonly Guid UserCashier = Guid.Parse("33333333-0001-0000-0000-000000000004");
    public static readonly Guid UserAdmin = Guid.Parse("33333333-0001-0000-0000-000000000005");
    public static readonly Guid UserPatient1 = Guid.Parse("44444444-0001-0000-0000-000000000001");
    public static readonly Guid UserPatient2 = Guid.Parse("44444444-0001-0000-0000-000000000002");

    public static readonly Guid Patient1 = Guid.Parse("55555555-0001-0000-0000-000000000001");
    public static readonly Guid Patient2 = Guid.Parse("55555555-0001-0000-0000-000000000002");

    // Pre-existing appointment for demo (from simulated external system)
    public static readonly string DemoAppointmentId = "APT-2026-001234";

    public static async Task SeedAsync(AppDbContext db)
    {
        // Idempotent: only seed if no users exist
        if (await db.Users.AnyAsync())
            return;

        // Hash for all demo accounts: "Demo@123"
        var demoHash = BCrypt.Net.BCrypt.HashPassword("Demo@123");

        // === Staff accounts ===
        var staff = new[]
        {
            new User
            {
                Id = UserReceptionist,
                Email = "receptionist@hospital.demo",
                PasswordHash = demoHash,
                FullName = "Nguyễn Thị Hoa",
                Role = UserRole.Receptionist,
                StaffScope = $"{DeptCardiology},{DeptGeneral},{DeptLaboratory},{DeptImaging}",
                PreferredLanguage = "vi"
            },
            new User
            {
                Id = UserDoctor,
                Email = "doctor@hospital.demo",
                PasswordHash = demoHash,
                FullName = "Dr. Trần Văn Minh",
                Role = UserRole.Doctor,
                StaffScope = $"{DeptCardiology},{DeptGeneral}",
                PreferredLanguage = "vi"
            },
            new User
            {
                Id = UserServiceStaff,
                Email = "labstaff@hospital.demo",
                PasswordHash = demoHash,
                FullName = "Lê Thị Lan",
                Role = UserRole.ServiceStaff,
                StaffScope = $"{DeptLaboratory},{DeptImaging}",
                PreferredLanguage = "vi"
            },
            new User
            {
                Id = UserCashier,
                Email = "cashier@hospital.demo",
                PasswordHash = demoHash,
                FullName = "Phạm Văn Đức",
                Role = UserRole.Cashier,
                StaffScope = $"{DeptCashier}",
                PreferredLanguage = "vi"
            },
            new User
            {
                Id = UserAdmin,
                Email = "admin@hospital.demo",
                PasswordHash = demoHash,
                FullName = "Hoàng Thị Mai",
                Role = UserRole.Administrator,
                PreferredLanguage = "vi"
            }
        };
        db.Users.AddRange(staff);

        // === Patient accounts ===
        var patients = new[]
        {
            new User
            {
                Id = UserPatient1,
                Email = "patient1@demo.com",
                PasswordHash = demoHash,
                FullName = "John Smith",
                PhoneNumber = "+84901234567",
                Role = UserRole.Patient,
                PreferredLanguage = "en"
            },
            new User
            {
                Id = UserPatient2,
                Email = "patient2@demo.com",
                PasswordHash = demoHash,
                FullName = "Nguyễn Văn An",
                PhoneNumber = "+84907654321",
                Role = UserRole.Patient,
                PreferredLanguage = "vi"
            }
        };
        db.Users.AddRange(patients);

        // === Patient records ===
        var patientRecords = new[]
        {
            new Patient
            {
                Id = Patient1,
                UserId = UserPatient1,
                FullName = "John Smith",
                PhoneNumber = "+84901234567",
                DateOfBirth = new DateTime(1985, 3, 15),
                Gender = "Male",
                PreferredLanguage = "en"
            },
            new Patient
            {
                Id = Patient2,
                UserId = UserPatient2,
                FullName = "Nguyễn Văn An",
                PhoneNumber = "+84907654321",
                DateOfBirth = new DateTime(1990, 7, 22),
                Gender = "Male",
                PreferredLanguage = "vi"
            }
        };
        db.Patients.AddRange(patientRecords);

        // === Departments ===
        var departments = new[]
        {
            new Department { Id = DeptCardiology, NameVi = "Khoa Tim mạch", NameEn = "Cardiology", Floor = "3", Room = "301", Building = "Tòa A" },
            new Department { Id = DeptLaboratory, NameVi = "Khoa Xét nghiệm", NameEn = "Laboratory", Floor = "1", Room = "105", Building = "Tòa B" },
            new Department { Id = DeptImaging, NameVi = "Khoa Chẩn đoán hình ảnh", NameEn = "Imaging/Radiology", Floor = "1", Room = "110", Building = "Tòa B" },
            new Department { Id = DeptPharmacy, NameVi = "Nhà thuốc", NameEn = "Pharmacy", Floor = "1", Room = "101", Building = "Tòa A" },
            new Department { Id = DeptCashier, NameVi = "Thu ngân", NameEn = "Cashier", Floor = "1", Room = "102", Building = "Tòa A" },
            new Department { Id = DeptGeneral, NameVi = "Khoa Nội tổng hợp", NameEn = "General Internal Medicine", Floor = "2", Room = "201", Building = "Tòa A" }
        };
        db.Departments.AddRange(departments);

        // === Hospital Services ===
        var services = new[]
        {
            new HospitalService { Id = SvcBloodTest, NameVi = "Xét nghiệm máu", NameEn = "Blood Test", StepType = StepType.Laboratory, DepartmentId = DeptLaboratory },
            new HospitalService { Id = SvcXRay, NameVi = "Chụp X-Quang", NameEn = "X-Ray", StepType = StepType.Imaging, DepartmentId = DeptImaging },
            new HospitalService { Id = SvcUltrasound, NameVi = "Siêu âm", NameEn = "Ultrasound", StepType = StepType.Imaging, DepartmentId = DeptImaging },
            new HospitalService { Id = SvcConsultation, NameVi = "Khám bệnh", NameEn = "Consultation", StepType = StepType.Consultation, DepartmentId = DeptCardiology },
            new HospitalService { Id = SvcReturnConsult, NameVi = "Tái khám (kết quả)", NameEn = "Return Consultation", StepType = StepType.ReturnConsultation, DepartmentId = DeptCardiology },
            new HospitalService { Id = SvcPayment, NameVi = "Thanh toán", NameEn = "Payment", StepType = StepType.Payment, DepartmentId = DeptCashier },
            new HospitalService { Id = SvcPharmacy, NameVi = "Lấy thuốc", NameEn = "Pharmacy Pickup", StepType = StepType.Pharmacy, DepartmentId = DeptPharmacy }
        };
        db.HospitalServices.AddRange(services);

        // === Service Step Mappings (validated workflow, BR-25) ===
        var mappings = new[]
        {
            new ServiceStepMapping
            {
                ServiceId = SvcConsultation, StepType = StepType.Consultation, SortOrder = 1,
                DestinationVi = "Phòng khám Tim mạch - Tầng 3, Phòng 301",
                DestinationEn = "Cardiology Clinic - Floor 3, Room 301",
                DestinationDepartmentId = DeptCardiology
            },
            new ServiceStepMapping
            {
                ServiceId = SvcBloodTest, StepType = StepType.Laboratory, SortOrder = 2,
                PrerequisiteServiceIds = $"[\"{SvcConsultation}\"]",
                DestinationVi = "Khoa Xét nghiệm - Tầng 1, Phòng 105",
                DestinationEn = "Laboratory - Floor 1, Room 105",
                DestinationDepartmentId = DeptLaboratory
            },
            new ServiceStepMapping
            {
                ServiceId = SvcXRay, StepType = StepType.Imaging, SortOrder = 3,
                PrerequisiteServiceIds = $"[\"{SvcConsultation}\"]",
                DestinationVi = "Chẩn đoán hình ảnh - Tầng 1, Phòng 110",
                DestinationEn = "Imaging/Radiology - Floor 1, Room 110",
                DestinationDepartmentId = DeptImaging
            },
            new ServiceStepMapping
            {
                ServiceId = SvcUltrasound, StepType = StepType.Imaging, SortOrder = 3,
                PrerequisiteServiceIds = $"[\"{SvcConsultation}\"]",
                DestinationVi = "Chẩn đoán hình ảnh - Tầng 1, Phòng 110",
                DestinationEn = "Imaging/Radiology - Floor 1, Room 110",
                DestinationDepartmentId = DeptImaging
            },
            new ServiceStepMapping
            {
                ServiceId = SvcReturnConsult, StepType = StepType.ReturnConsultation, SortOrder = 4,
                PrerequisiteServiceIds = $"[\"{SvcBloodTest}\",\"{SvcXRay}\"]",
                DestinationVi = "Phòng khám Tim mạch - Tầng 3, Phòng 301",
                DestinationEn = "Cardiology Clinic - Floor 3, Room 301",
                DestinationDepartmentId = DeptCardiology
            },
            new ServiceStepMapping
            {
                ServiceId = SvcPayment, StepType = StepType.Payment, SortOrder = 5,
                DestinationVi = "Thu ngân - Tầng 1, Phòng 102",
                DestinationEn = "Cashier - Floor 1, Room 102",
                DestinationDepartmentId = DeptCashier
            },
            new ServiceStepMapping
            {
                ServiceId = SvcPharmacy, StepType = StepType.Pharmacy, SortOrder = 6,
                DestinationVi = "Nhà thuốc - Tầng 1, Phòng 101",
                DestinationEn = "Pharmacy - Floor 1, Room 101",
                DestinationDepartmentId = DeptPharmacy
            }
        };
        db.ServiceStepMappings.AddRange(mappings);

        // === Guidance Templates (VI/EN, approved) ===
        var templates = new[]
        {
            new GuidanceTemplate
            {
                TemplateKey = "welcome",
                ContentVi = "Chào mừng bạn đến bệnh viện. Vui lòng đăng ký hoặc tiếp tục với phiếu khám.",
                ContentEn = "Welcome to the hospital. Please register or continue with your examination ticket.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "consultation_wait",
                ContentVi = "Vui lòng chờ tại phòng chờ. Bạn sẽ được gọi khi đến lượt.",
                ContentEn = "Please wait in the waiting area. You will be called when it is your turn.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "lab_instruction",
                ContentVi = "Vui lòng đến phòng xét nghiệm. Nhớ mang theo phiếu khám.",
                ContentEn = "Please proceed to the laboratory. Remember to bring your examination ticket.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "imaging_instruction",
                ContentVi = "Vui lòng đến khoa Chẩn đoán hình ảnh. Tháo trang sức kim loại trước khi chụp.",
                ContentEn = "Please proceed to Imaging. Remove any metal jewelry before the scan.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "return_consultation",
                ContentVi = "Kết quả đã sẵn sàng. Vui lòng quay lại phòng khám để bác sĩ đọc kết quả.",
                ContentEn = "Results are ready. Please return to the clinic for the doctor to review your results.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "payment_instruction",
                ContentVi = "Vui lòng đến quầy thu ngân để thanh toán.",
                ContentEn = "Please proceed to the cashier for payment.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "pharmacy_instruction",
                ContentVi = "Vui lòng đến nhà thuốc để nhận thuốc theo đơn của bác sĩ.",
                ContentEn = "Please proceed to the pharmacy to collect your prescribed medication.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            },
            new GuidanceTemplate
            {
                TemplateKey = "supplement_request",
                ContentVi = "Nhân viên tiếp nhận cần thêm thông tin. Vui lòng xem và trả lời.",
                ContentEn = "The reception staff needs additional information. Please review and respond.",
                Status = ContentStatus.Published, PublishedAt = DateTime.UtcNow
            }
        };
        db.GuidanceTemplates.AddRange(templates);

        await db.SaveChangesAsync();
    }
}
