import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fixtureSql } from './sql-fixture.mjs';

const base = process.env.API_URL ?? 'http://127.0.0.1:5280';
let password = process.env.DEMO_PASSWORD;
if (!password) password = (await readFile(new URL('../../.env', import.meta.url), 'utf8')).split(/\r?\n/).find(s => s.startsWith('DEMO_PASSWORD=')).slice('DEMO_PASSWORD='.length);
const prefix = `test-${Date.now()}`;
const staff = {};
let config, department, consultLocation, doctorId, resources;
const failures = [];

async function call(token, path, body, method = body === undefined ? 'GET' : 'POST', key = randomUUID(), expected = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'X-Client': 'native', 'Idempotency-Key': key, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await r.json();
  assert.equal(r.status, expected, `${method} ${path}: ${r.status} ${data.title ?? ''} ${data.detail ?? ''}`);
  return data;
}
async function guest() { return call(null, '/api/auth/guest', { language: 'vi' }); }
async function account(suffix) { return call(null, '/api/auth/register', { email: `${prefix}-${suffix}@example.test`, password, name: 'Acceptance Patient', contact: 'test-contact', language: 'en' }); }
async function prepare(session) {
  return call(session.token, '/api/requests', { name: 'Acceptance Patient', contact: 'test-contact', description: 'Operational acceptance fixture', requests: '', departmentId: department.id });
}
async function confirm(requestId) {
  const r = await call(staff.reception, `/api/requests/${requestId}`);
  return call(staff.reception, `/api/requests/${requestId}/confirm`, { version: r.version, departmentId: department.id, locationId: consultLocation.id, doctorId, attendeeVerified: true, verificationNote: 'Verified in acceptance test' });
}
async function attendance(session) { const r = await prepare(session); const v = await confirm(r.id); return { requestId: r.id, visitId: v.visitId }; }
async function visit(token, id) { return call(token, `/api/visits/${id}?language=en`); }
async function activate(session, id) { const ticket = await call(session.token, `/api/visits/${id}/ticket`); return call(session.token, '/api/tickets/redeem', { code: ticket.code }); }
async function progress(id, kind, status = 'Completed', token = staff.doctor) {
  const v = await visit(token, id); const s = v.steps.find(s => s.kind === kind && ['Ready', 'InProgress'].includes(s.status)); assert.ok(s, `Expected actionable ${kind}`);
  return call(token, `/api/visits/${id}/steps/${s.id}/progress`, { status, version: s.version, reason: status === 'Skipped' ? 'Authorized resolution for test' : '' });
}
async function settle(id, outcome = 'Final') {
  const v = await visit(staff.cashier, id); return call(staff.cashier, `/api/visits/${id}/settlement`, { outcome, version: v.version, workRevision: v.workRevision });
}
async function addOrder(id, serviceId = config.services[0].id) {
  const v = await visit(staff.doctor, id); return call(staff.doctor, `/api/visits/${id}/orders`, { version: v.version, serviceId, note: 'Acceptance order' });
}
before(async () => {
  assert.equal((await call(null, '/health')).database, 'SqlServer');
  config = await call(null, '/api/config'); department = config.departments.find(d => d.code === 'CONSULT'); consultLocation = config.locations.find(l => l.room === 'A101');
  for (const role of ['reception', 'doctor', 'service', 'cashier', 'admin', 'otherdoctor']) staff[role] = (await call(null, '/api/auth/login', { email: `${role}@demo.local`, password, language: 'en' })).token;
  resources = await call(staff.reception, '/api/reception/resources'); doctorId = resources.doctors.find(d => d.departments.includes(department.id)).id;
});

test('walk-in: preparation, supplement, concurrent reception and QR ownership', async () => {
  const s = await guest(); const other = await guest();
  assert.equal((await call(s.token, '/api/visits')).length, 0);
  assert.equal((await call(null, '/api/entry')).createsVisit, false);
  const key = randomUUID(), input = { name: 'Acceptance Patient', contact: 'test-contact', description: '', requests: '', departmentId: department.id };
  const [r1, r2] = await Promise.all([call(s.token, '/api/requests', input, 'POST', key), call(s.token, '/api/requests', input, 'POST', key)]);
  assert.equal(r1.id, r2.id); assert.equal((await call(s.token, '/api/visits')).length, 0);
  let r = await call(s.token, `/api/requests/${r1.id}`);
  await call(s.token, '/api/tickets/redeem', { code: r.code }, 'POST', randomUUID(), 422);
  await call(other.token, `/api/requests/${r.id}`, undefined, 'GET', randomUUID(), 403);
  await call(staff.reception, `/api/requests/${r.id}/message`, { version: r.version, templateId: resources.templates[0].id });
  r = await call(s.token, `/api/requests/${r.id}`); assert.equal(r.status, 'NeedsInformation');
  await call(s.token, `/api/requests/${r.id}`, { information: { ...input, version: r.version }, messageId: r.messages[0].id, response: 'Provided information' }, 'PUT');
  r = await call(s.token, `/api/requests/${r.id}`); assert.equal(r.status, 'Submitted'); assert.equal(r.messages[0].response, 'Provided information');
  const confirmInput = { version: r.version, departmentId: department.id, locationId: consultLocation.id, doctorId, attendeeVerified: true, verificationNote: 'Verified in concurrent test' };
  const results = await Promise.all(Array.from({ length: 8 }, () => call(staff.reception, `/api/requests/${r.id}/confirm`, confirmInput)));
  assert.equal(new Set(results.map(v => v.visitId)).size, 1);
  const id = results[0].visitId; let v = await visit(s.token, id); assert.equal(v.journeyStatus, 'PendingActivation');
  assert.equal((await call(s.token, '/api/visits')).length, 1);
  const ticket = await call(s.token, `/api/visits/${id}/ticket`);
  await call(other.token, '/api/tickets/redeem', { code: ticket.code }, 'POST', randomUUID(), 403);
  await call(staff.reception, '/api/reception/scan', { code: ticket.code }, 'POST', randomUUID(), 422);
  await activate(s, id); await activate(s, id); v = await visit(s.token, id); assert.equal(v.journeyStatus, 'Active');
  await call(s.token, `/api/visits/${id}/steps/${v.steps[0].id}/progress`, { status: 'Completed', reason: '', version: v.steps[0].version }, 'POST', randomUUID(), 403);
  await call(staff.otherdoctor, `/api/visits/${id}`, undefined, 'GET', randomUUID(), 403);
  await call(staff.admin, `/api/visits/${id}/content`, undefined, 'GET', randomUUID(), 403);
  await call(staff.reception, `/api/visits/${id}/reissue`, { attendeeVerified: true, verificationNote: 'Verified replacement' });
  await call(s.token, '/api/tickets/redeem', { code: ticket.code }, 'POST', randomUUID(), 410);
  await activate(s, id); assert.equal((await visit(s.token, id)).journeyId, v.journeyId);
});

test('orders, required return consultation, early/current settlement and post-closure pharmacy', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s); await activate(s, id);
  let v = await visit(staff.doctor, id);
  await call(staff.doctor, `/api/visits/${id}/pharmacy`, { required: true, version: v.version });
  const order = await addOrder(id); await settle(id, 'Final'); assert.equal((await visit(s.token, id)).status, 'Active');
  await progress(id, 'Consultation');
  v = await visit(s.token, id); assert.equal(v.steps.find(s => s.kind === 'ReturnConsultation').status, 'Waiting');
  const before = await visit(staff.service, id); const serviceStep = before.steps.find(s => s.kind === 'Service');
  const event = { status: 'InProgress', version: serviceStep.version, reason: '' }, key = randomUUID();
  await Promise.all([call(staff.service, `/api/visits/${id}/steps/${serviceStep.id}/progress`, event, 'POST', key), call(staff.service, `/api/visits/${id}/steps/${serviceStep.id}/progress`, event, 'POST', key)]);
  v = await visit(staff.doctor, id); const currentOrder = v.orders.find(o => o.id === order.id);
  await call(staff.doctor, `/api/visits/${id}/orders/${order.id}`, { action: 'Cancel', serviceId: null, reason: 'Must not cancel started service', version: currentOrder.version }, 'PUT', randomUUID(), 409);
  await progress(id, 'Service', 'Completed', staff.service);
  assert.equal((await visit(s.token, id)).steps.find(s => s.kind === 'ReturnConsultation').status, 'Ready');
  await progress(id, 'ReturnConsultation'); v = await visit(s.token, id); assert.equal(v.status, 'Closed'); assert.equal(v.journeyStatus, 'Active');
  assert.equal(v.steps.find(s => s.kind === 'Pharmacy').canCompleteGuidance, true);
  await call(s.token, `/api/visits/${id}/complete-guidance`, { version: v.journeyVersion }); v = await visit(s.token, id);
  assert.equal(v.journeyStatus, 'Completed'); assert.equal(v.completionSource, 'PatientGuidanceConfirmation');
  await call(staff.doctor, `/api/visits/${id}/orders`, { version: v.version, serviceId: config.services[0].id, note: '' }, 'POST', randomUUID(), 409);
});

test('changed required work invalidates earlier final settlement; intermediate never closes', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s);
  await settle(id, 'Final'); await addOrder(id); await progress(id, 'Consultation'); await progress(id, 'Service', 'Skipped', staff.service); await progress(id, 'ReturnConsultation');
  assert.equal((await visit(s.token, id)).status, 'Active'); await settle(id, 'Intermediate'); assert.equal((await visit(s.token, id)).status, 'Active');
  await settle(id, 'NoPaymentRequired'); const v = await visit(s.token, id); assert.equal(v.status, 'Closed'); assert.equal(v.journeyStatus, 'Completed'); assert.equal(v.completionSource, 'WorkflowNoPharmacy');
  await activate(s, id); assert.equal((await visit(s.token, id)).journeyStatus, 'Completed');
});

test('closure preserves Pending Activation for pharmacy; patient cannot finish early', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s); let v = await visit(s.token, id);
  await call(s.token, `/api/visits/${id}/complete-guidance`, { version: v.journeyVersion }, 'POST', randomUUID(), 409);
  await call(staff.doctor, `/api/visits/${id}/pharmacy`, { required: true, version: v.version }); await progress(id, 'Consultation'); await settle(id);
  v = await visit(s.token, id); assert.equal(v.status, 'Closed'); assert.equal(v.journeyStatus, 'PendingActivation');
  await activate(s, id); assert.equal((await visit(s.token, id)).journeyStatus, 'Active');
});

test('draft privacy, immediate publication, translation binding, correction and stale narration', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s);
  const draft = await call(staff.doctor, `/api/visits/${id}/drafts`, { diagnosis: 'Doctor-authored test summary', explanation: '', instructions: 'Approved test instruction', language: 'vi', documentReference: 'DEMO-DOC' });
  assert.equal((await call(s.token, `/api/visits/${id}/content`)).summary, null);
  await call(s.token, `/api/visits/${id}/drafts`, undefined, 'GET', randomUUID(), 403);
  let drafts = await call(staff.doctor, `/api/visits/${id}/drafts`);
  await call(staff.doctor, `/api/visits/${id}/drafts/${draft.id}/publish`, { version: drafts[0].version, reviewed: true });
  const published = (await call(s.token, `/api/visits/${id}/content?language=en`)).summary; assert.equal(published.fallback, true);
  assert.equal((await visit(s.token, id)).status, 'Active');
  await call(staff.doctor, `/api/visits/${id}/summaries/${draft.id}/translations`, { language: 'en', diagnosis: 'Reviewed English summary', explanation: '', instructions: 'Reviewed English instructions', approved: true, sourceRevision: draft.revision });
  assert.equal((await call(s.token, `/api/visits/${id}/content?language=en`)).summary.language, 'en');
  const audio = await call(s.token, `/api/visits/${id}/narration`, { kind: 'Summary', section: 'Instructions', sourceRevision: 1, language: 'en' }); assert.equal(audio.text, 'Reviewed English instructions');
  await progress(id, 'Consultation'); await settle(id);
  const correction = await call(staff.doctor, `/api/visits/${id}/drafts`, { diagnosis: 'Corrected summary', explanation: '', instructions: 'Corrected instructions', language: 'vi', documentReference: '' });
  drafts = await call(staff.doctor, `/api/visits/${id}/drafts`); const d = drafts.find(d => d.id === correction.id);
  await call(staff.doctor, `/api/visits/${id}/drafts/${correction.id}/publish`, { version: d.version, reviewed: true });
  const current = (await call(s.token, `/api/visits/${id}/content?language=en`)).summary; assert.equal(current.revision, 2); assert.equal(current.language, 'vi');
  await call(s.token, `/api/visits/${id}/narration`, { kind: 'Summary', section: 'Instructions', sourceRevision: 1, language: 'en' }, 'POST', randomUUID(), 409);
  assert.equal((await visit(s.token, id)).status, 'Closed');
});

test('guest conversion failure/cancel/retry preserves identity and access; claim cannot replay', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s); const original = await visit(s.token, id);
  const claim = await call(s.token, '/api/auth/link-claim', { returnVisitId: id });
  await call(s.token, '/api/auth/convert', { claim: claim.claim, email: `${prefix}-linked@example.test`, password: 'short', register: true }, 'POST', randomUUID(), 422);
  assert.equal((await visit(s.token, id)).journeyId, original.journeyId);
  // Cancellation has no backend mutation; the same guest context remains valid.
  const result = await call(s.token, '/api/auth/convert', { claim: claim.claim, email: `${prefix}-linked@example.test`, password, register: true });
  assert.equal(result.session.patientId, s.patientId); assert.equal(result.returnVisitId, id);
  assert.equal((await visit(result.session.token, id)).journeyId, original.journeyId);
  await call(s.token, '/api/auth/convert', { claim: claim.claim, email: `${prefix}-linked@example.test`, password, register: false }, 'POST', randomUUID(), 401);
  await call(s.token, `/api/visits/${id}`, undefined, 'GET', randomUUID(), 401);
});

test('account linking refuses conflicting ownership and supports empty-account link', async () => {
  const existing = await account('existing'); await attendance(existing);
  const s = await guest(); const { visitId: id } = await attendance(s); const claim = await call(s.token, '/api/auth/link-claim', { returnVisitId: id });
  await call(s.token, '/api/auth/convert', { claim: claim.claim, email: `${prefix}-existing@example.test`, password, register: false }, 'POST', randomUUID(), 409);
  assert.ok(await visit(s.token, id));
  const empty = await account('empty');
  const linked = await call(s.token, '/api/auth/convert', { claim: claim.claim, email: `${prefix}-empty@example.test`, password, register: false });
  assert.equal(linked.session.patientId, s.patientId);
  await call(empty.token, '/api/visits', undefined, 'GET', randomUUID(), 401);
});

test('mapping validation rejects cycles/missing mappings; order update/cancel keeps provenance', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s);
  const service = await call(staff.admin, '/api/admin/services', { id: null, version: 0, code: `${Date.now()}`, nameVi: 'Dịch vụ kiểm thử', nameEn: 'Test service', departmentId: config.services[0].departmentId, locationId: config.services[0].locationId, active: true, returnRequired: true });
  let v = await visit(staff.doctor, id);
  await call(staff.doctor, `/api/visits/${id}/orders`, { version: v.version, serviceId: service.id, note: '' }, 'POST', randomUUID(), 409);
  assert.equal((await visit(s.token, id)).orders.length, 0);
  await call(staff.admin, '/api/admin/mappings', { serviceId: service.id, publish: true, steps: [{ key: 'cycle', locationId: config.services[0].locationId, templateKey: 'laboratory', authority: 'Service', dependsOn: ['cycle'] }] }, 'POST', randomUUID(), 422);
  const order = await addOrder(id); v = await visit(staff.doctor, id); let o = v.orders.find(o => o.id === order.id); const oldSteps = v.steps.filter(st => st.doctorOrderId === o.id);
  await call(staff.doctor, `/api/visits/${id}/orders/${o.id}`, { action: 'Update', serviceId: config.services[1].id, reason: 'Revised service request', version: o.version }, 'PUT');
  v = await visit(staff.doctor, id); assert.ok(oldSteps.every(old => v.steps.find(st => st.id === old.id).status === 'Cancelled')); o = v.orders.find(o => o.id === order.id);
  await call(staff.doctor, `/api/visits/${id}/orders/${o.id}`, { action: 'Cancel', serviceId: null, reason: 'Order no longer required', version: o.version }, 'PUT');
  assert.ok((await visit(staff.doctor, id)).steps.filter(st => st.doctorOrderId === o.id).every(st => st.status === 'Cancelled'));
});

test('assistance before reception, scoped staff handling, directions fallback, notifications', async () => {
  const s = await guest(); const a = await call(s.token, '/api/assistance', { category: 'Language', description: 'Need help', visitId: null, requestId: null, stepId: null });
  let item = (await call(staff.reception, '/api/assistance')).find(i => i.id === a.id);
  await call(staff.service, `/api/assistance/${a.id}`, { status: 'Acknowledged', resolution: '', escalate: false, departmentId: null, version: item.version }, 'PUT', randomUUID(), 403);
  await call(staff.reception, `/api/assistance/${a.id}`, { status: 'Acknowledged', resolution: '', escalate: false, departmentId: null, version: item.version }, 'PUT');
  item = (await call(staff.reception, '/api/assistance')).find(i => i.id === a.id);
  await call(staff.reception, `/api/assistance/${a.id}`, { status: 'Resolved', resolution: 'Provided human assistance', escalate: false, departmentId: null, version: item.version }, 'PUT');
  assert.equal((await call(s.token, '/api/assistance'))[0].status, 'Resolved');
  const { visitId: id } = await attendance(s); const route = await call(s.token, `/api/visits/${id}/navigation?language=en`); assert.equal(route.instructions, null); assert.ok(route.destination.room);
  assert.ok((await call(s.token, '/api/notifications')).some(n => n.key === 'ticketIssued'));
});

test('verified guest recovery is single-use and keeps Visit/Journey keys', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s); const v = await visit(s.token, id);
  const recovery = await call(staff.reception, `/api/visits/${id}/recovery`, { attendeeVerified: true, verificationNote: 'Identity checked at reception' });
  const recovered = await call(null, '/api/auth/recover', { code: recovery.recoveryCode }); assert.equal(recovered.session.patientId, s.patientId);
  assert.equal((await visit(recovered.session.token, id)).journeyId, v.journeyId);
  await call(null, '/api/auth/recover', { code: recovery.recoveryCode }, 'POST', randomUUID(), 403);
});

test('booked preparation and confirmed later follow-up create independent attendances', async () => {
  const identity = `${prefix}-booked`;
  const s = await account('booked');
  // The deterministic fixture identity is unique. Repeated test runs can legitimately find it already linked.
  const r = await fetch(base + '/api/external/link', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'Authorization': `Bearer ${s.token}`, 'Idempotency-Key': identity }, body: JSON.stringify({ reference: 'DEMO-001', proof: 'SIM-VERIFY-DEMO-001' }) });
  if (r.status === 409) { failures.push('booked fixture already owned: use a fresh acceptance database to exercise this case'); return; }
  assert.equal(r.status, 200);
  const bookings = await call(s.token, '/api/appointments'); assert.equal(bookings.length, 1);
  const prepared = await call(s.token, '/api/appointments/prepare', { reference: bookings[0].reference, attendeeVerified: false, verificationNote: '' });
  assert.equal((await call(s.token, '/api/visits')).length, 0);
  const first = await confirm(prepared.id); await progress(first.visitId, 'Consultation'); await settle(first.visitId);
  await call(staff.doctor, `/api/visits/${first.visitId}/follow-ups`, { departmentId: department.id, recommendedAt: new Date(Date.now() + 86400000 * 7).toISOString(), text: 'Reviewed follow-up recommendation', language: 'en', reviewed: true });
  const second = await attendance(s); assert.notEqual(first.visitId, second.visitId); assert.equal((await visit(s.token, first.visitId)).status, 'Closed');
  const pageOne = await call(s.token, '/api/visits?limit=1'); const pageTwo = await call(s.token, '/api/visits?limit=1&offset=1');
  assert.equal(pageOne.length, 1); assert.equal(pageTwo.length, 1); assert.notEqual(pageOne[0].id, pageTwo[0].id);
});

test('expired QR and session deny access without creating another Visit', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s);
  const ticket = await call(s.token, `/api/visits/${id}/ticket`);
  fixtureSql(`UPDATE QrCode SET ExpiresAt=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE ExaminationTicketId=(SELECT Id FROM ExaminationTicket WHERE VisitId='${id}')`);
  await call(s.token, '/api/tickets/redeem', { code: ticket.code }, 'POST', randomUUID(), 410);
  assert.equal((await call(s.token, '/api/visits')).length, 1);
  fixtureSql(`UPDATE Sessions SET ExpiresAt=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE Id='${s.sessionId}'`);
  await call(s.token, `/api/visits/${id}`, undefined, 'GET', randomUUID(), 401);
});

test('stale updates and reused event keys cannot overwrite newer information', async () => {
  const s = await guest(); const r = await prepare(s);
  const original = await call(s.token, `/api/requests/${r.id}`);
  const body = { information: { name: 'Changed name', contact: 'new-contact', description: '', requests: '', departmentId: department.id, version: original.version }, messageId: null, response: '' };
  const key = randomUUID();
  await call(s.token, `/api/requests/${r.id}`, body, 'PUT', key);
  await call(s.token, `/api/requests/${r.id}`, { ...body, response: 'different payload' }, 'PUT', key, 409);
  await call(s.token, `/api/requests/${r.id}`, body, 'PUT', randomUUID(), 409);
  assert.equal((await call(s.token, `/api/requests/${r.id}`)).name, 'Changed name');
});

test('multi-step mapping enforces intermediate payment then services then required return', async () => {
  const s = await guest(); const { visitId: id } = await attendance(s);
  const lab = config.locations.find(l => l.room === 'B201'); const cashier = config.locations.find(l => l.room === 'C01');
  const service = await call(staff.admin, '/api/admin/services', { id: null, version: 0, code: `MULTI-${Date.now()}`, nameVi: 'Synthetic multi-step service', nameEn: 'Synthetic multi-step service', departmentId: lab.departmentId, locationId: lab.id, active: true, returnRequired: true });
  await call(staff.admin, '/api/admin/mappings', { serviceId: service.id, publish: true, steps: [
    { key: 'payment', locationId: cashier.id, templateKey: 'settlement', authority: 'Cashier', dependsOn: [] },
    { key: 'collect', locationId: lab.id, templateKey: 'laboratory', authority: 'Service', dependsOn: ['payment'] },
    { key: 'analyze', locationId: lab.id, templateKey: 'laboratory', authority: 'Service', dependsOn: ['collect'] },
  ] });
  await addOrder(id, service.id); await progress(id, 'Consultation');
  let v = await visit(staff.service, id); assert.ok(v.steps.filter(s => s.kind === 'Service').every(s => s.status === 'Waiting'));
  await settle(id, 'Intermediate'); v = await visit(staff.service, id);
  assert.equal(v.status, 'Active'); assert.equal(v.steps.filter(s => s.kind === 'Service' && s.status === 'Ready').length, 1);
  await progress(id, 'Service', 'Completed', staff.service); await progress(id, 'Service', 'Completed', staff.service);
  await progress(id, 'ReturnConsultation'); await settle(id, 'NoPaymentRequired');
  assert.equal((await visit(s.token, id)).status, 'Closed');
});

test('configured room changes affect future guidance while existing destination snapshots stay unchanged', async () => {
  const first = await attendance(await guest());
  const original = config.locations.find(l => l.room === 'C01');
  await call(staff.admin, '/api/admin/locations', { ...original, room: 'C99' });
  try {
    const second = await attendance(await guest());
    assert.equal((await visit(staff.cashier, first.visitId)).steps.find(s => s.kind === 'Settlement').destination.room, 'C01');
    assert.equal((await visit(staff.cashier, second.visitId)).steps.find(s => s.kind === 'Settlement').destination.room, 'C99');
    const dep = config.departments.find(d => d.code === 'CASHIER');
    await call(staff.admin, '/api/admin/departments', { ...dep, code: 'RENAMED' }, 'POST', randomUUID(), 409);
  } finally {
    const changed = (await call(null, '/api/config')).locations.find(l => l.id === original.id);
    await call(staff.admin, '/api/admin/locations', { ...changed, room: 'C01' });
  }
});

test('administrator dashboard requires admin access and reports bounded aggregate data', async () => {
  await call(null, '/api/admin/dashboard', undefined, 'GET', randomUUID(), 401);
  const patient = await guest();
  for (const token of [patient.token, staff.doctor, staff.reception, staff.service, staff.cashier]) {
    await call(token, '/api/admin/dashboard', undefined, 'GET', randomUUID(), 403);
  }
  for (const days of [0, 8, 365]) {
    await call(staff.admin, `/api/admin/dashboard?days=${days}`, undefined, 'GET', randomUUID(), 422);
  }
  const week = await call(staff.admin, '/api/admin/dashboard');
  const month = await call(staff.admin, '/api/admin/dashboard?days=30');
  assert.equal(week.timeZone, 'Asia/Ho_Chi_Minh');
  assert.equal(week.days, 7);
  assert.equal(week.daily.length, 7);
  assert.equal(month.daily.length, 30);
  assert.deepEqual(month.daily.slice(-7), week.daily);
  assert.deepEqual(month.summary, week.summary);
  assert.equal(week.summary.activeVisits, week.departments.reduce((sum, d) => sum + d.activeVisits, 0));
  assert.equal(week.summary.openAssistance, week.departments.reduce((sum, d) => sum + d.openAssistance, 0));
  assert.equal(week.daily.at(-1).admitted, week.summary.visitsToday);
  assert.equal(week.daily.at(-1).closed, week.summary.closedToday);
  for (let i = 1; i < month.daily.length; i++) {
    assert.equal(Date.parse(month.daily[i].date) - Date.parse(month.daily[i - 1].date), 86400000);
  }
  const configuration = await call(staff.admin, '/api/admin/configuration');
  assert.equal(week.configuration.activeStaff, configuration.staff.filter(s => s.active).length);
  assert.equal(week.configuration.servicesWithoutMapping, configuration.services.filter(s => s.active && !configuration.mappings.some(m => m.hospitalServiceId === s.id && m.published)).length);
  // The administrator gets counts, not patient identities or clinical content.
  assert.deepEqual(Object.keys(week).sort(), ['configuration', 'daily', 'days', 'departments', 'generatedAt', 'summary', 'timeZone']);
  for (const d of week.departments) {
    assert.deepEqual(Object.keys(d).sort(), ['active', 'activeVisits', 'id', 'inProgressSteps', 'nameEn', 'nameVi', 'openAssistance', 'waitingSteps']);
  }
});

test('dashboard tracks reception, assistance and closures using Vietnam date boundaries', async () => {
  const dashboard = () => call(staff.admin, '/api/admin/dashboard');
  const before = await dashboard();
  const s = await guest();
  const request = await prepare(s);
  assert.equal((await dashboard()).summary.pendingRequests, before.summary.pendingRequests + 1);
  const { visitId } = await confirm(request.id);
  const during = await dashboard();
  assert.equal(during.summary.pendingRequests, before.summary.pendingRequests);
  assert.equal(during.summary.activeVisits, before.summary.activeVisits + 1);
  assert.equal(during.summary.visitsToday, before.summary.visitsToday + 1);
  assert.equal(during.departments.find(d => d.id === department.id).activeVisits, before.departments.find(d => d.id === department.id).activeVisits + 1);
  const help = await call(s.token, '/api/assistance', { category: 'Navigation', description: 'Dashboard fixture', visitId, requestId: null, stepId: null });
  for (const status of ['Acknowledged', 'Resolved']) {
    assert.equal((await dashboard()).summary.openAssistance, before.summary.openAssistance + 1);
    const item = (await call(staff.reception, '/api/assistance')).find(a => a.id === help.id);
    await call(staff.reception, `/api/assistance/${help.id}`, { status, resolution: 'Assistance provided', escalate: false, departmentId: null, version: item.version }, 'PUT');
  }
  assert.equal((await dashboard()).summary.openAssistance, before.summary.openAssistance);
  await progress(visitId, 'Consultation');
  await settle(visitId, 'NoPaymentRequired');
  assert.equal((await dashboard()).summary.activeVisits, before.summary.activeVisits);
  // One second before Vietnam midnight is yesterday, even though both timestamps share a UTC date.
  const midnight = new Date(`${before.daily.at(-1).date}T00:00:00+07:00`);
  const previousDay = new Date(midnight.getTime() - 1000).toISOString().slice(0, -1);
  fixtureSql(`UPDATE Visits SET CreatedAt='${previousDay}', ClosedAt='${midnight.toISOString().slice(0, -1)}' WHERE Id='${visitId}'`);
  const after = await dashboard();
  assert.equal(after.summary.visitsToday, before.summary.visitsToday);
  assert.equal(after.summary.closedToday, before.summary.closedToday + 1);
  assert.equal(after.daily.at(-2).admitted, before.daily.at(-2).admitted + 1);
  assert.equal(after.daily.at(-1).closed, before.daily.at(-1).closed + 1);
});

test('test run notes', () => { assert.deepEqual(failures, [], failures.join('; ')); });
