import assert from 'node:assert/strict';

const base = new URL(process.env.WEB_URL ?? 'http://127.0.0.1:5280');
assert.ok(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)), 'Use HTTPS for a remote deployment');
const expected = process.env.EXPECTED_COMMIT;
assert.match(expected ?? '', /^[a-f0-9]{40}$/, 'Set EXPECTED_COMMIT to the release SHA');
const request = (path) => fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000), headers: { 'Cache-Control': 'no-cache' } });

// F1 and a paused serverless database can take time to start. Only retry readiness.
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await request('/health');
    if (response.ok) {
      const health = await response.json();
      ready = health.status === 'ok' && health.database === 'SqlServer' && health.version === expected;
      if (ready) break;
    }
  } catch { /* Retry cold starts without logging response bodies or credentials. */ }
  if (attempt < 29) await new Promise(resolve => setTimeout(resolve, 5000));
}
assert.ok(ready, `Deployment did not become healthy at commit ${expected}`);
const index = await request('/');
assert.equal(index.status, 200, 'Web index must be served');
assert.match(index.headers.get('content-type') ?? '', /text\/html/);
const html = await index.text();
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"/);
assert.ok(script, 'Built web page must reference a JavaScript asset');
const assetUrl = new URL(script[1], base);
assert.equal(assetUrl.origin, base.origin, 'Web assets must use the same origin');
const asset = await request(assetUrl.pathname);
assert.equal(asset.status, 200, 'Built JavaScript must be available');
assert.match(asset.headers.get('content-type') ?? '', /javascript/);
const entry = await request('/entry');
assert.equal(entry.status, 200, 'Direct navigation to /entry must work');
assert.equal(await entry.text(), html, 'SPA deep link must serve the same release');
for (const path of ['/api/deploy-check-missing', '/assets/deploy-check-missing.js', '/openapi/deploy-check-missing']) {
  assert.equal((await request(path)).status, 404, `${path} must not fall back to HTML`);
}
const config = await request('/api/config');
assert.equal(config.status, 200, 'Public application configuration must be readable');
assert.ok((await config.json()).departments?.length > 0, 'Hospital catalog must be available');
console.log(`PASS ${expected}: SQL health, web assets, direct navigation, API routing and catalog.`);
