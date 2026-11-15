using Hospital.Api.Domain;
using Hospital.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hospital.Tests.Fixtures;

// A historical schema has no LastSeenAt. Do not use the current EF insert model
// to manufacture pre-presence sessions for upgrade tests. Call after saving Patient.
internal static class LegacySessionFixture
{
    public static Task Insert(HospitalDb db, Session session) => db.Database.ExecuteSqlInterpolatedAsync($@"
        INSERT Sessions (Id,Version,CreatedAt,TokenHash,UserAccountId,PatientId,IsGuest,ExpiresAt,Revoked)
        VALUES ({session.Id},{session.Version},{session.CreatedAt},{session.TokenHash},{session.UserAccountId},
                {session.PatientId},{session.IsGuest},{session.ExpiresAt},{session.Revoked})");
}
