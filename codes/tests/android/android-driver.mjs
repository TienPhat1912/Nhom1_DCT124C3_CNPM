import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

// Runs against a dedicated local emulator and the real demo API. No app-data
// clearing, credential logging, UI response mocks or public services are used.
const adbPath = process.env.ADB_PATH ?? resolve('.local/android-sdk/platform-tools/adb.exe');
const serial = process.env.ANDROID_SERIAL ?? 'emulator-5556';
const appId = 'vn.edu.cnpm.hospitalguide';
const base = process.env.API_URL ?? 'http://127.0.0.1:5280';
const password = process.env.DEMO_PASSWORD ?? readFileSync('.env', 'utf8').split(/\r?\n/).find(l => l.startsWith('DEMO_PASSWORD=')).slice('DEMO_PASSWORD='.length);
const output = resolve('artifacts/android');
mkdirSync(output, { recursive: true });
const checks = [];
const delay = ms => new Promise(r => setTimeout(r, ms));
function adb(...args) {
  const p = spawnSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(p.status, 0, `adb ${args[0]} failed: ${p.stderr ?? p.error?.message}`);
  return p.stdout;
}
function verifyInstalledApk() {
  const apkSha256 = createHash('sha256').update(readFileSync(resolve(output, 'an-tam-demo.apk'))).digest('hex');
  const installedPath = adb('shell', 'pm', 'path', appId).trim().replace(/^package:/, '');
  assert.match(installedPath, /^\/data\/app\/[^\s]+\/base\.apk$/);
  assert.equal(adb('shell', 'sha256sum', installedPath).split(/\s+/)[0], apkSha256,
    'Install the current artifacts/android/an-tam-demo.apk before native acceptance.');
  return apkSha256;
}
const shellQuote = s => `'${s.replaceAll("'", "'\\''")}'`;
const decode = s => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function nodes() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/cnpm-ui.xml');
  const xml = adb('shell', 'cat', '/sdcard/cnpm-ui.xml');
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], decode(a[2])])));
}
const byLabel = label => n => n['content-desc'] === label || n.text === label;
async function locate(label, { scroll = false, timeout = 45000 } = {}) {
  const predicate = typeof label === 'function' ? label : byLabel(label);
  const deadline = Date.now() + timeout;
  let attempts = 0;
  while (Date.now() < deadline) {
    const all = nodes();
    const tabs = ['Overview', 'Tổng quan', 'My journey', 'Hành trình', 'Results & care', 'My profile'];
    const hasTabs = all.some(n => n.class === 'android.view.View' && tabs.includes(n['content-desc']));
    // Fabric can expose accessibility nodes outside the clipped ScrollView.
    // Never tap those coordinates (or a control hidden behind the bottom tabs).
    const n = all.find(node => {
      if (!predicate(node)) return false;
      const b = node.bounds?.match(/\d+/g)?.map(Number);
      if (!b || b[2] <= b[0] || b[3] <= b[1]) return false;
      const tab = node.class === 'android.view.View' && tabs.includes(node['content-desc']);
      return b[1] >= 73 && b[3] <= (hasTabs && !tab ? 1150 : 1245);
    });
    if (n) return n;
    if (scroll && attempts === 0) {
      for (let i = 0; i < 4; i++) adb('shell', 'input', 'swipe', '360', '340', '360', '1040', '150');
    } else if (scroll) adb('shell', 'input', 'swipe', '360', '850', '360', '570', '600');
    await delay(400);
    attempts++;
  }
  const visible = nodes().map(n => n['content-desc'] || n.text).filter(Boolean);
  throw new Error(`Native element not found after ${attempts} attempts: ${String(label)}; visible: ${visible.join(' | ')}`);
}
async function tap(label, options = { scroll: true }) {
  const predicate = typeof label === 'function' ? label : byLabel(label);
  const n = await locate(node => predicate(node) && node.clickable === 'true', options);
  const b = n.bounds.match(/\d+/g).map(Number);
  if (options.skipIfDisabled && n.enabled !== 'true') return;
  assert.equal(n.enabled, 'true', `Disabled: ${String(label)}`);
  adb('shell', 'input', 'tap', String(Math.round((b[0] + b[2]) / 2)), String(Math.round((b[1] + b[3]) / 2)));
  await delay(350);
}
async function fill(label, value) {
  await tap(n => n.class === 'android.widget.EditText' && byLabel(label)(n));
  adb('shell', 'input', 'keycombination', '113', '29');
  adb('shell', 'input', 'keyevent', 'KEYCODE_DEL');
  adb('shell', 'input', 'text', shellQuote(value.replaceAll(' ', '%s')));
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
}
function screenshot(name) {
  const p = spawnSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], { timeout: 15000, windowsHide: true });
  assert.equal(p.status, 0);
  writeFileSync(resolve(output, `${name}.png`), p.stdout);
}
async function api(path, token, body, method = body === undefined ? 'GET' : 'POST') {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'X-Client': 'native', 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal(r.status, 200, `${method} ${path} returned ${r.status}`);
  return r.json();
}
function passed(name) { checks.push(name); console.log(`PASS: ${name}`); }
async function restart(uri) {
  adb('shell', 'am', 'force-stop', appId);
  if (uri) adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', shellQuote(uri), appId);
  else adb('shell', 'am', 'start', '-W', '-n', `${appId}/.MainActivity`);
  await delay(1000);
}

export { adb, api, appId, byLabel, checks, fill, locate, nodes, output, passed, password, restart, screenshot, serial, tap, verifyInstalledApk };
