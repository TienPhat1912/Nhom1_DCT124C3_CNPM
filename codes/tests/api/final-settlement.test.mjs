import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";

const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance API/database");
let reception, doctor, service, cashier, secondCashier, admin, other, clinic, catalog;
async function call(token, path, body, expected = 200, key = randomUUID(), method = body === undefined ? "GET" : "POST") {
  const response = await fetch(base + path, { method, headers: {
    "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", "Idempotency-Key": key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
const route = v => `/api/v2/visits/${v.id}/settlement`;
const input = (v, outcome = "Final") => ({ version: v.version, workRevision: v.workRevision, outcome });
const read = v => call(cashier.token, `/api/v2/visits/${v.id}`);
const queue = () => call(cashier.token, "/api/v2/cashier/visits");
before(async () => {
  const login = name => call(null, "/api/auth/login", { email: `${name}@demo.local`, password });
  reception = await login("reception"); doctor = await login("doctor"); service = await login("service");
  cashier = await login("cashier"); admin = await login("admin"); other = await login("otherdoctor");
  const secondId = randomUUID();
  fixtureSql(`INSERT Users (Id,Version,CreatedAt,Email,PasswordHash,Name,Role,Active)
    SELECT '${secondId}',1,SYSUTCDATETIME(),'cashier2@demo.local',PasswordHash,'Synthetic second cashier','Cashier',1 FROM Users WHERE Email='cashier@demo.local';
    INSERT StaffScope (Id,Version,CreatedAt,UserAccountId,DepartmentId)
    SELECT NEWID(),1,SYSUTCDATETIME(),'${secondId}',DepartmentId FROM StaffScope WHERE UserAccountId=(SELECT Id FROM Users WHERE Email='cashier@demo.local');`);
  secondCashier = await login("cashier2");
  clinic = (await call(reception.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
  catalog = (await call(doctor.token, "/api/v2/order-services")).find(s => s.code === "LAB");
});
async function register(guest = false) {
  const patient = guest
    ? await call(null, "/api/auth/guest", { language: "en" })
    : await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB015 synthetic", contact: "synthetic-contact", language: "en" });
  if (guest) await call(patient.token, "/api/auth/profile", { name: "PB015 Guest", contact: "synthetic-contact", language: "en", version: 1 }, 200, randomUUID(), "PUT");
  const request = await call(patient.token, "/api/v2/requests", { contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  const result = await call(reception.token, `/api/v2/requests/${request.id}/confirm`, { version: request.version, clinicLocationId: clinic.clinicLocationId, clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "PB015 synthetic verification" });
  return { ...result.visit, patient };
}
const accept = v => call(doctor.token, `/api/v2/visits/${v.id}/consultations/accept`, { version: v.version });
async function complete(v) {
  const load = async kind => (await call(doctor.token, `/api/v2/clinical-catalog/${kind}`)).items[0];
  const [diagnosis, template] = await Promise.all([load("diagnoses"), load("templates")]);
  const pick = x => ({ id: x.id, version: x.version });
  const preview = await call(doctor.token, `/api/v2/visits/${v.id}/examination/preview`, {
    version: v.version, symptomSelections: [], signSelections: [], diagnosisSelections: [pick(diagnosis)], template: pick(template),
  });
  return (await call(doctor.token, `/api/v2/visits/${v.id}/examination/complete`, { version: v.version, previewId: preview.previewId })).visit;
}
async function order(v) {
  const body = { version: v.version, serviceId: catalog.id, note: "PB015 synthetic" };
  const preview = await call(doctor.token, `/api/v2/visits/${v.id}/orders/preview`, body);
  return call(doctor.token, `/api/v2/visits/${v.id}/orders`, { ...body, previewId: preview.previewId });
}
async function serviceDone(v) {
  const o = v.orders.at(-1);
  return call(service.token, `/api/v2/visits/${v.id}/orders/${o.id}/complete`, { version: v.version, orderVersion: o.version });
}
async function ready(rounds = 0) {
  const p = await register(); let v = await accept(p);
  for (let i = 0; i < rounds; i++) v = await accept(await serviceDone(await order(v)));
  return { v: await complete(v), patient: p.patient };
}
function closed(done, v, outcome) {
  assert.equal(done.status, "Closed"); assert.equal(done.journeyStatus, "Completed"); assert.equal(done.examStatus, "Completed");
  assert.equal(done.finalSettlementOutcome, outcome); assert.equal(done.finalSettlementRevision, v.workRevision);
  assert.equal(done.workRevision, v.workRevision); assert.deepEqual(done.ticket, v.ticket);
  assert.equal(done.currentStepId, null); assert.equal(done.currentStep, null); assert.equal(done.capabilities.canSettle, false);
  assert.ok(done.version > v.version && done.journeyVersion > v.journeyVersion);
  assert.equal(done.steps.find(s => s.kind === "Settlement").completedAt, done.closedAt);
}

test("permissions, strict input and premature settlement in every examination state", async () => {
  const p = await register();
  for (const token of [doctor.token, service.token, reception.token, admin.token, other.token, p.patient.token]) {
    await call(token, "/api/v2/cashier/visits", undefined, 403);
    await call(token, route(p), input(p), 403);
  }
  await call(null, route(p), input(p), 401);
  for (const outcome of ["Final", "NoPaymentRequired"]) assert.equal((await call(cashier.token, route(p), input(p, outcome), 409)).title, "examinationNotCompleted");
  const v = await accept(p);
  for (const bad of [{ ...input(v), source: "Staff" }, { ...input(v), actorId: randomUUID() }, { ...input(v), outcome: "Intermediate" }, { ...input(v), version: "1" }, { ...input(v), workRevision: 0 }, { version: v.version, outcome: "Final" }]) await call(cashier.token, route(v), bad, 422);
  await call(cashier.token, route(v), input(v), 422, "");
  await call(cashier.token, route(v), input(v), 409);
  const ordered = await order(v);
  await call(cashier.token, route(ordered), input(ordered, "NoPaymentRequired"), 409);
  assert.ok(!(await queue()).some(x => x.id === v.id));
  const done = await complete(await accept(await serviceDone(ordered)));
  await call(cashier.token, route(done), input(done));
});

test("both outcomes close atomically, with zero, one and multiple services; patient reads closure", async () => {
  for (const [rounds, outcome] of [[0, "NoPaymentRequired"], [1, "Final"], [2, "NoPaymentRequired"]]) {
    const { v, patient } = await ready(rounds);
    assert.ok((await queue()).some(x => x.id === v.id)); assert.equal((await read(v)).capabilities.canSettle, true);
    const before = await call(patient.token, `/api/visits/${v.id}`); assert.equal(before.status, "Active");
    assert.ok(before.steps.every(s => s.kind !== "Pharmacy" && !s.canCompleteGuidance));
    const done = await call(cashier.token, route(v), input(v, outcome)); closed(done, v, outcome);
    assert.ok(!(await queue()).some(x => x.id === v.id));
    const patientView = await call(patient.token, `/api/visits/${v.id}`);
    assert.equal(patientView.status, "Closed"); assert.equal(patientView.journeyStatus, "Completed"); assert.equal(patientView.currentStepId, null); assert.match(patientView.closedAt, /Z$/);
    assert.ok(await call(patient.token, `/api/v2/visits/${v.id}/clinical-record`));
    await call(cashier.token, `/api/v2/visits/${v.id}/clinical-record`, undefined, 403);
    assert.match(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM PatientJourney WHERE VisitId='${v.id}' AND CompletedAt=(SELECT ClosedAt FROM Visits WHERE Id='${v.id}') AND CompletionSource='FinalSettlement'`), /\b1\b/);
  }
});

test("scope filtering before pagination and receipt replay; stale versions and revision", async () => {
  const { v } = await ready();
  await call(cashier.token, "/api/v2/cashier/visits?offset=-1", undefined, 422);
  assert.deepEqual(await call(cashier.token, "/api/v2/cashier/visits?offset=10000"), []);
  assert.equal((await call(cashier.token, route(v), { ...input(v), workRevision: v.workRevision + 1 }, 409)).title, "workRevisionConflict");
  assert.equal((await call(cashier.token, route(v), { ...input(v), version: v.version - 1 }, 409)).title, "conflict");
  const actor = fixtureSql("SET NOCOUNT ON; SELECT CONVERT(varchar(36),Id) FROM Users WHERE Email='cashier@demo.local'").match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)[0];
  fixtureSql(`UPDATE StaffScope SET DepartmentId=(SELECT DepartmentId FROM Location WHERE Room='B201') WHERE UserAccountId='${actor}' AND DepartmentId='${v.departmentId}'`);
  try {
    assert.ok(!(await queue()).some(x => x.id === v.id));
    await call(cashier.token, route(v), input(v), 403);
  } finally { fixtureSql(`UPDATE StaffScope SET DepartmentId='${v.departmentId}' WHERE UserAccountId='${actor}' AND DepartmentId=(SELECT DepartmentId FROM Location WHERE Room='B201')`); }
  const key = randomUUID(), done = await call(cashier.token, route(v), input(v), 200, key);
  fixtureSql(`UPDATE StaffScope SET DepartmentId=(SELECT DepartmentId FROM Location WHERE Room='B201') WHERE UserAccountId='${actor}' AND DepartmentId='${v.departmentId}'`);
  try {
    assert.ok(!(await queue()).some(x => x.id === v.id));
    await call(cashier.token, `/api/v2/visits/${v.id}`, undefined, 403);
    await call(cashier.token, route(v), input(v), 403, key);
  } finally { fixtureSql(`UPDATE StaffScope SET DepartmentId='${v.departmentId}' WHERE UserAccountId='${actor}' AND DepartmentId=(SELECT DepartmentId FROM Location WHERE Room='B201')`); }
  assert.deepEqual(await call(cashier.token, route(v), input(v), 200, key), done);
  await call(cashier.token, route(v), input(v, "NoPaymentRequired"), 409, key);
  await call(cashier.token, route(v), input(done, "NoPaymentRequired"), 409);
});

test("rollback includes audit, notification, receipt; retry and concurrent outcomes", async () => {
  const { v } = await ready(), key = randomUUID();
  const notifications = fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM Notification WHERE VisitId='${v.id}'`);
  fixtureSql("CREATE TRIGGER PB015_FailReceipt ON CommandReceipt AFTER INSERT AS THROW 51021, 'Synthetic settlement failure', 1;");
  try {
    await call(cashier.token, route(v), input(v), 500, key);
    const unchanged = await read(v); assert.equal(unchanged.version, v.version); assert.equal(unchanged.status, "Active"); assert.equal(unchanged.finalSettlementOutcome, null);
    assert.equal(unchanged.journeyStatus, "Active"); assert.equal(unchanged.currentStep.status, "Ready");
    assert.equal(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM Notification WHERE VisitId='${v.id}'`), notifications);
    assert.match(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM AuditEvent WHERE VisitId='${v.id}' AND Type IN ('SettlementFinal','VisitClosed'); SELECT COUNT(*) FROM CommandReceipt WHERE [Key]='${key}'`), /0[\s-]+0\s*$/);
  } finally { fixtureSql("DROP TRIGGER PB015_FailReceipt"); }
  const done = await call(cashier.token, route(v), input(v), 200, key); closed(done, v, "Final");
  for (const replay of await Promise.all(Array.from({ length: 4 }, () => call(cashier.token, route(v), input(v), 200, key)))) assert.deepEqual(replay, done);
  const second = (await ready()).v;
  const send = async (outcome, token) => {
    const response = await fetch(base + route(second), { method: "POST", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", Authorization: `Bearer ${token}`, "Idempotency-Key": randomUUID() }, body: JSON.stringify(input(second, outcome)) }); return response.status;
  };
  assert.deepEqual((await Promise.all([send("Final", cashier.token), send("NoPaymentRequired", secondCashier.token)])).sort(), [200, 409]);
  assert.match(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM AuditEvent WHERE VisitId='${second.id}' AND Type='VisitClosed'`), /\b1\b/);
});

test("inconsistent records and skipped services are never treated as completed", async () => {
  const { v } = await ready(1), serviceStep = v.steps.find(s => s.kind === "Service");
  for (const state of ["Skipped", "Cancelled"]) {
    fixtureSql(`UPDATE JourneyStep SET Status='${state}' WHERE Id='${serviceStep.id}'`);
    try {
      assert.equal((await read(v)).capabilities.canSettle, false); assert.ok(!(await queue()).some(x => x.id === v.id));
      assert.equal((await call(cashier.token, route(v), input(v), 409)).title, "servicesNotCompleted");
    } finally { fixtureSql(`UPDATE JourneyStep SET Status='Completed' WHERE Id='${serviceStep.id}'`); }
  }
  fixtureSql(`UPDATE DoctorOrder SET Status='NotCompleted' WHERE Id='${v.orders[0].id}'`);
  try { await call(cashier.token, route(v), input(v), 409); }
  finally { fixtureSql(`UPDATE DoctorOrder SET Status='Completed' WHERE Id='${v.orders[0].id}'`); }
  fixtureSql(`UPDATE Visits SET ExaminationCompletedAt=NULL WHERE Id='${v.id}'`);
  try { assert.ok(!(await queue()).some(x => x.id === v.id)); await call(cashier.token, route(v), input(v), 409); }
  finally { fixtureSql(`UPDATE Visits SET ExaminationCompletedAt='${v.examinationCompletedAt}' WHERE Id='${v.id}'`); }
  const unconfirmed = await register();
  fixtureSql(`UPDATE ClinicalRecord SET VisitId='${unconfirmed.id}' WHERE VisitId='${v.id}'`);
  try {
    assert.ok(!(await queue()).some(x => x.id === v.id));
    assert.equal((await call(cashier.token, route(v), input(v), 409)).title, "examinationNotCompleted");
  } finally { fixtureSql(`UPDATE ClinicalRecord SET VisitId='${v.id}' WHERE VisitId='${unconfirmed.id}'`); }
  const consultation = v.steps.find(s => s.kind === "Consultation");
  fixtureSql(`UPDATE JourneyStep SET Kind='Pharmacy' WHERE Id='${consultation.id}'`);
  try { assert.ok(!(await queue()).some(x => x.id === v.id)); await call(cashier.token, route(v), input(v), 409); }
  finally { fixtureSql(`UPDATE JourneyStep SET Kind='Consultation' WHERE Id='${consultation.id}'`); }
  await call(cashier.token, route(v), input(v));
});

test("legacy endpoints and old receipts cannot complete V2; Guest reads final status", async () => {
  const p = await register(true), v = await complete(await accept(p));
  const cashierId = fixtureSql("SET NOCOUNT ON; SELECT CONVERT(varchar(36),Id) FROM Users WHERE Email='cashier@demo.local'").match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)[0].toLowerCase();
  for (const [token, path, body, scope] of [
    [cashier.token, `/api/visits/${v.id}/settlement`, { outcome: "Final", workRevision: v.workRevision, version: v.version, source: "Staff" }, `${cashierId}:settlement:${v.id}`],
    [cashier.token, `/api/visits/${v.id}/settlement`, { outcome: "Intermediate", workRevision: v.workRevision, version: v.version, source: "Staff" }, `${cashierId}:settlement:${v.id}`],
    [doctor.token, `/api/visits/${v.id}/pharmacy`, { required: true, version: v.version }, `${v.doctorId}:pharmacy:${v.id}`],
    [p.patient.token, `/api/visits/${v.id}/complete-guidance`, { version: v.journeyVersion }, `${p.patient.sessionId}:complete:${v.id}`],
  ]) {
    const key = randomUUID(), hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").toUpperCase();
    fixtureSql(`INSERT INTO CommandReceipt (Id,Version,CreatedAt,Scope,[Key],RequestHash,ResponseJson) VALUES (NEWID(),1,SYSUTCDATETIME(),'${scope}','${key}','${hash}',CHAR(123)+CHAR(125))`);
    await call(token, path, body, 410, key);
  }
  const done = await call(cashier.token, route(v), input(v, "NoPaymentRequired")); closed(done, v, "NoPaymentRequired");
  const patientView = await call(p.patient.token, `/api/visits/${v.id}`);
  assert.equal(patientView.journeyStatus, "Completed"); assert.ok(patientView.steps.every(s => !s.canCompleteGuidance));
  await call(p.patient.token, `/api/visits/${v.id}/complete-guidance`, { version: done.journeyVersion }, 410);
});
