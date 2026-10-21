using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Hospital.Api.Infrastructure;
public class DesignTimeFactory : IDesignTimeDbContextFactory<HospitalDb>
{
    public HospitalDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<HospitalDb>()
        .UseSqlServer(Environment.GetEnvironmentVariable("ConnectionStrings__Hospital") ?? "Server=localhost,14339;Database=HospitalGuidance;Integrated Security=true;TrustServerCertificate=true").Options);
}
