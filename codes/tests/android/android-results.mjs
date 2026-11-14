import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

for (const key of ["API_URL", "DEMO_PASSWORD", "ACCEPTANCE_DB"]) assert.ok(process.env[key], `Set ${key} for isolated native acceptance.`);
assert.ok(["127.0.0.1", "localhost"].includes(new URL(process.env.API_URL).hostname));
assert.match(process.env.ACCEPTANCE_DB, /^HospitalAcceptance_\d+$/);
const { adb, api, checks, fill, locate, nodes, passed, password, restart, screenshot, tap, verifyInstalledApk } = await import("./android-driver.mjs");
const report = "artifacts/android/android-results.json";
try {
  assert.match(adb("emu", "avd", "name"), /cnpm_api36/, "Use the dedicated acceptance emulator.");
  const apkSha256 = verifyInstalledApk();
  adb("reverse", "tcp:5280", `tcp:${new URL(process.env.API_URL).port || "80"}`);
  assert.equal((await api("/api/config")).prdV2Enabled, true);
  const login = name => api("/api/auth/login", null, { email: `${name}@demo.local`, password });
  const reception = await login("reception"), doctor = await login("doctor");
  await restart("hguide://entry?language=en");
  await locate(n => ["Overview", "Continue as guest"].some(label => n.text === label || n["content-desc"] === label), { scroll: true });
  if (nodes().some(n => n.text === "Overview" || n["content-desc"] === "Overview")) { await tap("Overview"); await tap("Sign out"); }
  const email = `pb016-${randomUUID()}@example.test`;
  await tap("Create account"); await fill("Email", email); await fill("Password", password);
  await fill("Full name", "PB016 Native"); await fill("Contact information", "synthetic-contact");
  await tap(n => n["content-desc"] === "Create account" && n.clickable === "true" && n.class !== "android.widget.RadioButton");
  await locate("No confirmed hospital Visits yet.", { scroll: true });
  const patient = await api("/api/auth/login", null, { email, password });
  const requestResponse = await fetch(process.env.API_URL + "/api/v2/requests", { method: "POST", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", Authorization: `Bearer ${patient.token}`, "Idempotency-Key": randomUUID() }, body: JSON.stringify({ contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }) });
  assert.equal(requestResponse.status, 201); const req = await requestResponse.json();
  const clinic = (await api("/api/v2/reception/clinics", reception.token)).find(c => c.room === "A101");
  const { visit } = await api(`/api/v2/requests/${req.id}/confirm`, reception.token, { version: req.version, clinicLocationId: clinic.clinicLocationId, clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "PB016 native verification" });
  const accepted = await api(`/api/v2/visits/${visit.id}/consultations/accept`, doctor.token, { version: visit.version });
  await tap("Results & care"); await locate("The doctor has not published information yet.", { scroll: true });
  passed("Native result screen exposes no unpublished examination");
  const load = async kind => (await api(`/api/v2/clinical-catalog/${kind}`, doctor.token)).items[0];
  const [diagnosis, template] = await Promise.all([load("diagnoses"), load("templates")]);
  const pick = x => ({ id: x.id, version: x.version });
  const preview = await api(`/api/v2/visits/${visit.id}/examination/preview`, doctor.token, { version: accepted.version, symptomSelections: [], signSelections: [], diagnosisSelections: [pick(diagnosis)], template: pick(template) });
  const done = await api(`/api/v2/visits/${visit.id}/examination/complete`, doctor.token, { version: accepted.version, previewId: preview.previewId });
  assert.equal(done.visit.status, "Active");
  await api(`/api/visits/${visit.id}/follow-ups`, doctor.token, { departmentId: visit.departmentId, recommendedAt: new Date(Date.now() + 86400000).toISOString(), text: "PB016 native original recommendation", language: "vi", reviewed: true });
  await locate(n => n.text?.includes(`${diagnosis.code} · ${diagnosis.nameVi}`), { scroll: true });
  await locate("PB016 native original recommendation", { scroll: true });
  assert.ok(!nodes().some(n => /Book follow-up|Link account/.test(n.text || n["content-desc"] || "")));
  screenshot("native-pb016-confirmed-results"); passed("Structured native results and recommendation appear before settlement without booking/link controls");
  await restart("hguide://entry?language=vi"); await tap("Kết quả & hướng dẫn");
  await locate(n => n.text?.includes(diagnosis.code), { scroll: true });
  screenshot("native-pb016-vietnamese-results"); passed("Native language switch preserves confirmed source and SecureStore session");
  // Legacy history uses an independent owner; no Guest linking or automatic attendance.
  const legacyEmail = `pb016-history-${randomUUID()}@example.test`;
  const legacy = await api("/api/auth/register", null, { email: legacyEmail, password, name: "PB016 Native Legacy", contact: "synthetic-contact", language: "en" });
  const legacyReq = await api("/api/requests", legacy.token, { name: "PB016 Native Legacy", contact: "synthetic-contact", description: "Legacy", requests: "", departmentId: visit.departmentId });
  const detail = await api(`/api/requests/${legacyReq.id}`, reception.token);
  const old = await api(`/api/requests/${legacyReq.id}/confirm`, reception.token, { version: detail.version, departmentId: visit.departmentId, locationId: visit.clinicLocationId, attendeeVerified: true, verificationNote: "PB016 native historical fixture" });
  const draft = await api(`/api/visits/${old.visitId}/drafts`, doctor.token, { diagnosis: "PB016 native legacy diagnosis", explanation: "", instructions: "PB016 native legacy care", language: "vi", documentReference: "PB016 history" });
  const drafts = await api(`/api/visits/${old.visitId}/drafts`, doctor.token);
  await api(`/api/visits/${old.visitId}/drafts/${draft.id}/publish`, doctor.token, { version: drafts.find(x => x.id === draft.id).version, reviewed: true });
  await restart("hguide://entry?language=en"); await tap("Overview"); await tap("Sign out");
  await fill("Email", legacyEmail); await fill("Password", password); await tap(n => n["content-desc"] === "Sign in" && n.clickable === "true" && n.class !== "android.widget.RadioButton");
  await tap("Results & care"); await locate("PB016 native legacy diagnosis", { scroll: true });
  screenshot("native-pb016-legacy-results"); passed("Native independent Account reads published legacy history");
  writeFileSync(report, JSON.stringify({ status: "pass", apkSha256, checks }, null, 2) + "\n");
} catch (error) {
  writeFileSync(report, JSON.stringify({ status: "fail", checks, error: error.message }, null, 2) + "\n"); throw error;
} finally { adb("reverse", "--remove", "tcp:5280"); }
