import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

// Opt-in acceptance on a dedicated emulator + isolated SQL-backed API.
// Build the APK with http://127.0.0.1:5280; adb reverse maps it to API_URL's port.
for (const name of ["API_URL", "WEB_URL", "DEMO_PASSWORD", "ACCEPTANCE_DB"])
  assert.ok(process.env[name], `Set ${name} explicitly for isolated acceptance.`);
for (const name of ["API_URL", "WEB_URL"])
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(process.env[name]).hostname), "Use loopback test services only.");
assert.match(process.env.ACCEPTANCE_DB, /^HospitalAcceptance_[A-Za-z0-9_]+$/);
const { adb, api, byLabel, checks, fill, locate, nodes, passed, password, restart, screenshot, tap, verifyInstalledApk } = await import("./android-driver.mjs");
const report = "artifacts/android/android-reception.json";
const apiPort = new URL(process.env.API_URL).port || "80";
let browser, disconnected = false;
const reconnect = () => { adb("reverse", "tcp:5280", `tcp:${apiPort}`); disconnected = false; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForRequest(token, name) {
  for (let i = 0; i < 30; i++) {
    const rows = await api("/api/v2/requests", token);
    const row = rows.find(r => r.patientName === name);
    if (row) return row;
    await delay(500);
  }
  throw new Error("Native submitted request was not found.");
}
try {
  assert.match(adb("emu", "avd", "name"), /cnpm_api36/, "Use the dedicated CNPM acceptance emulator.");
  const apkSha256 = verifyInstalledApk();
  writeFileSync(report, JSON.stringify({ status: "running", apkSha256 }) + "\n");
  assert.equal((await api("/api/config")).prdV2Enabled, true);
  reconnect();
  // Layout settings belong to the named acceptance AVD, as in android-smoke.
  adb("shell", "wm", "size", "720x1280"); adb("shell", "wm", "density", "240");
  await restart("hguide://entry?language=en");
  await locate(n => ["Overview", "Continue as guest"].some(label => byLabel(label)(n)), { scroll: true });
  if (nodes().some(byLabel("Overview"))) { await tap("Overview"); await tap("Sign out"); }
  await tap("Continue as guest");
  await tap("Prepare for reception");
  await locate("Please add your full name in your profile before submitting a request.", { scroll: true });
  await tap("My profile");
  const name = `PB009 Native ${randomUUID().slice(0, 8)}`;
  await fill("Full name", name); await fill("Contact information", "native-fixture"); await tap("Save changes");
  await tap("Overview"); await tap("Prepare for reception");
  const original = `  PB009 original ${randomUUID()}  `;
  await tap("简体中文");
  await fill("What you would like to tell staff", original);
  const forbidden = /Without an appointment|With an appointment|Reception QR|Link account/;
  assert.ok(!nodes().some(n => forbidden.test(n["content-desc"] || n.text || "")));
  passed("Guest completes profile; native V2 form has no booking/link/QR controls");

  adb("reverse", "--remove", "tcp:5280"); disconnected = true;
  await tap("Submit information");
  await locate("Retry", { scroll: true, timeout: 30000 });
  // Force-stop after an unconfirmed send: draft + command/key must survive process death.
  await restart(); reconnect();
  await locate(n => ["Overview", "Retry"].some(label => byLabel(label)(n)), { scroll: true });
  if (!nodes().some(byLabel("Overview"))) await tap("Retry");
  await locate("Overview", { scroll: true });
  await tap("Prepare for reception");
  const restored = await locate(n => n.class === "android.widget.EditText" && n["content-desc"] === "What you would like to tell staff", { scroll: true });
  assert.equal(restored.text, original);
  await tap("Retry");
  const staff = await api("/api/auth/login", null, { email: "reception@demo.local", password, language: "en" });
  const request = await waitForRequest(staff.token, name);
  assert.equal(request.description, original); assert.equal(request.sourceLanguage, "zh");
  assert.equal((await api("/api/v2/requests", staff.token)).filter(r => r.patientName === name).length, 1);
  passed("Offline/restart/retry preserves draft and source and creates exactly one request");

  browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
  const context = await browser.newContext({ baseURL: process.env.WEB_URL });
  await context.addCookies([{ name: "hospital_session", value: staff.token, url: process.env.WEB_URL, httpOnly: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("hospital.language", "en"));
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const clinics = await api("/api/v2/reception/clinics", staff.token);
  assert.ok(clinics.length);
  await page.getByLabel("Location", { exact: true }).selectOption(clinics[0].clinicLocationId);
  await page.getByLabel("Verification note", { exact: true }).fill("Synthetic PB009 native acceptance verification");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Confirm reception & issue ticket", exact: true }).click();
  await expect(page.getByTestId("ticket-v2")).toBeVisible();
  const confirmed = await api(`/api/v2/requests/${request.id}`, staff.token);
  assert.ok(confirmed.visitId);
  const before = await api(`/api/visits/${confirmed.visitId}/ticket`, staff.token);
  await locate("Your visit journey", { scroll: true, timeout: 45000 });
  await tap("View ticket"); await locate(before.issuedOn + " · " + before.number, { scroll: true });
  assert.ok(!nodes().some(n => /Open journey|Scan QR code/.test(n["content-desc"] || n.text || "")));
  screenshot("pb009-native-ticket");
  passed("Real Reception web confirmation opens native active Journey and snapshot ticket without redeem");

  await restart(); await locate("Your visit journey", { scroll: true });
  await tap("View ticket"); await locate(before.issuedOn + " · " + before.number, { scroll: true });
  await restart(`hguide://entry?visit=${confirmed.visitId}&language=vi`);
  await locate("Hành trình của bạn", { scroll: true });
  const after = await api(`/api/visits/${confirmed.visitId}/ticket`, staff.token);
  assert.deepEqual(after, before);
  passed("Cold start/Visit deep link retains original Visit, date, number and snapshot across locale change");

  const recovery = await api(`/api/visits/${confirmed.visitId}/recovery`, staff.token,
    { attendeeVerified: true, verificationNote: "Synthetic PB009 Guest recovery verification" });
  await restart("hguide://entry?language=en"); await tap("Overview"); await tap("Sign out");
  await tap("Recover access"); await fill("Recovery code from reception", recovery.recoveryCode);
  await tap(n => n["content-desc"] === "Recover access" && n.clickable === "true" && n.enabled === "true");
  await locate("Your visit journey", { scroll: true });
  passed("Verified Guest recovery opens the original Visit directly");
  writeFileSync(report, JSON.stringify({ checkedAt: new Date().toISOString(), status: "passed", apkSha256, checks,
    limitations: ["Emulator only; camera, physical printing and device speech are outside PB-009 acceptance."] }, null, 2) + "\n");
} catch (error) {
  try { screenshot("pb009-native-failure"); } catch { /* Preserve original failure. */ }
  writeFileSync(report, JSON.stringify({ checkedAt: new Date().toISOString(), status: "failed", checks, error: error.message }, null, 2) + "\n");
  throw error;
} finally {
  if (disconnected) reconnect();
  await browser?.close();
}
