using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital.Api.Migrations
{
    /// <inheritdoc />
    public partial class SessionPresence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeenAt",
                table: "Sessions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_LastSeenAt",
                table: "Sessions",
                column: "LastSeenAt",
                filter: "[LastSeenAt] IS NOT NULL")
                .Annotation("SqlServer:Include", new[] { "IsGuest", "UserAccountId", "ExpiresAt", "Revoked" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Sessions_LastSeenAt",
                table: "Sessions");

            migrationBuilder.DropColumn(
                name: "LastSeenAt",
                table: "Sessions");
        }
    }
}
