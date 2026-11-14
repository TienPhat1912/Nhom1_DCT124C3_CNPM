import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance API/database");
let staff, doctor, other, serviceRole, clinic, service;
async function call(token, path, body, expected = 200, key = randomUUID(), method = body === undefined ? "GET" : "POST") {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native",
    "Idempotency-Key": key, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await r.json(); assert.equal(r.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
async function setup(accept = true) {
  const patient = await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB011 fixture", contact: "synthetic-contact", language: "en" });
  const request = await call(patient.token, "/api/v2/requests", { contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  const confirmation = await call(staff.token, `/api/v2/requests/${request.id}/confirm`, { version: request.version, clinicLocationId: clinic.clinicLocationId,
    clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "Synthetic PB011 verification" });
  const visit = accept ? await call(doctor.token, `/api/v2/visits/${confirmation.visit.id}/consultations/accept`, { version: confirmation.visit.version }) : confirmation.visit;
  return { ...visit, patient };
}
async function preview(v, serviceId = service.id) {
  return call(doctor.token, `/api/v2/visits/${v.id}/orders/preview`, { version: v.version, serviceId, note: "Synthetic note" });
}
const body = (v, p) => ({ version: v.version, serviceId: p.service.id, note: p.note, previewId: p.previewId });
const read = v => call(doctor.token, `/api/v2/visits/${v.id}`);
before(async () => {
  const login = name => call(null, "/api/auth/login", { email: `${name}@demo.local`, password });
  staff = await login("reception"); doctor = await login("doctor"); other = await login("otherdoctor"); serviceRole = await login("service");
  clinic = (await call(staff.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
  service = (await call(doctor.token, "/api/v2/order-services")).find(s => s.code === "LAB");
});
test("preview does not create an order or release the clinic; confirm requires bound preview and correct role", async () => {
  const v = await setup(), p = await preview(v), path = `/api/v2/visits/${v.id}/orders`;
  const unchanged = await read(v); assert.equal(unchanged.version, v.version); assert.equal(unchanged.orders.length, 0);
  assert.equal(unchanged.examStatus, "InConsultation");
  await call(other.token, path, body(v, p), 403); await call(v.patient.token, path, body(v, p), 403);
  await call(doctor.token, path, { version: v.version, serviceId: service.id, note: "" }, 422);
  await call(doctor.token, path, { ...body(v, p), status: "Completed" }, 422);
  await call(doctor.token, path, { ...body(v, p), previewId: randomUUID() }, 409);
  await call(doctor.token, path, { ...body(v, p), note: "Changed after review" }, 409);
  await call(doctor.token, path, body(v, p));
});
test("single-order race and key replay create one immutable order and release the room", async () => {
  const v = await setup(), p = await preview(v), path = `/api/v2/visits/${v.id}/orders`, key = randomUUID();
  const send = async eventKey => {
    const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", Authorization: `Bearer ${doctor.token}`, "Idempotency-Key": eventKey }, body: JSON.stringify(body(v, p)) });
    return { status: r.status, value: await r.json() };
  };
  const [a, b] = await Promise.all([send(key), send(randomUUID())]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const winner = a.status === 200 ? a : b;
  const result = winner.value; assert.equal(result.orders.length, 1); assert.equal(result.orders[0].status, "NotCompleted");
  assert.equal(result.examStatus, "InService"); assert.equal(result.workRevision, v.workRevision + 1);
  assert.equal(result.currentStep.kind, "Service"); assert.equal(result.currentStep.status, "Ready");
  assert.equal(result.steps.find(s => s.id === v.currentStepId).status, "Completed");
  assert.equal(result.orders[0].consultationNumber, v.consultationCount); assert.deepEqual(result.ticket, v.ticket);
  if (a.status === 200) assert.deepEqual(await call(doctor.token, path, body(v, p), 200, key), result);
  const replayKey = randomUUID(), next = await setup(), nextPreview = await preview(next);
  const committed = await call(doctor.token, `/api/v2/visits/${next.id}/orders`, body(next, nextPreview), 200, replayKey);
  const replays = await Promise.all(Array.from({ length: 6 }, () => call(doctor.token, `/api/v2/visits/${next.id}/orders`, body(next, nextPreview), 200, replayKey)));
  for (const replay of replays) assert.deepEqual(replay, committed);
  const queue = await call(doctor.token, `/api/v2/clinics/${clinic.clinicLocationId}/queue`);
  assert.equal(queue.currentVisitId, null); assert.ok(!queue.waiting.some(row => row.id === v.id || row.id === next.id));
  assert.throws(() => fixtureSql(`INSERT DoctorOrder (Id,Version,CreatedAt,VisitId,HospitalServiceId,OrderedBy,Status,Note,MappingVersion,ConsultationNumber,ServiceSnapshot,DestinationSnapshot,OrderedBySnapshot) SELECT NEWID(),1,SYSUTCDATETIME(),VisitId,HospitalServiceId,OrderedBy,Status,Note,MappingVersion,ConsultationNumber,ServiceSnapshot,DestinationSnapshot,OrderedBySnapshot FROM DoctorOrder WHERE Id='${result.orders[0].id}'`));
});
test("legacy update/cancel/progress/skip cannot mutate a confirmed V2 order", async () => {
  const v = await setup(), p = await preview(v);
  const result = await call(doctor.token, `/api/v2/visits/${v.id}/orders`, body(v, p));
  const order = result.orders[0], step = result.currentStep;
  for (const action of ["Update", "Cancel"]) await call(doctor.token, `/api/visits/${v.id}/orders/${order.id}`, { action, serviceId: service.id, reason: "Bypass attempt", version: order.version }, 410, randomUUID(), "PUT");
  for (const status of ["Skipped", "Completed"]) await call(serviceRole.token, `/api/visits/${v.id}/steps/${step.id}/progress`, { status, reason: "Bypass attempt", version: step.version }, 410);
  const after = await read(v); assert.deepEqual(after.orders, result.orders); assert.equal(after.currentStep.kind, "Service");
  fixtureSql(`UPDATE HospitalService SET NameVi=NameVi+N' revised',Version=Version+1 WHERE Id='${service.id}'; UPDATE Location SET Room=N'PB011-RENAMED',Version=Version+1 WHERE Id='${order.destinationSnapshot.id}'`);
  assert.deepEqual((await read(v)).orders, result.orders, "Catalog edits must not rewrite confirmed snapshots");
});
test("configuration versions, expiry and inactive destination invalidate a preview without mutations", async () => {
  const v = await setup();
  for (const change of [
    p => `UPDATE HospitalService SET Version=Version+1 WHERE Id='${p.service.id}'`,
    p => `UPDATE HospitalService SET NameVi=NameVi+N' edited',Version=Version+1 WHERE Id='${p.service.id}'`,
    p => `UPDATE Location SET Version=Version+1 WHERE Id='${p.destination.id}'`,
    p => `UPDATE Location SET Room=Room+N'X',Version=Version+1 WHERE Id='${p.destination.id}'`,
    p => `UPDATE Department SET Version=Version+1 WHERE Id='${p.destination.departmentId}'`,
    p => `UPDATE WorkflowMapping SET Version=Version+1 WHERE HospitalServiceId='${p.service.id}'`,
    () => "UPDATE GuidanceTemplate SET Version=Version+1 WHERE [Key]='laboratory' AND Language='vi'",
    p => `UPDATE OrderPreview SET ExpiresAt=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id='${p.previewId}'`,
  ]) {
    const p = await preview(v); fixtureSql(change(p));
    await call(doctor.token, `/api/v2/visits/${v.id}/orders`, body(v, p), 409);
    assert.equal((await read(v)).orders.length, 0);
  }
  const p = await preview(v); fixtureSql(`UPDATE Location SET Active=0 WHERE Id='${p.destination.id}'`);
  try { await call(doctor.token, `/api/v2/visits/${v.id}/orders`, body(v, p), 409); }
  finally { fixtureSql(`UPDATE Location SET Active=1 WHERE Id='${p.destination.id}'`); }
  assert.equal((await read(v)).version, v.version);
  const fresh = await preview(v); await call(doctor.token, `/api/v2/visits/${v.id}/orders`, body(v, fresh));
});
test("write failure rolls back order/steps/Visit and retry commits once", async () => {
  const v = await setup(), p = await preview(v), key = randomUUID(), path = `/api/v2/visits/${v.id}/orders`;
  fixtureSql("CREATE TRIGGER PB011_FailOrder ON DoctorOrder AFTER INSERT AS THROW 51015, 'Synthetic order failure', 1;");
  try {
    await call(doctor.token, path, body(v, p), 500, key);
    const after = await read(v); assert.equal(after.examStatus, "InConsultation"); assert.equal(after.orders.length, 0);
    assert.equal(after.version, v.version); assert.equal(after.currentStep.status, "InProgress");
  } finally { fixtureSql("DROP TRIGGER PB011_FailOrder"); }
  const result = await call(doctor.token, path, body(v, p), 200, key);
  assert.deepEqual(await call(doctor.token, path, body(v, p), 200, key), result);
});
test("waiting and InService cannot order; payload/preview cannot be reused for another Visit", async () => {
  const waiting = await setup(false); await call(doctor.token, `/api/v2/visits/${waiting.id}/orders/preview`, { version: waiting.version, serviceId: service.id, note: "" }, 409);
  const v = await setup(), p = await preview(v); const key = randomUUID(), path = `/api/v2/visits/${v.id}/orders`;
  const result = await call(doctor.token, path, body(v, p), 200, key);
  await call(doctor.token, path, { ...body(v, p), note: "changed" }, 409, key);
  await call(doctor.token, path, { ...body(v, p), version: result.version }, 409);
  const next = await setup();
  await call(doctor.token, `/api/v2/visits/${next.id}/orders`, body(next, p), 409);
  const fresh = await preview(next); await call(doctor.token, `/api/v2/visits/${next.id}/orders`, body(next, fresh));
});
