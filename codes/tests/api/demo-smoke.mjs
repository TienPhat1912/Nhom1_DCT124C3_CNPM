import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const settings = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/)
  .filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const base = process.env.API_URL ?? `http://127.0.0.1:${settings.API_PORT || '5280'}`;
const webUrl = process.env.WEB_URL ?? `http://localhost:${settings.WEB_PORT || '5180'}`;
const password = process.env.DEMO_PASSWORD ?? settings.DEMO_PASSWORD;
assert.ok(password && !password.startsWith('REPLACE_'), 'Run bootstrap to generate .env first');
let ready = false;
for (let i = 0; i < 45; i++) {
  try { ready = (await fetch(base + '/health')).ok; if (ready) break; } catch { /* Startup retry. */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(ready, 'SQL-backed API must become healthy');
const roles = { patient: 'Patient', reception: 'Reception', doctor: 'Doctor', service: 'Service', cashier: 'Cashier', admin: 'Admin', otherdoctor: 'Doctor' };
const checked = [];
for (const [user, role] of Object.entries(roles)) {
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'X-Client': 'native' }, body: JSON.stringify({ email: `${user}@demo.local`, password, language: 'vi' }) });
  assert.equal(response.status, 200);
  const session = await response.json(); assert.equal(session.role, role);
  const path = role === 'Admin' ? '/api/admin/configuration' : role === 'Reception' ? '/api/reception/resources' : '/api/visits';
  const read = await fetch(base + path, { headers: { Authorization: `Bearer ${session.token}` } });
  assert.equal(read.status, 200); checked.push({ user: `${user}@demo.local`, role, readStatus: read.status });
}
const web = await fetch(webUrl); assert.equal(web.status, 200);
assert.match(await web.text(), /An T/);
const spec = await (await fetch(base + '/openapi/v1.json')).json();
const proxy = await fetch(webUrl + '/api/config'); assert.equal(proxy.status, 200);
assert.equal((await proxy.json()).demo, true, 'Web proxy must reach the demo API');
const report = { checkedAt: new Date().toISOString(), backend: base, web: webUrl, roles: checked, openApiPaths: Object.keys(spec.paths).length, passed: true };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/demo-smoke.json', JSON.stringify(report, null, 2));
console.log('PASS demo: seven role accounts, protected reads, web/proxy, SQL health and OpenAPI.');
