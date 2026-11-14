import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Configuration, ReceptionRequest, Session, Ticket, Visit, Content } from '@hospital/shared';
const password = process.env.DEMO_PASSWORD ?? readFileSync('.env', 'utf8').split(/\r?\n/).find(l => l.startsWith('DEMO_PASSWORD='))!.split('=').slice(1).join('=');
const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:5280';
async function api<T>(path: string, token?: string | null, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const r = await fetch(apiUrl + path, { method, headers: { 'Content-Type': 'application/json', 'X-Hospital-Client': '1', 'X-Client': 'native', 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await r.json(); expect(r.status, `${path}: ${result.title ?? ''}`).toBe(200); return result as T;
}
test('guest reception, pharmacy, readable fallback, assistance and independent account registration', async ({ page, context }, info) => {
  const name = `Browser ${info.project.name} ${Date.now()}`;
  const staff = await api<Session>('/api/auth/login', null, { email: 'reception@demo.local', password, language: 'en' });
  const doctor = await api<Session>('/api/auth/login', null, { email: 'doctor@demo.local', password, language: 'en' });
  const cashier = await api<Session>('/api/auth/login', null, { email: 'cashier@demo.local', password, language: 'en' });
  const config = await api<Configuration>('/api/config');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Tiếp tục với tư cách khách', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục với tư cách khách', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible();
  await page.getByRole('button', { name: 'Chuẩn bị tiếp nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Chưa có lịch hẹn', exact: true }).click();
  await page.getByLabel('Họ và tên', { exact: true }).fill(name);
  await page.getByLabel('Thông tin liên hệ', { exact: true }).fill('browser-fixture');
  await page.getByRole('button', { name: 'Gửi thông tin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QR tiếp nhận', exact: true })).toBeVisible();
  const request = (await api<ReceptionRequest[]>('/api/requests', staff.token)).find(r => r.name === name)!;
  const detail = await api<ReceptionRequest>(`/api/requests/${request.id}`, staff.token);
  const department = config.departments.find(d => d.code === 'CONSULT')!;
  const confirmed = await api<{ visitId: string }>(`/api/requests/${request.id}/confirm`, staff.token, { version: detail.version, departmentId: department.id, locationId: config.locations.find(l => l.room === 'A101')!.id, attendeeVerified: true, verificationNote: 'Browser acceptance verified' });
  await page.getByRole('button', { name: 'Xem phiếu khám', exact: true }).click();
  await expect(page.getByText('Phiếu đã được cấp. Mở QR trên phiếu để kích hoạt hoặc tiếp tục đúng hành trình.')).toBeVisible();
  await page.getByRole('button', { name: 'Mở hành trình', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Khám ban đầu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chỉ đường', exact: true }).click();
  await expect(page.getByText('Bản đồ mẫu', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm đường', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Cần hỗ trợ', exact: true }).click();
  await page.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Máy chủ đã xác nhận thao tác.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  // Browser unavailable audio must leave the authorized text readable.
  await page.evaluate(() => Object.defineProperty(window, 'speechSynthesis', { value: { cancel() {}, getVoices() { return []; }, speak() { throw new Error('Audio unavailable'); } }, configurable: true }));
  await page.getByRole('button', { name: 'Nghe hướng dẫn', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Khám ban đầu', exact: true })).toBeVisible();
  let v = await api<Visit>(`/api/visits/${confirmed.visitId}`, doctor.token);
  await api(`/api/visits/${v.id}/pharmacy`, doctor.token, { required: true, version: v.version });
  v = await api<Visit>(`/api/visits/${v.id}`, doctor.token); const consult = v.steps.find(s => s.kind === 'Consultation')!;
  await api(`/api/visits/${v.id}/steps/${consult.id}/progress`, doctor.token, { status: 'Completed', reason: '', version: consult.version });
  v = await api<Visit>(`/api/visits/${v.id}`, cashier.token);
  await api(`/api/visits/${v.id}/settlement`, cashier.token, { outcome: 'Final', version: v.version, workRevision: v.workRevision });
  await expect(page.getByRole('heading', { name: 'Hướng dẫn nhà thuốc', exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Hoàn thành hành trình', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hành trình hướng dẫn đã hoàn thành', exact: true })).not.toBeVisible();
  await expect(page.getByText(/Mất kết nối hoặc quá thời gian chờ/).first()).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Hoàn thành hành trình', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hành trình hướng dẫn đã hoàn thành', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Liên kết tài khoản', exact: true })).toHaveCount(0);
  const navigate = async (label: string) => {
    if (await page.locator('.mobile-menu').isVisible()) await page.locator('.mobile-menu').click();
    await page.getByRole('button', { name: label, exact: true }).click();
  };
  await navigate('Hồ sơ cá nhân');
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue(name);
  await expect(page.getByRole('button', { name: 'Liên kết tài khoản', exact: true })).toHaveCount(0);
  await navigate('Đăng xuất');
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
  const email = `independent-${randomUUID()}@example.test`;
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Họ và tên', { exact: true }).fill(name);
  await page.getByLabel('Thông tin liên hệ', { exact: true }).fill('browser-fixture');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).last().click();
  await expect(page.getByText('Chưa có lượt khám được tiếp nhận.', { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/#visit=/);
  const account = await api<Session>('/api/auth/login', null, { email, password, language: 'vi' });
  expect(await api<Visit[]>('/api/visits', account.token)).toEqual([]);
  await navigate('Đăng xuất');
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
  const recovery = await api<{ recoveryCode: string }>(`/api/visits/${confirmed.visitId}/recovery`, staff.token, { attendeeVerified: true, verificationNote: 'Browser recovery after independent registration' });
  await page.getByRole('button', { name: 'Khôi phục quyền truy cập', exact: true }).click();
  await page.getByLabel('Mã khôi phục từ tiếp nhận', { exact: true }).fill(recovery.recoveryCode);
  await page.getByRole('button', { name: 'Khôi phục quyền truy cập', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`#visit=${confirmed.visitId}`));
  await expect(page.getByRole('heading', { name: 'Hành trình hướng dẫn đã hoàn thành', exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`#visit=${confirmed.visitId}`));
  await expect(page.getByRole('heading', { name: 'Hành trình hướng dẫn đã hoàn thành', exact: true })).toBeVisible();
  await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Your guidance journey is complete', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `artifacts/${info.project.name}-journey.png`, fullPage: true });
});

test('doctor interface saves a private draft, publishes after review and patient sees approved text', async ({ page }, info) => {
  const guest = await api<Session>('/api/auth/guest', null, { language: 'en' }); const reception = await api<Session>('/api/auth/login', null, { email: 'reception@demo.local', password, language: 'en' });
  const config = await api<Configuration>('/api/config'); const dep = config.departments.find(d => d.code === 'CONSULT')!;
  const req = await api<{ id: string }>('/api/requests', guest.token, { name: `Doctor UI ${Date.now()}`, contact: 'ui-fixture', description: '', requests: '', departmentId: dep.id });
  const r = await api<ReceptionRequest>(`/api/requests/${req.id}`, reception.token);
  const { visitId } = await api<{ visitId: string }>(`/api/requests/${req.id}/confirm`, reception.token, { version: r.version, departmentId: dep.id, locationId: config.locations.find(l => l.room === 'A101')!.id, attendeeVerified: true, verificationNote: 'Doctor UI fixture' });
  const ticket = await api<Ticket>(`/api/visits/${visitId}/ticket`, guest.token);
  await page.goto('/'); await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('en');
  await page.getByLabel('Email', { exact: true }).fill('doctor@demo.local'); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('combobox', { name: 'Assigned Visits', exact: true }).selectOption(visitId);
  await page.getByLabel('Diagnosis summary', { exact: true }).fill('Tóm tắt kiểm thử trình duyệt đã duyệt');
  await page.getByLabel('Care instructions', { exact: true }).fill('Hướng dẫn kiểm thử trình duyệt đã duyệt');
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
  await expect(page.locator('.version-chip').filter({ hasText: 'Draft' })).toBeVisible();
  await expect(page.getByLabel('I have reviewed and take responsibility for the published content', { exact: true }).first()).toBeVisible();
  expect((await api<Content>(`/api/visits/${visitId}/content`, guest.token)).summary).toBeNull();
  await page.getByLabel('I have reviewed and take responsibility for the published content', { exact: true }).first().check();
  await page.getByRole('button', { name: 'Publish to patient', exact: true }).click();
  await expect.poll(async () => (await api<Content>(`/api/visits/${visitId}/content`, guest.token)).summary?.diagnosis).toBe('Tóm tắt kiểm thử trình duyệt đã duyệt');
  await expect(page.locator('.visit-meta').getByText(ticket.number, { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `artifacts/${info.project.name}-doctor.png`, fullPage: true });
});

test('reception validates QR and cashier closes a clinically ready visit through staff interfaces', async ({ page, context }) => {
  const guest = await api<Session>('/api/auth/guest', null, { language: 'en' });
  const config = await api<Configuration>('/api/config'); const dep = config.departments.find(d => d.code === 'CONSULT')!;
  const request = await api<{ id: string }>('/api/requests', guest.token, { name: `Staff UI ${Date.now()}`, contact: 'ui-fixture', description: '', requests: '', departmentId: dep.id });
  const detail = await api<ReceptionRequest>(`/api/requests/${request.id}`, guest.token);
  await page.goto('/'); await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('en');
  await page.getByLabel('Email', { exact: true }).fill('reception@demo.local'); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('button', { name: 'Scan QR code', exact: true }).click();
  await page.getByLabel('Paste QR code or link', { exact: true }).fill(detail.code);
  await page.getByRole('button', { name: 'Validate code', exact: true }).click();
  await page.getByLabel('I verified the attendee in person', { exact: true }).check();
  await page.getByLabel('Verification note', { exact: true }).fill('Identity checked for UI acceptance');
  await page.getByRole('button', { name: 'Confirm reception & issue ticket', exact: true }).click();
  await expect.poll(async () => (await api<ReceptionRequest>(`/api/requests/${request.id}`, guest.token)).visitId).toBeTruthy();
  const { visitId } = await api<ReceptionRequest>(`/api/requests/${request.id}`, guest.token);
  const doctor = await api<Session>('/api/auth/login', null, { email: 'doctor@demo.local', password, language: 'en' });
  const v = await api<Visit>(`/api/visits/${visitId}`, doctor.token); const step = v.steps.find(s => s.kind === 'Consultation')!;
  await api(`/api/visits/${visitId}/steps/${step.id}/progress`, doctor.token, { version: step.version, status: 'Completed', reason: '' });
  await context.clearCookies(); await page.reload();
  await page.getByLabel('Email', { exact: true }).fill('cashier@demo.local'); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('combobox', { name: 'Assigned Visits', exact: true }).selectOption(visitId!);
  await page.getByRole('combobox', { name: 'Confirmed hospital outcome', exact: true }).selectOption('NoPaymentRequired');
  await page.locator('main input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Record outcome', exact: true }).click();
  await expect.poll(async () => (await api<Visit>(`/api/visits/${visitId}`, guest.token)).status).toBe('Closed');
  expect((await api<Visit>(`/api/visits/${visitId}`, guest.token)).journeyStatus).toBe('Completed');
});

test('reception replaces the displayed ticket QR after every reissue', async ({ page }) => {
  const guest = await api<Session>('/api/auth/guest', null, { language: 'en' });
  const reception = await api<Session>('/api/auth/login', null, { email: 'reception@demo.local', password });
  const config = await api<Configuration>('/api/config');
  const dep = config.departments.find(d => d.code === 'CONSULT')!;
  const name = `Reissue UI ${randomUUID()}`;
  const request = await api<{ id: string }>('/api/requests', guest.token, { name, contact: 'ui-fixture', description: '', requests: '', departmentId: dep.id });
  const { visitId } = await api<{ visitId: string }>(`/api/requests/${request.id}/confirm`, reception.token, {
    version: 1, departmentId: dep.id, locationId: config.locations.find(l => l.room === 'A101')!.id,
    attendeeVerified: true, verificationNote: 'Repeated reissue UI fixture',
  });
  let ticket = await api<Ticket>(`/api/visits/${visitId}/ticket`, guest.token);
  const original = ticket;
  await page.goto('/');
  await page.getByLabel('Ngôn ngữ', { exact: true }).selectOption('en');
  await page.getByLabel('Email', { exact: true }).fill('reception@demo.local');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.locator('.record-row').filter({ hasText: name }).click();
  await expect(page.locator('.qr-panel')).toHaveCount(1);
  await expect(page.locator('.qr-panel code')).toHaveText(ticket.code);
  await page.getByText('Recover access', { exact: true }).click();
  await page.getByLabel('Verification note', { exact: true }).fill('Verified repeat ticket replacement');
  await page.getByLabel('I verified the attendee in person', { exact: true }).check();
  const replace = page.getByRole('button', { name: 'Replace ticket access code', exact: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    const previousCode = ticket.code;
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/visits/${visitId}/reissue`) && r.request().method() === 'POST'),
      replace.click(),
    ]);
    expect(response.status()).toBe(200);
    ticket = await api<Ticket>(`/api/visits/${visitId}/ticket`, guest.token);
    expect(ticket.code).not.toBe(previousCode);
    expect(ticket.visitId).toBe(original.visitId);
    expect(ticket.journeyId).toBe(original.journeyId);
    expect(ticket.number).toBe(original.number);
    await expect(page.locator('.qr-panel')).toHaveCount(1);
    await expect(page.locator('.qr-panel code')).toHaveText(ticket.code);
    const rejected = await page.request.post(`${apiUrl}/api/tickets/redeem`, {
      headers: { 'X-Hospital-Client': '1', Authorization: `Bearer ${guest.token}`, 'Idempotency-Key': randomUUID() },
      data: { code: previousCode },
    });
    expect(rejected.status()).toBe(410);
    expect((await rejected.json()).title).toBe('qrReplaced');
    await api('/api/tickets/redeem', guest.token, { code: ticket.code });
  }

  await page.route(`**/api/visits/${visitId}/reissue`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ title: 'serverError', status: 503, detail: 'Synthetic reissue failure' }),
  }));
  await replace.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.qr-panel')).toHaveCount(1);
  await expect(page.locator('.qr-panel code')).toHaveText(ticket.code);
});

test('reception and patient can page back to requests older than the newest 100', async ({ page, context }) => {
  const email = `request-pages-${randomUUID()}@example.test`;
  const patient = await api<Session>('/api/auth/register', null, { email, password, name: 'Pagination patient', contact: 'pagination-contact', language: 'en' });
  const config = await api<Configuration>('/api/config');
  const department = config.departments.find(d => d.code === 'CONSULT')!;
  const marker = randomUUID();
  let oldestId = '';
  for (let index = 0; index < 101; index++) {
    const request = await api<{ id: string }>('/api/requests', patient.token, {
      name: `Pagination ${marker} ${index}`, contact: 'pagination-contact', description: '', requests: '', departmentId: department.id,
    });
    if (index === 0) oldestId = request.id;
  }
  const oldestName = `Pagination ${marker} 0`;
  const oldest = await api<ReceptionRequest>(`/api/requests/${oldestId}`, patient.token);
  await page.addInitScript(() => localStorage.setItem('hospital.language', 'en'));
  for (const role of ['reception', 'patient']) {
    await context.clearCookies();
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).fill(role === 'reception' ? 'reception@demo.local' : email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    if (role === 'patient') await page.getByRole('button', { name: 'Prepare for reception', exact: true }).click();
    const previous = page.getByRole('button', { name: 'Previous page', exact: true });
    const next = page.getByRole('button', { name: 'Next page', exact: true });
    const oldestRow = page.locator('.record-row').filter({ hasText: oldestName });
    await expect(page.locator('.record-row')).toHaveCount(100);
    await expect(oldestRow).toHaveCount(0);
    await expect(previous).toBeDisabled();
    await next.click();
    await expect(oldestRow).toBeVisible();
    await expect(previous).toBeEnabled();
    if (role === 'patient') {
      await expect(page.locator('.record-row')).toHaveCount(1);
      await expect(next).toBeDisabled();
    }
    await oldestRow.click();
    if (role === 'reception') await expect(page.getByRole('heading', { name: oldestName, exact: true })).toBeVisible();
    else {
      await expect(page.getByRole('heading', { name: 'Reception QR', exact: true })).toBeVisible();
      await expect(page.locator('.qr-panel code')).toHaveText(oldest.code);
    }
    await previous.click();
    await expect(page.locator('.record-row')).toHaveCount(100);
    await expect(oldestRow).toHaveCount(0);
    await expect(previous).toBeDisabled();
    if (role === 'patient') {
      await next.click();
      await expect(oldestRow).toBeVisible();
      await page.getByRole('button', { name: 'Without an appointment', exact: true }).click();
      const newName = `Newest ${marker}`;
      await page.getByLabel('Full name', { exact: true }).fill(newName);
      await page.getByRole('button', { name: 'Submit information', exact: true }).click();
      await expect(page.locator('.record-row').first()).toContainText(newName);
      await expect(previous).toBeDisabled();
    }
  }
});

test('switching from Guest to an independent account discards old selection and delayed narration', async ({ page, context }, info) => {
  const guest = await api<Session>('/api/auth/guest', null, { language: 'en' });
  const reception = await api<Session>('/api/auth/login', null, { email: 'reception@demo.local', password, language: 'en' });
  const config = await api<Configuration>('/api/config');
  const department = config.departments.find(d => d.code === 'CONSULT')!;
  const request = await api<{ id: string }>('/api/requests', guest.token, { name: 'Guest private fixture', contact: 'guest-private-contact', description: '', requests: '', departmentId: department.id });
  const { visitId } = await api<{ visitId: string }>(`/api/requests/${request.id}/confirm`, reception.token, { version: 1, departmentId: department.id, locationId: config.locations.find(l => l.room === 'A101')!.id, attendeeVerified: true, verificationNote: 'Session boundary browser fixture' });
  const ticket = await api<Ticket>(`/api/visits/${visitId}/ticket`, guest.token);
  await api('/api/tickets/redeem', guest.token, { code: ticket.code });
  await context.addCookies([{ name: 'hospital_session', value: guest.token!, url: info.project.use.baseURL ?? process.env.WEB_URL ?? 'http://127.0.0.1:5180', httpOnly: true, sameSite: 'Strict' }]);
  await page.addInitScript(() => {
    localStorage.setItem('hospital.language', 'en');
    const calls = { spoken: 0, cancelled: 0 };
    Object.defineProperty(window, 'pb003Speech', { value: calls });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(public text: string) {} } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel: () => { calls.cancelled++; },
      getVoices: () => [{ lang: 'en-US' }],
      speak: () => { calls.spoken++; },
    } });
  });
  let release: (() => void) | undefined;
  await page.route(`**/api/visits/${visitId}/narration`, async route => {
    const response = await route.fetch();
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ response });
  });
  await page.goto(`/#visit=${visitId}`);
  await expect(page.getByRole('heading', { name: 'Initial consultation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  await expect.poll(() => !!release).toBe(true);
  const navigate = async (label: string) => {
    if (await page.locator('.mobile-menu').isVisible()) await page.locator('.mobile-menu').click();
    await page.getByRole('button', { name: label, exact: true }).click();
  };
  await navigate('Sign out');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  const email = `session-boundary-${randomUUID()}@example.test`;
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Full name', { exact: true }).fill('Independent account fixture');
  await page.getByLabel('Contact information', { exact: true }).fill('independent-contact');
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Hello, Independent account fixture', exact: true })).toBeVisible();
  await expect(page.getByText('No confirmed hospital Visits yet.', { exact: true })).toBeVisible();
  const delayed = page.waitForResponse(response => response.url().endsWith(`/visits/${visitId}/narration`));
  release!();
  await delayed;
  await expect.poll(() => page.evaluate(() => (window as unknown as { pb003Speech: { spoken: number } }).pb003Speech.spoken)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { pb003Speech: { cancelled: number } }).pb003Speech.cancelled)).toBeGreaterThan(0);
  await expect(page).not.toHaveURL(/#visit=/);
  await navigate('My journey');
  await expect(page.getByText('No confirmed hospital Visits yet.', { exact: true })).toBeVisible();
  await expect(page.getByText(ticket.number, { exact: true })).toHaveCount(0);
  await navigate('My profile');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Independent account fixture');
  await expect(page.getByRole('button', { name: 'Link account', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `artifacts/${info.project.name}-pb003-independent-profile.png`, fullPage: true });
});
