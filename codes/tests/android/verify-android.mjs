import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const apk = resolve(process.argv[2] ?? 'artifacts/android/an-tam-demo.apk');
const sdk = process.env.ANDROID_HOME ?? resolve('.local/android-sdk');
const bin = join(sdk, 'build-tools', '36.0.0');
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const aapt = join(bin, process.platform === 'win32' ? 'aapt2.exe' : 'aapt2');
function run(file, args) {
  const p = spawnSync(file, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  assert.equal(p.status, 0, `${file}: ${p.error?.message ?? p.stderr}`);
  return p.stdout;
}
const signature = run(java, ['-jar', join(bin, 'lib/apksigner.jar'), 'verify', '--verbose', apk]);
assert.match(signature, /Verified using v2 scheme.*true/);
const badging = run(aapt, ['dump', 'badging', apk]);
assert.match(badging, /package: name='vn\.edu\.cnpm\.hospitalguide'/);
assert.match(badging, /minSdkVersion:'24'/);
assert.match(badging, /targetSdkVersion:'36'/);
assert.doesNotMatch(badging, /application-debuggable/);
for (const permission of ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW', 'RECORD_AUDIO']) assert.ok(!badging.includes(`android.permission.${permission}`), `Unused permission ${permission} must be absent.`);
assert.match(badging, /android\.permission\.CAMERA/);
assert.match(badging, /native-code:.*'arm64-v8a'.*'x86_64'/);
const manifest = run(aapt, ['dump', 'xmltree', apk, '--file', 'AndroidManifest.xml']);
assert.match(manifest, /android:allowBackup[^\n]*0x0/);
assert.match(manifest, /android:networkSecurityConfig/);
assert.match(manifest, /android:scheme[^\n]*"hguide"/);
// Release resource optimization may rename XML files (for example res/M2.xml).
const resources = run(aapt, ['dump', 'resources', apk]);
const networkFile = resources.match(/xml\/local_network_security\s+\(\) \(file\) (res\/\S+) type=XML/)?.[1];
assert.ok(networkFile, 'The packaged network-security resource must exist.');
const network = run(aapt, ['dump', 'xmltree', apk, '--file', networkFile]);
assert.match(network, /base-config[\s\S]*?cleartextTrafficPermitted[^\n]*false/);
for (const host of ['localhost', '127.0.0.1', '10.0.2.2']) assert.ok(network.includes(host));
assert.match(network, /domain-config[\s\S]*?cleartextTrafficPermitted[^\n]*true/);
const report = {
  checkedAt: new Date().toISOString(), status: 'passed', apk: relative(process.cwd(), apk).replaceAll('\\', '/'),
  bytes: statSync(apk).size, sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  applicationId: 'vn.edu.cnpm.hospitalguide', minSdk: 24, targetSdk: 36, architectures: ['arm64-v8a', 'x86_64'],
  checks: ['Valid APK v2 signature', 'Non-debuggable release', 'No unused storage/overlay/microphone permission', 'Application backup disabled', 'Native hguide deep link', 'HTTP limited to localhost, 127.0.0.1 and emulator host; HTTPS required elsewhere'],
  signing: 'Generated Android debug keystore for local demo, not a store release key',
};
mkdirSync('artifacts/android', { recursive: true });
writeFileSync('artifacts/android/android-build.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
