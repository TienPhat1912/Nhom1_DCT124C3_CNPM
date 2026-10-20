import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adb, api, byLabel, checks, fill, locate, nodes, output, passed, password, restart, screenshot, serial, tap, verifyInstalledApk } from './android-driver.mjs';

try {
  assert.equal((await api('/health')).database, 'SqlServer', 'Start the real demo backend before native acceptance.');
  assert.match(adb('emu', 'avd', 'name'), /cnpm_api36/, 'Use the dedicated CNPM emulator.');
  assert.equal(adb('shell', 'getprop', 'sys.boot_completed').trim(), '1');
  const apkSha256 = verifyInstalledApk();
  adb('reverse', 'tcp:5280', 'tcp:5280');
  adb('reverse', 'tcp:5180', 'tcp:5180');
  adb('shell', 'wm', 'size', '720x1280');
  adb('shell', 'wm', 'density', '240');
  adb('shell', 'settings', 'put', 'global', 'window_animation_scale', '0');
  adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', '0');
  adb('shell', 'settings', 'put', 'global', 'animator_duration_scale', '0');
  await restart();
  await locate(n => ['Overview', 'Tổng quan', 'Continue as guest', 'Tiếp tục với tư cách khách'].some(label => byLabel(label)(n)), { scroll: true });
  if (nodes().some(byLabel('Overview'))) { await tap('Overview'); await tap('Sign out'); }
  else if (nodes().some(byLabel('Tổng quan'))) { await tap('Tổng quan'); await tap('Đăng xuất'); }
  await locate(n => ['Continue as guest', 'Tiếp tục với tư cách khách'].some(label => byLabel(label)(n)), { scroll: true });
  if (nodes().some(byLabel('English'))) await tap('English');
  await tap('Continue as guest');
  await locate('No confirmed hospital Visits yet.');
  passed('Release APK reaches real API over emulator loopback; guest initially has no Visit');
  const staff = {};
  for (const role of ['reception', 'doctor', 'cashier']) staff[role] = (await api('/api/auth/login', null, { email: `${role}@demo.local`, password, language: 'en' })).token;
  const config = await api('/api/config');
  const resources = await api('/api/reception/resources', staff.reception);
  const department = config.departments.find(d => d.code === 'CONSULT');
  const name = `Native ${Date.now()}`;
  await tap('Prepare for reception');
  await tap('Without an appointment');
  await fill('Full name', name);
  await fill('Contact information', 'native-fixture');
  await tap('Submit information');
  await locate('Reception QR', { scroll: true });
  const request = (await api('/api/requests', staff.reception)).find(r => r.name === name);
  assert.ok(request, 'Native submission must exist in SQL-backed reception API.');
  const detail = await api(`/api/requests/${request.id}`, staff.reception);
  const { visitId } = await api(`/api/requests/${request.id}/confirm`, staff.reception, { version: detail.version, departmentId: department.id, locationId: config.locations.find(l => l.room === 'A101').id, doctorId: resources.doctors.find(d => d.departments.includes(department.id)).id, attendeeVerified: true, verificationNote: 'Native emulator acceptance fixture' });
  await tap('View ticket');
  await tap('Open journey');
  await locate('Initial consultation', { scroll: true });
  passed('Native walk-in submission, real staff confirmation and ticket activation');
  await tap('Listen');
  await locate(n => (n['content-desc'] === 'Stop playback' && n.enabled === 'true') || n.text === 'Audio is unavailable. Read the text or try again.', { scroll: true });
  // Device speech can finish between accessibility snapshots. A disabled Stop
  // means playback has already ended, not a failed narration request.
  if (nodes().some(n => n['content-desc'] === 'Stop playback' && n.enabled === 'true'))
    await tap('Stop playback', { scroll: true, skipIfDisabled: true });
  passed('Native narration either starts device playback or retains readable text with an audio error');
  await tap('Directions');
  await locate(n => n.text?.startsWith('A detailed route is unavailable'), { scroll: true });
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await tap('My journey');
  await tap('Get help');
  await tap('Request assistance');
  await locate('The server confirmed your action.', { scroll: true });
  assert.ok((await api('/api/assistance', staff.reception)).some(a => a.visitId === visitId));
  passed('Native directions fallback and assistance submission');
  let v = await api(`/api/visits/${visitId}`, staff.doctor);
  await api(`/api/visits/${visitId}/pharmacy`, staff.doctor, { required: true, version: v.version });
  v = await api(`/api/visits/${visitId}`, staff.doctor);
  const consultation = v.steps.find(s => s.kind === 'Consultation');
  await api(`/api/visits/${visitId}/steps/${consultation.id}/progress`, staff.doctor, { status: 'Completed', version: consultation.version, reason: '' });
  v = await api(`/api/visits/${visitId}`, staff.cashier);
  await api(`/api/visits/${visitId}/settlement`, staff.cashier, { outcome: 'Final', version: v.version, workRevision: v.workRevision });
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await tap('My journey');
  await locate('Pharmacy guidance', { scroll: true });
  await tap('Complete guidance');
  await locate(n => n.text?.includes('Your guidance journey is complete'), { scroll: true });
  v = await api(`/api/visits/${visitId}`, staff.doctor);
  assert.equal(v.status, 'Closed'); assert.equal(v.journeyStatus, 'Completed');
  screenshot('native-completed-journey');
  passed('Closed Visit retains pharmacy guidance; native completion is confirmed by backend');
  const ticket = await api(`/api/visits/${visitId}/ticket`, staff.reception);
  await restart(`hguide://entry?ticket=${ticket.code}&language=en`);
  await tap('Open journey');
  await locate(n => n.text?.includes('Your guidance journey is complete'), { scroll: true });
  passed('SecureStore restores guest after process restart; native deep link resumes the same Journey');
  await tap('Scan QR code');
  await tap('Open camera');
  const denyCamera = n => n['resource-id']?.endsWith('/permission_deny_button') || /^Don['’]t allow$/.test(n.text ?? '');
  // The system permission dialog can arrive after the first UI snapshot. On a
  // repeat run Android may instead immediately return the previous denial.
  const permissionState = await locate(n => denyCamera(n) || n.text === 'Camera unavailable. You can paste the code or link below.');
  if (denyCamera(permissionState)) await tap(denyCamera, { scroll: false });
  await locate('Camera unavailable. You can paste the code or link below.');
  await locate('Paste QR code or link');
  passed('Denied native camera permission leaves manual QR entry available');
  screenshot('native-camera-fallback');
  const report = { checkedAt: new Date().toISOString(), status: 'passed', apkSha256, device: serial, androidApi: adb('shell', 'getprop', 'ro.build.version.sdk').trim(), checks, limitations: ['Emulator only; physical camera QR capture and audible VI/EN speech remain unverified.'] };
  writeFileSync(resolve('artifacts/android/android-smoke.json'), JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  try { screenshot('native-failure'); } catch { /* Preserve the original assertion. */ }
  writeFileSync(resolve(output, 'smoke-failure.txt'), `${error.stack}\nCompleted: ${checks.join('; ')}\n`);
  throw error;
}
