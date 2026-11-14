import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance API/database");
let reception, doctor, service, other, clinic, catalog;
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
  clinic = (await call(reception.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
  catalog = (await call(doctor.token, "/api/v2/order-services")).find(s => s.code === "LAB");
});
async function choices(v) {
  const load = async kind => (await call(doctor.token, `/api/v2/clinical-catalog/${kind}`)).items[0];
  const [symptom, sign, diagnosis, template] = await Promise.all([load("symptoms"), load("signs"), load("diagnoses"), load("templates")]);
  const pick = x => ({ id: x.id, version: x.version });
  return { version: v.version, symptomSelections: [pick(symptom)], signSelections: [pick(sign)], diagnosisSelections: [pick(diagnosis)], template: pick(template) };
}
const accept = v => call(doctor.token, `/api/v2/visits/${v.id}/consultations/accept`, { version: v.version });
const previewPath = v => `/api/v2/visits/${v.id}/examination/preview`;
const completePath = v => `/api/v2/visits/${v.id}/examination/complete`;
const recordPath = v => `/api/v2/visits/${v.id}/clinical-record`;
test("preview guards, privacy, catalog validation and legacy bypass protection", async () => {
  const p = await register(), selection = await choices(p);
  await call(doctor.token, previewPath(p), selection, 409);
  const v = await accept(p), data = await choices(v);
  for (const token of [other.token, service.token, reception.token, p.patient.token]) await call(token, previewPath(v), data, 403);
  for (const bad of [{ ...data, diagnosisSelections: [] }, { ...data, arbitrary: true }, { ...data, version: "1" }, { ...data, symptomSelections: [data.symptomSelections[0], data.symptomSelections[0]] }]) await call(doctor.token, previewPath(v), bad, 422);
  await call(doctor.token, previewPath(v), { ...data, signSelections: data.symptomSelections }, 409);
  const before = await read(v), preview = await call(doctor.token, previewPath(v), data);
  for (const token of [other.token, service.token, reception.token, p.patient.token]) await call(token, completePath(v), { version: v.version, previewId: preview.previewId }, 403);
  assert.equal((await read(v)).version, before.version);
  assert.equal(await call(p.patient.token, recordPath(v)), null);
  assert.equal((await call(p.patient.token, `/api/visits/${v.id}/content`)).summary, null);
  await call(service.token, recordPath(v), undefined, 403);
  await call(doctor.token, `/api/visits/${v.id}/drafts`, {}, 410);
  await call(doctor.token, `/api/visits/${v.id}/drafts/${randomUUID()}/publish`, { version: 1, reviewed: true }, 410);
  await call(doctor.token, completePath(v), { version: v.version, previewId: "tampered" }, 409);
  await call(doctor.token, completePath(v), { version: v.version, previewId: preview.previewId, diagnosis: "forged" }, 422);
  // Release this clinic through the real completion path.
  await call(doctor.token, completePath(v), { version: v.version, previewId: preview.previewId });
});
test("stale preview detects version/content/active changes and cannot cross Visits", async () => {
  const p = await register(), v = await accept(p), data = await choices(v);
  for (const mutation of [
    `UPDATE ClinicalTemplate SET Version=Version+1 WHERE Id='${data.template.id}'`,
    `UPDATE DiagnosisCatalog SET NameVi=NameVi+N' updated' WHERE Id='${data.diagnosisSelections[0].id}'`,
  ]) {
    const current = await choices(v), preview = await call(doctor.token, previewPath(v), current);
    fixtureSql(mutation);
    await call(doctor.token, completePath(v), { version: v.version, previewId: preview.previewId }, 409);
    assert.equal(await call(p.patient.token, recordPath(v)), null);
  }
  const current = await choices(v), preview = await call(doctor.token, previewPath(v), current);
  fixtureSql(`UPDATE ClinicalTemplate SET Active=0 WHERE Id='${current.template.id}'`);
  try { await call(doctor.token, completePath(v), { version: v.version, previewId: preview.previewId }, 409); }
  finally { fixtureSql(`UPDATE ClinicalTemplate SET Active=1 WHERE Id='${current.template.id}'`); }
  const next = await register(); await call(doctor.token, completePath(next), { version: next.version, previewId: preview.previewId }, 409);
  await call(doctor.token, completePath(v), { version: v.version, previewId: (await call(doctor.token, previewPath(v), await choices(v))).previewId });
  const nextAccepted = await accept(next);
  assert.equal((await call(doctor.token, completePath(nextAccepted), { version: nextAccepted.version, previewId: preview.previewId }, 409)).title, "previewStale");
  await call(doctor.token, completePath(nextAccepted), { version: nextAccepted.version, previewId: (await call(doctor.token, previewPath(nextAccepted), await choices(nextAccepted))).previewId });
});
test("atomic rollback, same-key replay, immediate publication, immutable snapshots and next patient", async () => {
  const p = await register(), v = await accept(p), selection = await choices(v), preview = await call(doctor.token, previewPath(v), selection), key = randomUUID();
  const body = { version: v.version, previewId: preview.previewId };
  fixtureSql("CREATE TRIGGER PB014_FailRecord ON ClinicalRecord AFTER INSERT AS THROW 51020, 'Synthetic examination failure', 1;");
  try {
    await call(doctor.token, completePath(v), body, 500, key);
    const unchanged = await read(v); assert.equal(unchanged.version, v.version); assert.equal(unchanged.examStatus, "InConsultation");
    assert.equal(await call(p.patient.token, recordPath(v)), null);
  } finally { fixtureSql("DROP TRIGGER PB014_FailRecord"); }
  const done = await call(doctor.token, completePath(v), body, 200, key);
  assert.equal(done.visit.examStatus, "Completed"); assert.equal(done.visit.status, "Active"); assert.equal(done.visit.journeyStatus, "Active");
  assert.equal(done.visit.currentStep.kind, "Settlement"); assert.equal(done.visit.currentStep.status, "Ready");
  assert.equal(done.visit.workRevision, v.workRevision); assert.deepEqual(done.visit.ticket, v.ticket);
  assert.deepEqual(done.record.content, preview.content); assert.equal(done.record.author.id, v.doctorId);
  assert.match(done.record.confirmedAt, /Z$/); assert.equal(done.record.publishedAt, done.record.confirmedAt);
  const replays = await Promise.all(Array.from({ length: 5 }, () => call(doctor.token, completePath(v), body, 200, key)));
  for (const replay of replays) assert.deepEqual(replay, done);
  await call(doctor.token, completePath(v), body, 409);
  assert.deepEqual(await call(p.patient.token, recordPath(v)), done.record);
  assert.equal((await call(p.patient.token, `/api/visits/${v.id}/content`)).summary.diagnosis, preview.content.diagnosis);
  fixtureSql(`UPDATE DiagnosisCatalog SET NameVi=N'Changed historical catalog',Version=Version+1 WHERE Id='${selection.diagnosisSelections[0].id}'; UPDATE ClinicalTemplate SET InstructionsTemplate=N'Changed template',Version=Version+1 WHERE Id='${selection.template.id}'`);
  assert.deepEqual(await call(p.patient.token, recordPath(v)), done.record);
  assert.equal((await queue()).currentVisitId, null);
  fixtureSql(`UPDATE ClinicRoom SET ActiveDoctorId=NULL WHERE ClinicLocationId='${v.clinicLocationId}'`);
  try { await call(doctor.token, completePath(v), body, 403, key); }
  finally { fixtureSql(`UPDATE ClinicRoom SET ActiveDoctorId='${v.doctorId}' WHERE ClinicLocationId='${v.clinicLocationId}'`); }
});
test("InService cannot preview; completion race with different keys produces one record", async () => {
  const p = await register(), ordered = await order(p);
  await call(doctor.token, previewPath(ordered), await choices(ordered), 409);
  const returned = await call(service.token, path(ordered), input(ordered)), v = await accept(returned);
  const preview = await call(doctor.token, previewPath(v), await choices(v));
  const send = async () => { const r = await fetch(base + completePath(v), { method: "POST", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", Authorization: `Bearer ${doctor.token}`, "Idempotency-Key": randomUUID() }, body: JSON.stringify({ version: v.version, previewId: preview.previewId }) }); return r.status; };
  assert.deepEqual((await Promise.all([send(), send()])).sort(), [200, 409]);
  assert.match(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM ClinicalRecord WHERE VisitId='${v.id}'`), /\b1\b/);
});

