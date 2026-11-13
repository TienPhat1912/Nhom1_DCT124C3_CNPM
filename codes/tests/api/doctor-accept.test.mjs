import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance API/database");
let staff, doctor, other, clinic;
async function call(token, path, body, expected = 200, key = randomUUID()) {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", "Idempotency-Key": key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
async function login(name) { return call(null, "/api/auth/login", { email: `${name}@demo.local`, password }); }
async function waiting() {
  const patient = await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB010 fixture", contact: "synthetic-contact", language: "en" });
  const request = await call(patient.token, "/api/v2/requests", { contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  const result = await call(staff.token, `/api/v2/requests/${request.id}/confirm`, { version: request.version, clinicLocationId: clinic.clinicLocationId,
    clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "Synthetic PB010 verification" });
  return { ...result.visit, patient };
}
before(async () => {
  staff = await login("reception"); doctor = await login("doctor"); other = await login("otherdoctor");
  clinic = (await call(staff.token, "/api/v2/reception/clinics")).find(c => c.room === "A101"); assert.ok(clinic);
});
test("role, clinic and exact input validation reject unauthorized commands without mutation", async () => {
  const v = await waiting(); const path = `/api/v2/visits/${v.id}/consultations/accept`;
  await call(v.patient.token, `/api/v2/clinics/${clinic.clinicLocationId}/queue`, undefined, 403);
  await call(other.token, `/api/v2/clinics/${clinic.clinicLocationId}/queue`, undefined, 403);
  await call(staff.token, path, { version: v.version }, 403);
  await call(other.token, path, { version: v.version }, 403);
  for (const body of [{}, { version: "1" }, { version: 0 }, { version: 1, doctorId: randomUUID() }]) await call(doctor.token, path, body, 422);
  await call(doctor.token, path, { version: v.version + 1 }, 409);
  const read = await call(doctor.token, `/api/v2/visits/${v.id}`);
  assert.equal(read.consultationCount, 0); assert.equal(read.latestConsultationCall, null);
  assert.equal(read.capabilities.canAcceptConsultation, true);
});
test("non-FIFO selection, competing Visits and retries produce one consultation/event", async () => {
  const older = await waiting(), newer = await waiting(); const key = randomUUID();
  const path = `/api/v2/visits/${newer.id}/consultations/accept`;
  const result = await call(doctor.token, path, { version: newer.version }, 200, key);
  assert.equal(result.examStatus, "InConsultation"); assert.equal(result.consultationCount, 1);
  assert.equal(result.currentStep.status, "InProgress"); assert.equal(result.currentStep.consultationNumber, 1);
  assert.equal(result.latestConsultationCall.visitId, newer.id);
  assert.deepEqual(result.latestConsultationCall.ticket, newer.ticket);
  const replays = await Promise.all(Array.from({ length: 8 }, () => call(doctor.token, path, { version: newer.version }, 200, key)));
  for (const replay of replays) assert.deepEqual(replay, result);
  await call(doctor.token, path, { version: result.version }, 409, key);
  await call(doctor.token, `/api/v2/visits/${older.id}/consultations/accept`, { version: older.version }, 409);
  const queue = await call(doctor.token, `/api/v2/clinics/${clinic.clinicLocationId}/queue`);
  assert.equal(queue.currentVisitId, newer.id); assert.ok(queue.waiting.some(v => v.id === older.id));
  assert.equal((await call(older.patient.token, `/api/v2/visits/${older.id}`)).capabilities.canAcceptConsultation, false);
  assert.throws(() => fixtureSql(`UPDATE Visits SET ExamStatus='InConsultation' WHERE Id='${older.id}'`));
  // Isolated fixture only: emulate the later examination task releasing this room.
  fixtureSql(`UPDATE Visits SET ExamStatus='Completed' WHERE Id='${newer.id}'`);
});
test("two concurrent commands for two waiting Visits: exactly one commits", async () => {
  const a = await waiting(), b = await waiting();
  const send = async v => {
    const r = await fetch(`${base}/api/v2/visits/${v.id}/consultations/accept`, { method: "POST", headers: {
      "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", Authorization: `Bearer ${doctor.token}`, "Idempotency-Key": randomUUID(),
    }, body: JSON.stringify({ version: v.version }) }); return { status: r.status, value: await r.json() };
  };
  const results = await Promise.all([send(a), send(b)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const winner = results.find(r => r.status === 200).value;
  const read = await call(doctor.token, `/api/v2/visits/${winner.id}`);
  assert.equal(read.latestConsultationCall.id, winner.latestConsultationCall.id);
  const original = read.latestConsultationCall;
  fixtureSql(`UPDATE Visits SET ExamStatus='Waiting' WHERE Id='${winner.id}'; UPDATE JourneyStep SET Status='Ready' WHERE PatientJourneyId='${winner.journeyId}' AND Kind='Consultation';`);
  const again = await call(doctor.token, `/api/v2/visits/${winner.id}/consultations/accept`, { version: read.version });
  assert.equal(again.consultationCount, 2); assert.notEqual(again.latestConsultationCall.id, original.id);
  assert.deepEqual(again.ticket, read.ticket);
  fixtureSql(`UPDATE Visits SET ExamStatus='Completed' WHERE Id='${winner.id}'`);
});

test("failed event persistence rolls back Visit/count/receipt and the same key can retry", async () => {
  const v = await waiting(), key = randomUUID(), path = `/api/v2/visits/${v.id}/consultations/accept`;
  fixtureSql("CREATE TRIGGER PB010_FailEvent ON ConsultationCall AFTER INSERT AS THROW 51012, 'Synthetic event failure', 1;");
  try {
    await call(doctor.token, path, { version: v.version }, 500, key);
    const read = await call(doctor.token, `/api/v2/visits/${v.id}`);
    assert.equal(read.examStatus, "Waiting"); assert.equal(read.consultationCount, 0); assert.equal(read.version, v.version);
    assert.equal(read.latestConsultationCall, null);
  } finally { fixtureSql("DROP TRIGGER PB010_FailEvent"); }
  const success = await call(doctor.token, path, { version: v.version }, 200, key);
  assert.equal(success.consultationCount, 1);
  fixtureSql(`UPDATE Visits SET ExamStatus='Completed' WHERE Id='${v.id}'`);
});

test("receipt replay rechecks current scope after authorization is revoked", async () => {
  const v = await waiting(), key = randomUUID(), path = `/api/v2/visits/${v.id}/consultations/accept`;
  await call(doctor.token, path, { version: v.version }, 200, key);
  fixtureSql(`DELETE FROM StaffScope WHERE UserAccountId='${v.doctorId}' AND DepartmentId='${v.departmentId}'`);
  try {
    await call(doctor.token, path, { version: v.version }, 403, key);
    await call(doctor.token, `/api/v2/clinics/${clinic.clinicLocationId}/queue`, undefined, 403);
  } finally {
    fixtureSql(`INSERT StaffScope (Id,Version,CreatedAt,UserAccountId,DepartmentId) VALUES (NEWID(),1,SYSUTCDATETIME(),'${v.doctorId}','${v.departmentId}'); UPDATE Visits SET ExamStatus='Completed' WHERE Id='${v.id}'`);
  }
});
