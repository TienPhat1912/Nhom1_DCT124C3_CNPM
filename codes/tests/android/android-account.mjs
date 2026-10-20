import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adb, api, checks, fill, locate, passed, password, restart, screenshot, tap, verifyInstalledApk } from './android-driver.mjs';

// Continue the dedicated emulator's completed guest Journey from android-smoke.
// This verifies native component remounts and SecureStore, not just the API.
const previousFont = adb('shell', 'settings', 'get', 'system', 'font_scale').trim();
try {
  assert.match(adb('emu', 'avd', 'name'), /cnpm_api36/);
  const apkSha256 = verifyInstalledApk();
  adb('reverse', 'tcp:5280', 'tcp:5280');
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
  await tap('Link account');
  await tap('Cancel');
  await locate(n => n.text?.includes('Your guidance journey is complete'), { scroll: true });
  await tap('Link account');
  passed('Cancelling native account linking preserves the completed guest Journey');
  const email = `native-${randomUUID()}@example.test`;
  await fill('Email', email);
  await fill('Password', password);
  await tap('Link account');
  await locate(n => n.text?.includes('Your guidance journey is complete'), { scroll: true });
  const account = await api('/api/auth/login', null, { email, password, language: 'en' });
  const history = await api('/api/visits', account.token);
  assert.deepEqual(history.map(v => v.id), [visit.id]);
  assert.equal((await api(`/api/visits/${visit.id}`, account.token)).journeyId, visit.journeyId);
  passed('Native account conversion returns to the same Visit and Journey; account API retains history');
  adb('shell', 'settings', 'put', 'system', 'font_scale', '1.3');
  await restart(`hguide://entry?ticket=${ticket.code}&language=vi`);
  await tap('Mở hành trình');
  await locate(visit.ticketNumber, { scroll: true });
  await locate(n => n.text?.includes('Hành trình hướng dẫn đã hoàn thành'), { scroll: true });
  screenshot('native-account-vietnamese-large-text');
  passed('Linked account survives process restart and opens the same Journey in Vietnamese at 130% font scale');
  writeFileSync('artifacts/android/android-account.json', JSON.stringify({ checkedAt: new Date().toISOString(), status: 'passed', apkSha256, androidApi: 36, fontScale: 1.3, checks, limitations: ['Emulator only; formal screen-reader audit and physical-device layout matrix remain outstanding.'] }, null, 2) + '\n');
} catch (error) {
  try { screenshot('native-account-failure'); } catch { /* Preserve original assertion. */ }
  writeFileSync(resolve('artifacts/android/account-failure.txt'), error.stack + '\n');
  throw error;
} finally {
  adb('shell', 'settings', 'put', 'system', 'font_scale', previousFont || '1.0');
}
