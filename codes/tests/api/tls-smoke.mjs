import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const response = await page.goto('https://localhost:8443/entry');
  assert.equal(response.status(), 200);
  assert.match(await page.getByRole('link', { name: 'Mở ứng dụng', exact: true }).getAttribute('href'), /^hguide:\/\/entry/);
  await page.getByRole('link', { name: 'Tiếp tục trên web', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục với tư cách khách', exact: true }).click();
  await page.getByRole('heading', { name: /Xin chào/ }).waitFor();
  assert.deepEqual(await (await context.request.get('https://localhost:8443/api/visits')).json(), []);
  const cookie = (await context.cookies()).find(c => c.name === 'hospital_session');
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict');
  await page.reload();
  await page.getByRole('heading', { name: /Xin chào/ }).waitFor();
  await page.screenshot({ path: 'artifacts/https-overview.png', fullPage: true });
  const report = { checkedAt: new Date().toISOString(), transport: 'https://localhost:8443', status: response.status(), cookie: { secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite }, entryFallback: 'Public entry to web preserves context and creates no Visit', sessionReload: 'passed', certificate: 'Local self-signed; test explicitly ignores trust error', passed: true };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/tls-smoke.json', JSON.stringify(report, null, 2));
  console.log('PASS HTTPS entry, Secure/HttpOnly/SameSite cookie and session restoration.');
} finally { await browser.close(); }
