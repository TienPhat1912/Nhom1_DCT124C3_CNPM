import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance API/database");
let reception, doctor, service, other, clinic, catalog, serviceActorId, otherActorId;
async function call(token, path, body, expected = 200, key = randomUUID()) {
  const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: {
    "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", "Idempotency-Key": key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
const read = v => call(doctor.token, `/api/v2/visits/${v.id}`);
const queue = () => call(doctor.token, `/api/v2/clinics/${clinic.clinicLocationId}/queue`);
const path = v => `/api/v2/visits/${v.id}/orders/${v.orders.at(-1).id}/complete`;
const input = v => ({ version: v.version, orderVersion: v.orders.at(-1).version });
const count = query => Number([...fixtureSql(`SET NOCOUNT ON; ${query}`).matchAll(/^\s*(\d+)\s*$/gm)].at(-1)[1]);
async function register() {
  const patient = await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB012 synthetic", contact: "synthetic-contact", language: "en" });
  const request = await call(patient.token, "/api/v2/requests", { contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  const result = await call(reception.token, `/api/v2/requests/${request.id}/confirm`, { version: request.version, clinicLocationId: clinic.clinicLocationId, clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "PB012 synthetic verification" });
  return { ...result.visit, patient };
}
async function order(v) {
  const accepted = await call(doctor.token, `/api/v2/visits/${v.id}/consultations/accept`, { version: v.version });
  const preview = await call(doctor.token, `/api/v2/visits/${v.id}/orders/preview`, { version: accepted.version, serviceId: catalog.id, note: "PB012 instruction" });
  return call(doctor.token, `/api/v2/visits/${v.id}/orders`, { version: accepted.version, serviceId: catalog.id, note: preview.note, previewId: preview.previewId });
}
before(async () => {
  const login = name => call(null, "/api/auth/login", { email: `${name}@demo.local`, password });
  reception = await login("reception"); doctor = await login("doctor"); service = await login("service"); other = await login("otherdoctor");
  const actorId = email => fixtureSql(`SELECT CONVERT(varchar(36),Id) FROM Users WHERE Email='${email}'`).match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)[0];
  serviceActorId = actorId("service@demo.local"); otherActorId = actorId("otherdoctor@demo.local");
  clinic = (await call(reception.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
  catalog = (await call(doctor.token, "/api/v2/order-services")).find(s => s.code === "LAB");
});

test("service completion is scoped, validates versions/payload, and rechecks scope before receipt replay", async () => {
  const patient = await register(), v = await order(patient), endpoint = path(v), data = input(v), key = randomUUID();
  for (const token of [doctor.token, reception.token, other.token, patient.patient.token]) await call(token, endpoint, data, 403);
  for (const bad of [{}, { ...data, result: "forbidden" }, { ...data, version: "1" }, { ...data, orderVersion: null }, { ...data, orderVersion: 0 }]) await call(service.token, endpoint, bad, 422);
  await call(service.token, endpoint, { ...data, version: v.version - 1 }, 409);
  await call(service.token, endpoint, { ...data, orderVersion: 99 }, 409);
  await call(service.token, `/api/v2/visits/${v.id}/orders/${randomUUID()}/complete`, data, 404);
  const waiting = await register();
  await call(service.token, `/api/v2/visits/${waiting.id}/orders/${v.orders[0].id}/complete`, data, 404);
  const detail = await call(service.token, `/api/v2/visits/${v.id}`); assert.equal(detail.capabilities.canCompleteService, true);
  const rows = await call(service.token, "/api/v2/service/orders"); assert.ok(rows.some(r => r.order.id === v.orders[0].id && r.canComplete));
  await call(doctor.token, "/api/v2/service/orders", undefined, 403);
  await call(service.token, "/api/v2/service/orders?status=Resolved", undefined, 422);
  await call(service.token, "/api/v2/service/orders?offset=-1", undefined, 422);
  const scope = fixtureSql(`SELECT CONVERT(varchar(36),Id) FROM StaffScope WHERE UserAccountId='${serviceActorId}' AND DepartmentId='${v.orders[0].destinationSnapshot.departmentId}'`).match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)?.[0];
  assert.ok(scope);
  fixtureSql(`UPDATE StaffScope SET UserAccountId='${otherActorId}' WHERE Id='${scope}'`);
  try {
    await call(service.token, endpoint, data, 403, key);
    assert.ok(!(await call(service.token, "/api/v2/service/orders")).some(r => r.visitId === v.id));
  } finally { fixtureSql(`UPDATE StaffScope SET UserAccountId='${serviceActorId}' WHERE Id='${scope}'`); }
  const completed = await call(service.token, endpoint, data, 200, key);
  assert.equal(completed.orders[0].completedBy.id.toLowerCase(), serviceActorId.toLowerCase()); assert.match(completed.orders[0].completedAt, /Z$/);
  assert.equal(completed.capabilities.canCompleteService, false);
  assert.deepEqual(await call(service.token, endpoint, data, 200, key), completed);
  await call(service.token, endpoint, { ...data, version: completed.version }, 409, key);
  assert.equal((await call(service.token, endpoint, input(completed), 409)).title, "orderAlreadyCompleted");
  fixtureSql(`UPDATE StaffScope SET UserAccountId='${otherActorId}' WHERE Id='${scope}'`);
  try { await call(service.token, endpoint, data, 403, key); }
  finally { fixtureSql(`UPDATE StaffScope SET UserAccountId='${serviceActorId}' WHERE Id='${scope}'`); }
});

test("A completes while B is consulting: only original queue changes; second service requires reacceptance", async () => {
  const a = await order(await register()), b = await register();
  const currentB = await call(doctor.token, `/api/v2/visits/${b.id}/consultations/accept`, { version: b.version });
  const done = await call(service.token, path(a), input(a));
  assert.equal(done.examStatus, "Waiting"); assert.equal(done.status, "Active"); assert.equal(done.journeyStatus, "Active");
  assert.equal(done.currentStep.kind, "ReturnConsultation"); assert.equal(done.currentStep.status, "Ready");
  assert.deepEqual(done.currentStep.destination, a.clinic); assert.deepEqual(done.ticket, a.ticket);
  assert.equal(done.doctorId, a.doctorId); assert.equal(done.clinicLocationId, a.clinicLocationId);
  assert.equal(done.consultationCount, a.consultationCount); assert.equal(done.workRevision, a.workRevision);
  assert.equal(done.latestConsultationCall.id, a.latestConsultationCall.id);
  const q = await queue(); assert.equal(q.currentVisitId, b.id); assert.ok(q.waiting.some(r => r.id === a.id));
  assert.ok(!q.inService.some(r => r.id === a.id)); const afterB = await read(b); assert.deepEqual({ ...afterB, updatedAt: currentB.updatedAt }, currentB);
  assert.equal((await read(a)).capabilities.canConfirmOrder, false);
  await call(doctor.token, `/api/v2/visits/${a.id}/orders/preview`, { version: done.version, serviceId: catalog.id, note: "" }, 409);
  await call(doctor.token, `/api/v2/visits/${a.id}/consultations/accept`, { version: done.version }, 409);
  // Release B through the real order flow, preserving its history.
  const p = await call(doctor.token, `/api/v2/visits/${b.id}/orders/preview`, { version: currentB.version, serviceId: catalog.id, note: "B release" });
  await call(doctor.token, `/api/v2/visits/${b.id}/orders`, { version: currentB.version, serviceId: catalog.id, note: p.note, previewId: p.previewId });
  const second = await order(done);
  assert.equal(second.consultationCount, 2); assert.equal(second.orders.length, 2);
  const final = await call(service.token, path(second), input(second));
  assert.equal(final.examStatus, "Waiting"); assert.equal(final.steps.filter(s => s.kind === "ReturnConsultation").length, 2);
  assert.equal(final.steps.filter(s => s.kind === "ReturnConsultation" && s.status === "Ready").length, 1);
  assert.ok(final.orders.every(o => o.status === "Completed"));
  assert.deepEqual(final.ticket, a.ticket); assert.equal(final.currentStep.destination.id, a.clinicLocationId);
});

test("concurrent completion and repeated retries create one return, audit and notification", async () => {
  const v = await order(await register()), key = randomUUID();
  const notifications = count(`SELECT COUNT(*) FROM Notification WHERE VisitId='${v.id}'`);
  const responses = await Promise.all(Array.from({ length: 6 }, () => call(service.token, path(v), input(v), 200, key)));
  for (const value of responses) assert.deepEqual(value, responses[0]);
  assert.equal((await read(v)).steps.filter(s => s.kind === "ReturnConsultation").length, 1);
  assert.equal(count(`SELECT COUNT(*) FROM Notification WHERE VisitId='${v.id}'`), notifications + 1);
  const next = await order(await register());
  const send = async () => {
    const response = await fetch(base + path(next), { method: "POST", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", "Idempotency-Key": randomUUID(), Authorization: `Bearer ${service.token}` }, body: JSON.stringify(input(next)) });
    return response.status;
  };
  assert.deepEqual((await Promise.all([send(), send()])).sort(), [200, 409]);
  assert.equal((await read(next)).steps.filter(s => s.kind === "ReturnConsultation").length, 1);
  const counts = fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM AuditEvent WHERE VisitId='${v.id}' AND Type='ServiceCompleted'; SELECT COUNT(*) FROM JourneyStep WHERE PatientJourneyId='${v.journeyId}' AND Kind='ReturnConsultation'`);
  assert.equal((counts.match(/^\s*1\s*$/gm) ?? []).length, 2);
});

test("failure during return insertion rolls back order, step, Visit, events and receipt; same key recovers", async () => {
  const v = await order(await register()), key = randomUUID();
  const notifications = count(`SELECT COUNT(*) FROM Notification WHERE VisitId='${v.id}'`);
  fixtureSql("CREATE TRIGGER PB012_FailReturn ON JourneyStep AFTER INSERT AS IF EXISTS(SELECT 1 FROM inserted WHERE Kind='ReturnConsultation') THROW 51016, 'Synthetic return failure', 1;");
  try {
    await call(service.token, path(v), input(v), 500, key);
    const after = await read(v); assert.equal(after.version, v.version); assert.equal(after.journeyVersion, v.journeyVersion);
    assert.equal(after.examStatus, "InService"); assert.deepEqual(after.orders, v.orders); assert.deepEqual(after.steps, v.steps);
    assert.match(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM AuditEvent WHERE VisitId='${v.id}' AND Type='ServiceCompleted'`), /\b0\b/);
    assert.equal(count(`SELECT COUNT(*) FROM Notification WHERE VisitId='${v.id}'`), notifications);
    assert.equal(count(`SELECT COUNT(*) FROM CommandReceipt WHERE [Key]='${key}'`), 0);
  } finally { fixtureSql("DROP TRIGGER PB012_FailReturn"); }
  const result = await call(service.token, path(v), input(v), 200, key);
  assert.equal(result.currentStep.kind, "ReturnConsultation");
  assert.deepEqual(await call(service.token, path(v), input(v), 200, key), result);
});

test("closed Visit, completed Journey, wrong exam state and unready step cannot complete", async () => {
  const v = await order(await register());
  for (const [change, restore] of [
    [`UPDATE Visits SET Status='Closed' WHERE Id='${v.id}'`, `UPDATE Visits SET Status='Active' WHERE Id='${v.id}'`],
    [`UPDATE PatientJourney SET Status='Completed' WHERE Id='${v.journeyId}'`, `UPDATE PatientJourney SET Status='Active' WHERE Id='${v.journeyId}'`],
    [`UPDATE Visits SET ExamStatus='Waiting' WHERE Id='${v.id}'`, `UPDATE Visits SET ExamStatus='InService' WHERE Id='${v.id}'`],
    [`UPDATE JourneyStep SET Status='Waiting' WHERE Id='${v.currentStepId}'`, `UPDATE JourneyStep SET Status='Ready' WHERE Id='${v.currentStepId}'`],
  ]) {
    fixtureSql(change);
    try { assert.equal((await call(service.token, path(v), input(v), 409)).title, "requestLocked"); }
    finally { fixtureSql(restore); }
    const after = await read(v); assert.equal(after.version, v.version); assert.deepEqual(after.orders, v.orders);
  }
  await call(service.token, path(v), input(v));
});

test("return uses original snapshots despite catalog changes; completed list preserves provenance", async () => {
  const v = await order(await register());
  fixtureSql(`UPDATE Location SET Room=N'PB012-renamed', Version=Version+1 WHERE Id='${v.clinicLocationId}'; UPDATE HospitalService SET ReturnRequired=0, Version=Version+1 WHERE Id='${catalog.id}'`);
  let done;
  try { done = await call(service.token, path(v), input(v)); }
  finally { fixtureSql(`UPDATE Location SET Room=N'A101', Version=Version+1 WHERE Id='${v.clinicLocationId}'; UPDATE HospitalService SET ReturnRequired=1, Version=Version+1 WHERE Id='${catalog.id}'`); }
  assert.deepEqual(done.currentStep.destination, v.clinic); assert.deepEqual(done.ticket, v.ticket);
  const rows = await call(service.token, "/api/v2/service/orders?status=Completed");
  const row = rows.find(r => r.visitId === v.id); assert.equal(row.order.completedBy.id.toLowerCase(), serviceActorId.toLowerCase());
  assert.equal(row.canComplete, false); assert.equal(row.order.status, "Completed"); assert.equal(row.order.completedAt, done.orders[0].completedAt);
});
