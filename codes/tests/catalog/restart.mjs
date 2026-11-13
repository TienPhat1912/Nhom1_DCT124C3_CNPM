import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { call, login, fixtureSql, scalar } from "./assignment-fixture.mjs";

const admin = await login();
const snapshotFile = process.env.PB005_SNAPSHOT;
assert.ok(snapshotFile);
const assignments = await call(admin.token, "/api/v2/admin/clinics");
const persistent = fixtureSql(`SET NOCOUNT ON;
  SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id,Version,ClinicLocationId,ActiveDoctorId)) FROM ClinicRoom;
  SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id,Version,ClinicLocationId,DoctorId)) FROM ClinicDoctor;
  SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id,Version,Email,PasswordHash,Name,Role,Active)) FROM Users;
  SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id,Version,UserAccountId,DepartmentId)) FROM StaffScope;
  SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id,Version,DoctorId,ClinicLocationId,Status,ExamStatus)) FROM Visits;
  SELECT CHECKSUM_AGG(BINARY_CHECKSUM(Id,ActorId,CreatedAt,Detail)) FROM AuditEvent WHERE Type IN ('ClinicDoctorsConfigured','ClinicActiveDoctorConfigured');`).trim();
const snapshot = { assignments, persistent };
assert.equal(
  scalar("SELECT COUNT(*) FROM AuditEvent WHERE Source='Catalog'"),
  1,
);
switch (process.argv[2]) {
  case "capture":
    writeFileSync(snapshotFile, JSON.stringify(snapshot));
    break;
  case "verify":
    assert.deepEqual(snapshot, JSON.parse(readFileSync(snapshotFile, "utf8")));
    console.log(
      "PASS restart/import preserved assignments, versions, accounts, scopes, Visits and assignment audit",
    );
    break;
  case "reimport":
    fixtureSql("DELETE FROM AuditEvent WHERE Source='Catalog';");
    break;
  default:
    throw new Error("Expected capture, verify or reimport");
}
