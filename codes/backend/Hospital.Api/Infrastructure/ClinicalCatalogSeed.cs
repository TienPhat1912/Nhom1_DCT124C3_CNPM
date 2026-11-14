using Hospital.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Infrastructure;

public static class ClinicalCatalogSeed
{
    public static async Task Run(HospitalDb db, IConfiguration config)
    {
        if (!config.GetValue<bool>("Demo:Enabled") || !config.GetValue<bool>("Workflow:PrdV2Enabled")) return;
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("DECLARE @r int; EXEC @r = sp_getapplock @Resource=N'hospital:clinical-demo-seed', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r < 0 THROW 51017, 'Demo catalog seed busy', 1;");
        // Insert only. Startup must never undo an administrator's edits or retirement.
        if (!await db.Set<SymptomCatalog>().AnyAsync(x => x.Code == "DEMO_SYMPTOM_01"))
            db.Add(new SymptomCatalog { Code = "DEMO_SYMPTOM_01", NameVi = "Triệu chứng minh họa", Kind = "Symptom", Active = true, IsDemo = true });
        if (!await db.Set<SymptomCatalog>().AnyAsync(x => x.Code == "DEMO_SIGN_01"))
            db.Add(new SymptomCatalog { Code = "DEMO_SIGN_01", NameVi = "Dấu hiệu minh họa", Kind = "Sign", Active = true, IsDemo = true });
        if (!await db.Set<DiagnosisCatalog>().AnyAsync(x => x.Code == "DEMO_DIAGNOSIS_01"))
            db.Add(new DiagnosisCatalog { Code = "DEMO_DIAGNOSIS_01", NameVi = "Chẩn đoán minh họa (không dùng lâm sàng)", Active = true, IsDemo = true });
        if (!await db.Set<ClinicalTemplate>().AnyAsync(x => x.Code == "DEMO_TEMPLATE_01"))
            db.Add(new ClinicalTemplate { Code = "DEMO_TEMPLATE_01", NameVi = "Mẫu Việt minh họa", Active = true, IsDemo = true,
                DiagnosisTemplate = "{{diagnoses}}", ExplanationTemplate = "Mẫu minh họa, chưa được bệnh viện phê duyệt. Triệu chứng đã chọn: {{symptoms}}. Dấu hiệu đã chọn: {{signs}}.",
                InstructionsTemplate = "Nội dung minh họa; không sử dụng làm hướng dẫn chăm sóc." });
        await db.SaveChangesAsync(); await tx.CommitAsync();
    }
}
