import { test, expect, Page } from '@playwright/test';

test('patient web supports a mobile viewport and keyboard entry', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto('/');
  await page.locator('#guest-continue-btn').focus();
  await page.keyboard.press('Enter');
  await page.locator('#walkin-name').fill('Mobile browser patient');
  await page.locator('#walkin-phone').fill('0901234567');
  await page.locator('#walkin-condition').fill('Reception review');
  await page.locator('#walkin-submit-btn').click();
  await expect(page.locator('#reception-qr-token svg')).toBeVisible();
  await page.locator('#patient-tab-ticket-btn').click();
  await expect(page.locator('#ticket-token-input')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:'../../.artifacts/patient-mobile-web.png',fullPage:true});
  await context.close();
});

async function staff(page: Page, role: string, email: string) {
  await page.goto('/');
  await page.locator('#role-btn-'+role).click();
  await page.locator('#staff-email').fill(email);
  await page.locator('#staff-password').fill('Demo@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

test('guest → reception → doctor → services → publication → settlement → pharmacy → reload', async ({ browser }) => {
  const patient = await browser.newPage();
  const reception = await browser.newPage();
  const doctor = await browser.newPage();
  const lab = await browser.newPage();
  const cashier = await browser.newPage();
  const errors: string[] = [];
  for (const page of [patient,reception,doctor,lab,cashier]) page.on('pageerror', e => errors.push(e.message));
  await patient.goto('/');
  await patient.locator('#guest-continue-btn').click();
  await patient.locator('#walkin-name').fill('Browser Synthetic Patient');
  await patient.locator('#walkin-phone').fill('0901234567');
  await patient.locator('#walkin-condition').fill('Information for reception review');
  await patient.locator('#walkin-submit-btn').click();
  await expect(patient.locator('#reception-qr-token svg')).toBeVisible();
  const qr = (await patient.locator('#reception-qr-token code').innerText()).trim();

  await staff(reception,'receptionist','receptionist@hospital.demo');
  await reception.locator('#reception-qr-input').fill(qr);
  await reception.locator('#reception-lookup-btn').click();
  await expect(reception.locator('#reception-workspace')).toContainText('Browser Synthetic Patient');
  await reception.locator('#reception-confirm-btn').click();
  await expect(reception.locator('#issued-ticket-qr svg')).toBeVisible();
  const code = (await reception.locator('#issued-ticket-qr code').innerText()).trim();

  await patient.locator('#patient-tab-ticket-btn').click();
  await patient.locator('#ticket-token-input').fill(code);
  await patient.locator('#redeem-ticket-submit-btn').click();
  await expect(patient.locator('#current-journey-card')).toBeVisible();
  const visitId = await patient.evaluate(() => Object.keys(localStorage).filter(k=>k.startsWith('activeVisit:')).map(k=>localStorage.getItem(k))[0]);

  await staff(doctor,'doctor','doctor@hospital.demo');
  await doctor.locator('#doctor-visit-select').selectOption(visitId!);
  await doctor.locator('#doctor-order-btn').click();
  await expect(doctor.locator('.step-item').filter({hasText:'Xét nghiệm máu'})).toBeVisible();
  await doctor.locator('#doctor-complete-0').click();
  await doctor.locator('#diagnosisVi').fill('Doctor reviewed source');
  await doctor.locator('#careInstructionsVi').fill('Doctor reviewed care');
  await doctor.locator('#doctor-save-draft-btn').click();
  await doctor.locator('#doctor-publish-btn').click();
  await patient.locator('#patient-tab-history-btn').click();
  await expect(patient.locator('#patient-diagnosis-details')).toContainText('Doctor reviewed source');

  await staff(lab,'service','labstaff@hospital.demo');
  await lab.locator('#service-visit-select').selectOption(visitId!);
  await lab.locator('#complete-step-btn-0').click();
  await doctor.getByRole('button',{name:'Làm mới',exact:true}).click();
  await doctor.locator('#doctor-visit-select').selectOption('');
  await doctor.locator('#doctor-visit-select').selectOption(visitId!);
  await doctor.locator('#doctor-complete-3').click();

  await staff(cashier,'cashier','cashier@hospital.demo');
  await cashier.locator('#cashier-visit-select').selectOption(visitId!);
  await cashier.locator('#process-settlement-btn').click();
  await expect(cashier.locator('#settlement-result-alert')).toContainText('Lượt khám đã kết thúc');
  await patient.locator('#patient-tab-journey-btn').click();
  await patient.locator('#journey-refresh-btn').click();
  await patient.locator('#complete-pharmacy-btn').click();
  await expect(patient.locator('#current-journey-card')).toContainText('Đã hoàn tất');
  await patient.reload();
  await patient.locator('#patient-tab-journey-btn').click();
  await expect(patient.locator('#current-journey-card')).toContainText('Đã hoàn tất');
  await patient.locator('#lang-toggle-btn').click();
  await expect(patient.locator('#current-journey-card')).toContainText('Completed');
  await patient.screenshot({path:'../../.artifacts/patient-completed.png',fullPage:true});
  expect(errors).toEqual([]);
  for (const page of [patient,reception,doctor,lab,cashier]) await page.close();
});

test('staff workspaces require sign-in and QR entry preserves ticket purpose', async ({ page }) => {
  await page.goto('/?ticket=TKT_unverified');
  await expect(page.locator('#guest-continue-btn')).toBeVisible();
  await page.locator('#role-btn-admin').click();
  await expect(page.locator('#staff-email')).toBeVisible();
  await expect(page.locator('#admin-workspace')).toHaveCount(0);
  await page.locator('#role-btn-patient').click();
  await page.locator('#guest-continue-btn').click();
  await page.locator('#patient-tab-ticket-btn').click();
  await expect(page.locator('#ticket-token-input')).toHaveValue('TKT_unverified');
  await page.locator('#redeem-ticket-submit-btn').click();
  await expect(page.locator('#ticket-error-alert')).toBeVisible();
});
