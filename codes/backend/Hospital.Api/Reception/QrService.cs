using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Api.Reception;
public class QrService(HospitalDb db, IDataProtectionProvider protection, IConfiguration config)
{
    readonly IDataProtector protector = protection.CreateProtector("Hospital.QR.v1");
    public QrCode Create(string purpose, Guid target)
    {
        var token = Crypto.Token();
        var qr = new QrCode { Hash = Crypto.Hash(token), ProtectedToken = protector.Protect(token), Purpose = purpose,
            RegistrationRequestId = purpose == "Reception" ? target : null, ExaminationTicketId = purpose == "Ticket" ? target : null,
            ExpiresAt = DateTime.UtcNow.AddHours(config.GetValue<int>("Access:QrHours", 24)) };
        db.Add(qr); return qr;
    }
    public string Reveal(QrCode qr) => protector.Unprotect(qr.ProtectedToken);
    public async Task<QrCode> Validate(string token, string purpose)
    {
        var hash = Crypto.Hash(Check.Text(token, "code", 20, 200));
        var qr = await db.Set<QrCode>().SingleOrDefaultAsync(q => q.Hash == hash);
        Check.That(qr is not null && qr.Purpose == purpose, "qrPurpose", "Invalid QR code or wrong purpose.");
        Check.That(qr!.Status == "Active", "qrReplaced", "This code has been replaced. Ask reception for the current ticket.", 410);
        Check.That(qr.ExpiresAt > DateTime.UtcNow, "qrExpired", "This code expired. Ask reception for verified recovery.", 410);
        return qr;
    }
    public async Task<QrCode> Current(string purpose, Guid target)
    {
        return await db.Set<QrCode>().Where(q => q.Purpose == purpose && q.Status == "Active" && (q.RegistrationRequestId == target || q.ExaminationTicketId == target))
            .OrderByDescending(q => q.CreatedAt).FirstAsync();
    }
    public async Task<QrCode> Replace(string purpose, Guid target)
    {
        foreach (var q in await db.Set<QrCode>().Where(q => q.Purpose == purpose && q.Status == "Active" && (q.RegistrationRequestId == target || q.ExaminationTicketId == target)).ToListAsync()) q.Status = "Replaced";
        return Create(purpose, target);
    }
}
