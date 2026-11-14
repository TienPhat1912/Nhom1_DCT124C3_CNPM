import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance fixture");
let reception, doctor, service, other, cashier, admin, clinic;
async function call(token, path, body, expected = 200, method = body === undefined ? "GET" : "POST") {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", "Idempotency-Key": randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await r.json(); assert.equal(r.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
before(async () => {
  const login = n => call(null, "/api/auth/login", { email: `${n}@demo.local`, password });
  [reception, doctor, service, other, cashier, admin] = await Promise.all(["reception", "doctor", "service", "otherdoctor", "cashier", "admin"].map(login));
  clinic = (await call(reception.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
});
async function register(guest = false) {
  const patient = guest ? await call(null, "/api/auth/guest", { language: "en" }) : await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB016 synthetic", contact: "synthetic-contact", language: "en" });
  if (guest) await call(patient.token, "/api/auth/profile", { name: "PB016 Guest", contact: "synthetic-contact", language: "en", version: 1 }, 200, "PUT");
  const req = await call(patient.token, "/api/v2/requests", { contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  return { ...(await call(reception.token, `/api/v2/requests/${req.id}/confirm`, { version: req.version, clinicLocationId: clinic.clinicLocationId, clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "PB016 verification" })).visit, patient };
}
async function preview(v) {
  const accepted = await call(doctor.token, `/api/v2/visits/${v.id}/consultations/accept`, { version: v.version });
  const load = async kind => (await call(doctor.token, `/api/v2/clinical-catalog/${kind}`)).items[0];
  const [symptom, sign, diagnosis, template] = await Promise.all(["symptoms", "signs", "diagnoses", "templates"].map(load));
  const pick = x => ({ id: x.id, version: x.version });
  const data = { version: accepted.version, symptomSelections: [pick(symptom)], signSelections: [pick(sign)], diagnosisSelections: [pick(diagnosis)], template: pick(template) };
  return { visit: accepted, ...(await call(doctor.token, `/api/v2/visits/${v.id}/examination/preview`, data)) };
}
const confirm = p => call(doctor.token, `/api/v2/visits/${p.visit.id}/examination/complete`, { version: p.visit.version, previewId: p.previewId });
const content = (v, language = "vi", token = v.patient.token) => call(token, `/api/visits/${v.id}/content?language=${language}`);
const narration = (v, language, summary, expected = 200, token = v.patient.token) => call(token, `/api/visits/${v.id}/narration`, { kind: "Summary", section: "Diagnosis", sourceRevision: summary?.revision ?? 1, language, contentKey: summary?.contentKey }, expected);
async function followUp(v, text = "PB016 original care", departmentId = v.departmentId) {
  return call(doctor.token, `/api/visits/${v.id}/follow-ups`, { departmentId, recommendedAt: new Date(Date.now() + 86400000).toISOString(), text, language: "vi", reviewed: true });
}

test("no preview, early recommendation or narration is exposed before confirmed examination", async () => {
  const v = await register(), p = await preview(v);
  await followUp(v);
  for (const language of ["vi", "en", "zh", "ja"]) {
    const hidden = await content(v, language); assert.equal(hidden.summary, null); assert.equal(hidden.clinicalRecord, null); assert.deepEqual(hidden.followUps, []); assert.equal(hidden.bookingUrl, null);
    assert.equal(await call(v.patient.token, `/api/v2/visits/${v.id}/clinical-record`), null);
    await narration(v, language, null, 404);
  }
  const done = await confirm(p); assert.equal(done.visit.status, "Active");
  const published = await content(v); assert.deepEqual(published.clinicalRecord, done.record); assert.equal(published.followUps.length, 1);
  assert.equal(published.examStatus, "Completed"); assert.equal(published.visitId, v.id);
});

test("confirmed structured snapshots and recommendations preserve Vietnamese source across language reads", async () => {
  const v = await register(), done = await confirm(await preview(v)); await followUp(v);
  for (const language of ["vi", "en", "zh", "ja", "ko", "ru"]) {
    const data = await content(v, language); assert.equal(data.bookingUrl, null);
    assert.deepEqual(data.clinicalRecord, done.record);
    assert.deepEqual(data.summary.original, done.record.content); assert.equal(data.summary.authorName, done.record.author.name);
    assert.equal(data.followUps[0].visitId, v.id); assert.equal(data.followUps[0].original.text, "PB016 original care");
    assert.equal(data.followUps[0].original.language, "vi"); assert.match(data.followUps[0].recommendedAt, /Z$/);
    assert.ok(["source", "translated", "unavailable"].includes(data.summary.translationStatus));
    const audio = await narration(v, language, data.summary); assert.equal(audio.text, data.summary.diagnosis + "\n" + data.summary.explanation); assert.equal(audio.language, data.summary.language);
    await narration(v, language, { ...data.summary, contentKey: "stale-translation" }, 409);
  }
  fixtureSql(`UPDATE DiagnosisCatalog SET NameVi=N'Changed catalog after confirmation' WHERE Id='${done.record.diagnoses[0].id}'`);
  try { assert.deepEqual((await content(v)).clinicalRecord, done.record); }
  finally { fixtureSql(`UPDATE DiagnosisCatalog SET NameVi=N'${done.record.diagnoses[0].nameVi.replaceAll("'", "''")}' WHERE Id='${done.record.diagnoses[0].id}'`); }
  const translated = await followUp(v, "Bác sĩ"); // Known synthetic dictionary fixture.
  const translatedRead = (await content(v, "en")).followUps.find(f => f.id === translated.id);
  assert.equal(translatedRead.text, "Doctor"); assert.equal(translatedRead.original.text, "Bác sĩ");
  assert.equal(translatedRead.language, "en"); assert.equal(translatedRead.fallback, false);
  assert.equal(translatedRead.translationStatus, "translated");
  await call(doctor.token, `/api/visits/${v.id}/follow-ups`, { departmentId: v.departmentId, recommendedAt: new Date(Date.now() + 86400000).toISOString(), text: "Non-source", language: "en", reviewed: true }, 422);
});

test("Account ownership, staff roles, Guest grants and narration use the same authorization boundary", async () => {
  const v = await register(), record = await confirm(await preview(v)), stranger = await register(true);
  for (const token of [stranger.patient.token, reception.token, service.token, other.token, cashier.token, admin.token]) {
    await call(token, `/api/visits/${v.id}/content`, undefined, 403);
    await call(token, `/api/v2/visits/${v.id}/clinical-record`, undefined, 403);
    await narration(v, "vi", { revision: record.record.version }, 403, token);
  }
  assert.ok(!(await call(stranger.patient.token, "/api/visits")).some(x => x.id === v.id));
  assert.ok(!(await call(v.patient.token, "/api/visits")).some(x => x.id === stranger.id));
  const guest = stranger; await confirm(await preview(guest));
  const token = randomUUID(), hash = createHash("sha256").update(token).digest("hex").toUpperCase();
  fixtureSql(`INSERT Sessions (Id,Version,CreatedAt,PatientId,TokenHash,IsGuest,ExpiresAt,Revoked) VALUES (NEWID(),1,SYSUTCDATETIME(),'${guest.patient.patientId}','${hash}',1,DATEADD(hour,1,SYSUTCDATETIME()),0)`);
  assert.deepEqual(await call(token, "/api/visits"), []); await call(token, `/api/visits/${guest.id}/content`, undefined, 403);
  assert.ok((await content(guest)).summary);
  fixtureSql(`UPDATE AccessGrant SET ExpiresAt=DATEADD(hour,-1,SYSUTCDATETIME()) WHERE SessionId='${guest.patient.sessionId}' AND VisitId='${guest.id}'`);
  await call(guest.patient.token, `/api/visits/${guest.id}/content`, undefined, 403);
  await narration(guest, "vi", null, 403);
  assert.deepEqual(await call(guest.patient.token, "/api/visits"), []);
});

test("legacy published history remains readable; drafts and superseded recommendations stay private", async () => {
  const patient = await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB016 legacy", contact: "synthetic-contact", language: "en" });
  const req = await call(patient.token, "/api/requests", { name: "PB016 legacy", contact: "synthetic-contact", description: "Legacy", requests: "", departmentId: clinic.departmentId });
  const detail = await call(reception.token, `/api/requests/${req.id}`);
  const config = await call(null, "/api/config"), location = config.locations.find(x => x.room === "A101");
  const registered = await call(reception.token, `/api/requests/${req.id}/confirm`, { version: detail.version, departmentId: location.departmentId, locationId: location.id, attendeeVerified: true, verificationNote: "PB016 legacy verification" });
  const v = { id: registered.visitId, departmentId: location.departmentId, patient };
  const draft = await call(doctor.token, `/api/visits/${v.id}/drafts`, { diagnosis: "PB016 legacy diagnosis", explanation: "", instructions: "PB016 legacy care", language: "vi", documentReference: "PB016 historical reference" });
  assert.equal((await content(v)).summary, null); await narration(v, "en", null, 404);
  const rows = await call(doctor.token, `/api/visits/${v.id}/drafts`);
  await call(doctor.token, `/api/visits/${v.id}/drafts/${draft.id}/publish`, { version: rows[0].version, reviewed: true });
  const first = await followUp(v), rec = (await content(v)).followUps[0]; assert.equal(rec.id, first.id);
  await call(doctor.token, `/api/visits/${v.id}/follow-ups`, { departmentId: location.departmentId, recommendedAt: new Date(Date.now() + 172800000).toISOString(), text: "PB016 replacement care", language: "vi", reviewed: true, id: rec.id, version: rec.version });
  const data = await content(v, "en"); assert.equal(data.summary.original.diagnosis, "PB016 legacy diagnosis"); assert.equal(data.clinicalRecord, null);
  assert.equal(data.followUps.length, 1); assert.equal(data.followUps[0].original.text, "PB016 replacement care"); assert.equal(data.bookingUrl, null);
  assert.ok((await call(patient.token, "/api/visits")).some(x => x.id === v.id));
});
