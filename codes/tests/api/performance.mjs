import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
const base = process.env.API_URL ?? 'http://127.0.0.1:5281';
assert.match(process.env.ACCEPTANCE_DB ?? '', /^HospitalAcceptance_\d+$/, 'Use an isolated acceptance database');
const password = process.env.DEMO_PASSWORD ?? (await readFile('.env', 'utf8')).split(/\r?\n/).find(l => l.startsWith('DEMO_PASSWORD=')).slice(14);
async function request(path, token, body) {
  const start = performance.now();
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'X-Client': 'native', 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.status, 200, `${path}: ${data.title}`);
  return { data, ms: performance.now() - start };
}
const users = [];
for (let i = 0; i < 20; i++) {
  const session = (await request('/api/auth/login', null, { email: `load${i}@example.test`, password, language: 'en' })).data;
  const visits = (await request('/api/visits', session.token)).data;
  assert.equal(visits.length, 25);
  assert.equal((await request(`/api/visits/${visits[0].id}`, session.token)).data.steps.length, 20);
  users.push({ token: session.token, visits });
}
const samples = { journey: [], content: [], navigation: [], history: [], assistanceWrite: [] };
const startedAt = new Date().toISOString();
const start = performance.now();
await Promise.all(users.map(async ({ token, visits }) => {
  for (let round = 0; round < 30; round++) {
    const id = visits[round % visits.length].id;
    const operations = [ ['journey', `/api/visits/${id}?language=en`], ['content', `/api/visits/${id}/content?language=en`], ['navigation', `/api/visits/${id}/navigation?language=en`], ['history', '/api/visits'] ];
    const [kind, path] = operations[round % operations.length];
    samples[kind].push((await request(path, token)).ms);
  }
  samples.assistanceWrite.push((await request('/api/assistance', token, { category: 'Navigation', description: 'Synthetic concurrent load fixture', visitId: visits[0].id, requestId: null, stepId: null })).ms);
}));
const durationMs = performance.now() - start;
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const results = Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, { count: values.length, p50Ms: +percentile(values, .5).toFixed(2), p95Ms: +percentile(values, .95).toFixed(2), maxMs: +Math.max(...values).toFixed(2) }]));
const report = { startedAt, environment: { os: os.platform(), release: os.release(), cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, ramGiB: +(os.totalmem() / 2 ** 30).toFixed(1), node: process.version, api: process.env.SQL_TEST_SERVER ? '.NET 10 / native SQL Server, published Release build' : '.NET 10 / SQL Server, local Docker SQL, Release build' }, database: process.env.ACCEPTANCE_DB, seededSteps: 10000, syntheticVisits: 500, concurrentUsers: 20, measuredRequests: 620, durationMs: +durationMs.toFixed(2), results, criterion: 'Each measured operation p95 <= 2000 ms, zero failed requests', passed: Object.values(results).every(r => r.p95Ms <= 2000) };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/performance.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
assert.equal(report.passed, true, 'p95 exceeds 2 seconds');
