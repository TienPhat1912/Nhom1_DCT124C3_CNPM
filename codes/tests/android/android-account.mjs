import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adb, api, checks, fill, locate, nodes, passed, password, restart, screenshot, tap, verifyInstalledApk } from './android-driver.mjs';

// Continue the dedicated emulator's completed guest Journey from android-smoke.
// This verifies native component remounts and SecureStore, not just the API.
const previousFont = adb('shell', 'settings', 'get', 'system', 'font_scale').trim();
try {
  assert.match(adb('emu', 'avd', 'name'), /cnpm_api36/);
  const apkSha256 = verifyInstalledApk();
  const apiPort = new URL(process.env.API_URL ?? 'http://127.0.0.1:5280').port || '80';
  adb('reverse', 'tcp:5280', `tcp:${apiPort}`);
  const staff = (await api('/api/auth/login', null, { email: 'reception@demo.local', password, language: 'en' })).token;
  const request = (await api('/api/requests', staff)).find(r => r.name.startsWith('Native ') && r.status === 'Confirmed');
  assert.ok(request, 'Run android-smoke first.');
  const detail = await api(`/api/requests/${request.id}`, staff);
  const visit = await api(`/api/visits/${detail.visitId}`, staff);
  assert.equal(visit.journeyStatus, 'Completed');
  const ticket = await api(`/api/visits/${visit.id}/ticket`, staff);
  await restart();
  await tap('My journey');
  await locate(visit.ticketNumber, { scroll: true });
  await locate(n => n.text?.includes('Your guidance journey is complete'), { scroll: true });
  assert.ok(!nodes().some(n => /Link account|Keep access with an account/.test(n['content-desc'] || n.text || '')));
  await tap('My profile');
  await locate('Full name');
  assert.ok(!nodes().some(n => /Link account|Keep access with an account/.test(n['content-desc'] || n.text || '')));
  screenshot('native-guest-profile-without-link');
  passed('Guest profile and completed Journey have no account-link invitation');
  await tap('Overview');
  await tap('Sign out');
  await locate('Continue as guest');
  const email = `native-${randomUUID()}@example.test`;
  await tap('Create account');
  await fill('Email', email);
  await fill('Password', password);
  await fill('Full name', request.name);
  await fill('Contact information', 'native-fixture');
  await tap(n => n['content-desc'] === 'Create account' && n.checkable !== 'true' && n.class !== 'android.widget.RadioButton');
  await locate('No confirmed hospital Visits yet.');
  const account = await api('/api/auth/login', null, { email, password, language: 'en' });
  const history = await api('/api/visits', account.token);
  assert.deepEqual(history, []);
  await restart();
  await locate('No confirmed hospital Visits yet.');
  passed('Native registration creates an independent account and SecureStore restores no Guest history');
  await tap('Sign out');
  await locate('Continue as guest');
  const recovery = await api(`/api/visits/${visit.id}/recovery`, staff, { attendeeVerified: true, verificationNote: 'Native Guest recovery after independent registration' });
  await tap('Recover access');
  await fill('Recovery code from reception', recovery.recoveryCode);
  await tap(n => n['content-desc'] === 'Recover access' && n.clickable === 'true' && n.enabled === 'true');
  await tap('My journey');
  await locate(visit.ticketNumber, { scroll: true });
  await locate(n => n.text?.includes('Your guidance journey is complete'), { scroll: true });
  passed('Verified Guest recovery restores the original Visit/Journey without transferring it to the new account');
  adb('shell', 'settings', 'put', 'system', 'font_scale', '1.3');
  await restart(`hguide://entry?ticket=${ticket.code}&language=vi`);
  await tap('Mở hành trình');
  await locate(visit.ticketNumber, { scroll: true });
  await locate(n => n.text?.includes('Hành trình hướng dẫn đã hoàn thành'), { scroll: true });
  screenshot('native-account-vietnamese-large-text');
  passed('Recovered Guest survives process restart and opens the same Journey in Vietnamese at 130% font scale');
  writeFileSync('artifacts/android/android-account.json', JSON.stringify({ checkedAt: new Date().toISOString(), status: 'passed', apkSha256, androidApi: 36, fontScale: 1.3, checks, limitations: ['Emulator only; formal screen-reader audit and physical-device layout matrix remain outstanding.'] }, null, 2) + '\n');
} catch (error) {
  try { screenshot('native-account-failure'); } catch { /* Preserve original assertion. */ }
  writeFileSync(resolve('artifacts/android/account-failure.txt'), error.stack + '\n');
  throw error;
} finally {
  adb('shell', 'settings', 'put', 'system', 'font_scale', previousFont || '1.0');
}
