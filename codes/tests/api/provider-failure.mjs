import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const base = process.env.API_URL;
const expected = process.env.PROVIDER_FAILURE === 'Timeout' ? 504 : 503;
const password = process.env.DEMO_PASSWORD ?? (await readFile('.env', 'utf8')).split(/\r?\n/).find(l => l.startsWith('DEMO_PASSWORD=')).slice(14);
async function api(path, token, body, status = 200) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'X-Client': 'native', 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json(); assert.equal(response.status, status, `${path}: ${result.title}`); return result;
}
const user = await api('/api/auth/register', null, { email: `${randomUUID()}@example.test`, password, name: 'Provider failure fixture', contact: 'fixture-contact', language: 'en' });
const started = performance.now();
await api('/api/external/link', user.token, { reference: 'DEMO-002', proof: 'SIM-VERIFY-DEMO-002' }, expected);
assert.ok(performance.now() - started < 4000, 'Configured 1-second provider timeout must be finite');
assert.equal((await api('/api/visits', user.token)).length, 0);
const config = await api('/api/config'); const dep = config.departments.find(d => d.code === 'CONSULT');
const reception = await api('/api/auth/login', null, { email: 'reception@demo.local', password, language: 'en' });
const resources = await api('/api/reception/resources', reception.token);
const request = await api('/api/requests', user.token, { name: 'Provider failure fixture', contact: 'fixture-contact', description: '', requests: '', departmentId: dep.id });
const detail = await api(`/api/requests/${request.id}`, user.token);
const { visitId } = await api(`/api/requests/${request.id}/confirm`, reception.token, { version: detail.version, departmentId: dep.id, locationId: config.locations.find(l => l.room === 'A101').id, doctorId: resources.doctors.find(d => d.departments.includes(dep.id)).id, attendeeVerified: true, verificationNote: 'Provider failure fixture verified' });
const before = await api(`/api/visits/${visitId}`, user.token); const step = before.steps[0];
await api(`/api/visits/${visitId}/narration`, user.token, { kind: 'Step', section: 'Instruction', stepId: step.id, sourceRevision: step.templateVersion, language: 'en' }, expected);
const cashier = await api('/api/auth/login', null, { email: 'cashier@demo.local', password, language: 'en' });
await api(`/api/visits/${visitId}/settlement`, cashier.token, { outcome: 'Final', version: before.version, workRevision: before.workRevision, source: 'Simulation' }, expected);
const after = await api(`/api/visits/${visitId}`, user.token);
assert.equal(after.version, before.version); assert.equal(after.finalSettlementRevision, null); assert.equal(after.journeyId, before.journeyId);
assert.ok(after.steps[0].text, 'Readable instructions survive narration-provider failure');
console.log(`PASS provider ${process.env.PROVIDER_FAILURE}: external identity, narration, settlement; finite timeout and unchanged local state.`);
