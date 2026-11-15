import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
for (const key of ["API_URL", "DEMO_PASSWORD", "ACCEPTANCE_DB"])
  assert.ok(process.env[key], `Set ${key} for isolated PB-025 acceptance.`);
assert.match(process.env.ACCEPTANCE_DB, /^HospitalAcceptance_\d+$/);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(process.env.API_URL).hostname),
);
const {
  adb,
  api,
  checks,
  fill,
  locate,
  nodes,
  passed,
  password,
  restart,
  screenshot,
  tap,
  verifyInstalledApk,
} = await import("./android-driver.mjs");
const label = "Automatically read instructions and queue calls";
const isToggle = (n) =>
  n["content-desc"] === label && "checked" in n && n.clickable === "true";
const report = "artifacts/android/android-narration.json";
try {
  assert.match(
    adb("emu", "avd", "name"),
    /cnpm_api36/,
    "Use the dedicated acceptance emulator.",
  );
  const apkSha256 = verifyInstalledApk();
  adb(
    "reverse",
    "tcp:5280",
    `tcp:${new URL(process.env.API_URL).port || "80"}`,
  );
  assert.equal((await api("/api/config")).prdV2Enabled, true);
  await restart("hguide://entry?language=en");
  await locate(
    (n) =>
      ["Overview", "Continue as guest"].includes(n["content-desc"] || n.text),
    { scroll: true },
  );
  if (nodes().some((n) => (n["content-desc"] || n.text) === "Overview")) {
    await tap("Overview");
    await tap("Sign out");
  }
  const email = `pb025-${randomUUID()}@example.test`;
  const patient = await api("/api/auth/register", null, {
    email,
    password,
    name: "PB025 Native",
    contact: "synthetic-contact",
    language: "en",
  });
  const reception = await api("/api/auth/login", null, {
    email: "reception@demo.local",
    password,
  });
  const doctor = await api("/api/auth/login", null, {
    email: "doctor@demo.local",
    password,
  });
  const request = await fetch(process.env.API_URL + "/api/v2/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      Authorization: `Bearer ${patient.token}`,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      contact: "synthetic-contact",
      description: "PB025",
      sourceLanguage: "en",
      preferredDepartmentId: null,
    }),
  });
  assert.equal(request.status, 201);
  const req = await request.json();
  const clinic = (await api("/api/v2/reception/clinics", reception.token)).find(
    (c) => c.room === "A101",
  );
  assert.ok(clinic, "Seeded A101 clinic is required.");
  const confirmed = await api(
    `/api/v2/requests/${req.id}/confirm`,
    reception.token,
    {
      version: req.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "PB025 isolated native acceptance",
    },
  );
  await fill("Email", email);
  await fill("Password", password);
  await tap(
    (n) =>
      n["content-desc"] === "Sign in" &&
      n.clickable === "true" &&
      n.class !== "android.widget.RadioButton",
  );
  const visit = confirmed.visit;
  await restart(`hguide://entry?visit=${visit.id}&language=en`);
  const toggle = await locate(isToggle, { scroll: true });
  assert.equal(toggle.checked, "true");
  await tap(isToggle);
  assert.equal((await locate(isToggle, { scroll: true })).checked, "false");
  await api(`/api/v2/visits/${visit.id}/consultations/accept`, doctor.token, {
    version: visit.version,
  });
  await locate("In consultation", { scroll: true });
  await tap("Listen");
  // Both speech and readable fallback are valid on emulators without TTS data.
  await locate(
    (n) =>
      (n.text || "").includes(visit.ticket.number) &&
      /Room:|Phòng:/.test(n.text || ""),
    { scroll: true },
  );
  screenshot("native-pb025-narration");
  passed(
    "Default autoplay, toggle off and manual narration expose the correct ticket/room text",
  );
  adb("shell", "input", "keyevent", "KEYCODE_HOME");
  // Bring the existing process forward; do not force-stop it for lifecycle checks.
  adb(
    "shell",
    "am",
    "start",
    "-W",
    "-n",
    "vn.edu.cnpm.hospitalguide/.MainActivity",
  );
  await locate("In consultation", { scroll: true });
  assert.equal((await locate(isToggle, { scroll: true })).checked, "false");
  passed(
    "Foreground revalidates current state and retains the mounted screen's autoplay choice",
  );
  await tap("Overview");
  await tap("Sign out");
  await locate("Continue as guest", { scroll: true });
  passed("Logout unmounts private narration controls");
  writeFileSync(
    report,
    JSON.stringify(
      {
        passed: true,
        apkSha256,
        checks,
        realAudio:
          "Requires separate listening verification; UI assertions do not prove audible output.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(
    report,
    JSON.stringify({ passed: false, checks, error: error.message }, null, 2),
  );
  throw error;
}
