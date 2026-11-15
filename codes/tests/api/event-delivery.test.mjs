import { before, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { fixtureSql } from "./sql-fixture.mjs";

const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use the isolated PB023 runner");
let reception, doctor, service, cashier, clinic, catalog;
async function call(token, path, body, expected = 200, key = randomUUID(), method = body === undefined ? "GET" : "POST") {
  const r = await fetch(base + path, { method, headers: {
    "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", "Idempotency-Key": key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await r.json(); assert.equal(r.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
before(async () => {
  const login = name => call(null, "/api/auth/login", { email: `${name}@demo.local`, password });
  reception = await login("reception"); doctor = await login("doctor"); service = await login("service"); cashier = await login("cashier");
  clinic = (await call(reception.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
  catalog = (await call(doctor.token, "/api/v2/order-services")).find(s => s.code === "LAB");
});
afterEach(() => {
  fixtureSql("UPDATE Visits SET ExamStatus='Completed' WHERE ExamStatus='InConsultation'");
});
async function waiting(guest = false) {
  const patient = guest ? await call(null, "/api/auth/guest", { language: "en" })
    : await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB023 synthetic", contact: "fixture", language: "en" });
  if (guest) await call(patient.token, "/api/auth/profile", { name: "PB023 Guest", contact: "fixture", language: "en", version: 1 }, 200, randomUUID(), "PUT");
  const request = await call(patient.token, "/api/v2/requests", { contact: "fixture", description: "Synthetic", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  const result = await call(reception.token, `/api/v2/requests/${request.id}/confirm`, { version: request.version,
    clinicLocationId: clinic.clinicLocationId, clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "PB023 fixture verification" });
  return { ...result.visit, patient };
}
const path = v => `/api/visits/${v.id}/events`;
const poll = (v, cursor) => call(v.patient.token, path(v) + (cursor ? `?after=${encodeURIComponent(cursor)}` : ""));
const accept = (v, key) => call(doctor.token, `/api/v2/visits/${v.id}/consultations/accept`, { version: v.version }, 200, key);

test("bootstrap and reconnect do not replay history; retry produces exactly one event", async () => {
  const v = await waiting(), baseline = await poll(v), key = randomUUID();
  assert.equal(baseline.reset, true); assert.deepEqual(baseline.events, []);
  assert.equal(baseline.state.ticketNumber, v.ticket.number); assert.equal(baseline.pollAfterMs, 1000);
  const result = await accept(v, key);
  const delivered = await poll(v, baseline.cursor);
  assert.equal(delivered.reset, false); assert.equal(delivered.events.length, 1);
  const event = delivered.events[0];
  assert.equal(event.key, "consultationCalled"); assert.equal(event.visitId, v.id); assert.equal(event.stale, false);
  assert.equal(event.state.examStatus, "InConsultation"); assert.equal(event.state.ticketNumber, v.ticket.number);
  assert.equal(JSON.parse(event.state.steps[0].destinationSnapshot).room, "A101");
  assert.ok(event.state.steps[0].version > 0); assert.ok(event.state.steps[0].templateKey);
  assert.ok(event.guidance.length > 0); assert.ok(event.guidance[0].revision > 0);
  assert.equal(event.guidance[0].language, "vi"); assert.ok(event.guidance[0].text);
  const templateId = event.guidance[0].templateId;
  fixtureSql(`UPDATE GuidanceTemplate SET Text=Text+N' PB023_EDIT', Revision=Revision+1 WHERE Id='${templateId}'`);
  try { assert.deepEqual((await poll(v, baseline.cursor)).events[0].guidance, event.guidance); }
  finally { fixtureSql(`UPDATE GuidanceTemplate SET Text=REPLACE(Text,N' PB023_EDIT',N''), Revision=Revision-1 WHERE Id='${templateId}'`); }
  assert.equal(event.language, "vi"); assert.match(event.occurredAt, /Z$/); assert.match(event.expiresAt, /Z$/);
  for (const replay of await Promise.all(Array.from({ length: 6 }, () => accept(v, key)))) assert.deepEqual(replay, result);
  assert.deepEqual((await poll(v, baseline.cursor)).events, delivered.events);
  assert.deepEqual((await poll(v, delivered.cursor)).events, []);
  assert.deepEqual((await poll(v)).events, []);
});

test("every poll checks patient/session/grant permissions and Visit-scoped cursor", async () => {
  const a = await waiting(), b = await waiting(), g = await waiting(true);
  const cursor = (await poll(a)).cursor;
  await call(null, path(a), undefined, 401);
  await call(b.patient.token, path(a), undefined, 403);
  await call(doctor.token, path(a), undefined, 403);
  await call(b.patient.token, path(b) + `?after=${encodeURIComponent(cursor)}`, undefined, 400);
  await call(a.patient.token, path(a) + `?after=${a.id.replaceAll("-", "")}:9223372036854775807`, undefined, 400);
  await call(a.patient.token, path(a) + "?after=invalid", undefined, 400);
  const granted = await poll(g);
  fixtureSql(`UPDATE AccessGrant SET ExpiresAt=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE VisitId='${g.id}'`);
  await call(g.patient.token, path(g) + `?after=${encodeURIComponent(granted.cursor)}`, undefined, 403);
  fixtureSql(`UPDATE Sessions SET Revoked=1 WHERE PatientId=(SELECT PatientId FROM Visits WHERE Id='${a.id}')`);
  await call(a.patient.token, path(a), undefined, 401);
});

test("later state and expiry mark old calls stale", async () => {
  const v = await waiting(), baseline = await poll(v);
  const active = await accept(v);
  const input = { version: active.version, serviceId: catalog.id, note: "PB023 stale call" };
  const preview = await call(doctor.token, `/api/v2/visits/${v.id}/orders/preview`, input);
  await call(doctor.token, `/api/v2/visits/${v.id}/orders`, { ...input, previewId: preview.previewId });
  const events = (await poll(v, baseline.cursor)).events;
  assert.deepEqual(events.map(e => e.stale), [true, false]);
  fixtureSql(`UPDATE VisitEvent SET CreatedAt=DATEADD(minute,-3,SYSUTCDATETIME()) WHERE VisitId='${v.id}'`);
  assert.ok((await poll(v, baseline.cursor)).events.every(e => e.stale));
});

test("stream persistence failure rolls back call, state, notification and receipt; key can retry", async () => {
  const v = await waiting(), baseline = await poll(v), key = randomUUID();
  fixtureSql(`ALTER TABLE VisitEvent ADD CONSTRAINT PB023_FailEvent CHECK ([Key] <> 'consultationCalled' OR VisitId <> '${v.id}')`);
  try {
    await call(doctor.token, `/api/v2/visits/${v.id}/consultations/accept`, { version: v.version }, 500, key);
    const current = await poll(v, baseline.cursor);
    assert.equal(current.state.examStatus, "Waiting"); assert.equal(current.cursor, baseline.cursor); assert.deepEqual(current.events, []);
    const read = await call(doctor.token, `/api/v2/visits/${v.id}`);
    assert.equal(read.latestConsultationCall, null); assert.equal(read.version, v.version);
    assert.ok(! (await call(v.patient.token, "/api/notifications")).some(n => n.key === "consultationCalled"));
  } finally { fixtureSql("ALTER TABLE VisitEvent DROP CONSTRAINT PB023_FailEvent"); }
  await accept(v, key);
  assert.equal((await poll(v, baseline.cursor)).events.length, 1);
});

test("uncommitted delayed failure never exposes an event", async () => {
  const v = await waiting(), baseline = await poll(v);
  const worker = new Worker(`const { workerData, parentPort } = require('node:worker_threads');
    import(workerData.module).then(({ fixtureSql }) => { parentPort.postMessage('starting'); fixtureSql(workerData.sql); });`, {
    eval: true, workerData: { module: new URL("./sql-fixture.mjs", import.meta.url).href,
      sql: `BEGIN TRAN; INSERT VisitEvent (Id,VisitId,[Key],StateHash,PayloadJson,Version,CreatedAt)
        SELECT NEWID(),VisitId,'uncommitted',StateHash,PayloadJson,1,SYSUTCDATETIME() FROM VisitEvent WHERE VisitId='${v.id}';
        WAITFOR DELAY '00:00:02'; ROLLBACK;` },
  });
  const done = new Promise((resolve, reject) => { worker.once("error", reject); worker.once("exit", code => code ? reject(new Error(`SQL worker exit ${code}`)) : resolve()); });
  await new Promise(resolve => worker.once("message", resolve));
  await new Promise(resolve => setTimeout(resolve, 300));
  const observed = await poll(v, baseline.cursor);
  await done;
  assert.deepEqual(observed.events, []); assert.equal(observed.cursor, baseline.cursor);
  assert.equal(observed.state.examStatus, "Waiting");
});

test("service return, repeat call, examination and settlement publish final operational snapshots", async () => {
  const v = await waiting(), baseline = await poll(v);
  let current = await accept(v);
  const body = { version: current.version, serviceId: catalog.id, note: "PB023" };
  const preview = await call(doctor.token, `/api/v2/visits/${v.id}/orders/preview`, body);
  current = await call(doctor.token, `/api/v2/visits/${v.id}/orders`, { ...body, previewId: preview.previewId });
  current = await call(service.token, `/api/v2/visits/${v.id}/orders/${current.orders[0].id}/complete`, { version: current.version, orderVersion: current.orders[0].version });
  assert.equal((await poll(v)).state.examStatus, "Waiting");
  current = await accept(current);
  const load = async kind => (await call(doctor.token, `/api/v2/clinical-catalog/${kind}`)).items[0];
  const [diagnosis, template] = await Promise.all([load("diagnoses"), load("templates")]);
  const pick = x => ({ id: x.id, version: x.version });
  const exam = await call(doctor.token, `/api/v2/visits/${v.id}/examination/preview`, {
    version: current.version, symptomSelections: [], signSelections: [], diagnosisSelections: [pick(diagnosis)], template: pick(template),
  });
  current = (await call(doctor.token, `/api/v2/visits/${v.id}/examination/complete`, { version: current.version, previewId: exam.previewId })).visit;
  await call(cashier.token, `/api/v2/visits/${v.id}/settlement`, { version: current.version, workRevision: current.workRevision, outcome: "Final" });
  const delivered = await poll(v, baseline.cursor);
  assert.equal(delivered.state.status, "Closed"); assert.equal(delivered.state.consultationCount, 2);
  assert.equal(delivered.events.length, 6); assert.ok(delivered.events.slice(0, -1).every(e => e.stale));
  assert.equal(delivered.events.at(-1).stale, false);
  assert.ok(!JSON.stringify(delivered).includes("diagnosis"));
});

test("large reconnect gap resets to current state with bounded response", async () => {
  const v = await waiting(), baseline = await poll(v);
  fixtureSql(`INSERT VisitEvent (Id,VisitId,[Key],StateHash,PayloadJson,Version,CreatedAt)
    SELECT TOP (51) NEWID(),VisitId,[Key],StateHash,PayloadJson,1,SYSUTCDATETIME() FROM VisitEvent CROSS JOIN sys.all_objects WHERE VisitId='${v.id}'`);
  const reconnected = await poll(v, baseline.cursor);
  assert.equal(reconnected.reset, true); assert.deepEqual(reconnected.events, []);
  assert.notEqual(reconnected.cursor, baseline.cursor);
});

test("poll load sample: 100 requests at concurrency 10, report latency and payload", async () => {
  const v = await waiting(), baseline = await poll(v), samples = [], bytes = [];
  const started = performance.now();
  await Promise.all(Array.from({ length: 10 }, async () => {
    for (let n = 0; n < 10; n++) {
      const start = performance.now(), value = await poll(v, baseline.cursor);
      samples.push(performance.now() - start); bytes.push(Buffer.byteLength(JSON.stringify(value)));
      assert.deepEqual(value.events, []);
    }
  }));
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({ requests: samples.length, concurrency: 10, elapsedMs: Math.round(performance.now() - started),
    p50Ms: Math.round(samples[49]), p95Ms: Math.round(samples[94]), maxMs: Math.round(samples.at(-1)), maxBytes: Math.max(...bytes) }));
});
