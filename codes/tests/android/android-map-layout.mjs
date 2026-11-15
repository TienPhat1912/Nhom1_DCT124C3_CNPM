import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  hospitalMap,
  mapLabel,
} from "../../packages/shared/src/hospitalMap.ts";
import {
  mapDepartments,
  departmentLabel,
  departmentLocation,
} from "../../packages/shared/src/hospitalDepartments.ts";
import { localizeText } from "../../packages/shared/src/localizedText.ts";

for (const key of ["API_URL", "DEMO_PASSWORD", "ACCEPTANCE_DB"])
  assert.ok(process.env[key], `Set ${key} for isolated PB-033 acceptance.`);
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
const report = "artifacts/android/android-map-layout.json";
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
  const email = `pb033-${randomUUID()}@example.test`;
  const patient = await api("/api/auth/register", null, {
    email,
    password,
    name: "PB033 Native",
    contact: "synthetic-contact",
    language: "en",
  });
  const reception = await api("/api/auth/login", null, {
    email: "reception@demo.local",
    password,
  });
  const response = await fetch(process.env.API_URL + "/api/v2/requests", {
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
      description: "PB033 map fixture",
      sourceLanguage: "en",
      preferredDepartmentId: null,
    }),
  });
  assert.equal(response.status, 201);
  const req = await response.json();
  const clinic = (await api("/api/v2/reception/clinics", reception.token)).find(
    (c) => c.room === "A101",
  );
  assert.ok(clinic);
  const { visit } = await api(
    `/api/v2/requests/${req.id}/confirm`,
    reception.token,
    {
      version: req.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "PB033 isolated map acceptance",
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
  await restart(`hguide://entry?visit=${visit.id}&language=en`);
  await tap("Directions");
  await tap('Manual');
  for (const [area, floor, id, name] of [
    ["A", "1", "room-P01", "same-floor"],
    ["A", "0", "lobby-a", "cross-floor"],
    ["B", "2", "room-B201", "cross-building"],
  ]) {
    await tap(
      (n) => n["content-desc"] === `Building ${area}` && n.checkable === "true",
    );
    await tap(floor === "0" ? "Ground floor" : `Floor ${floor}`);
    await tap(
      mapLabel(
        hospitalMap.nodes.find((n) => n.id === id),
        "en",
      ),
    );
    await tap("Find route");
    await locate("Shortest route", { scroll: true });
    await tap("Displayed building: Building A");
    await tap("Displayed floor 1");
    await locate("Building A · Floor 1", { scroll: true });
    screenshot(`native-pb033-${name}`);
    passed(`${name}: manual origin, shared route and destination floor view`);
    assert.equal(
      (await api(`/api/v2/visits/${visit.id}`, patient.token)).examStatus,
      "Waiting",
    );
  }
  await tap((n) =>
    (n["content-desc"] || n.text || "").startsWith(
      localizeText("Tra cứu khoa/phòng", "en") + " (",
    ),
  );
  const unknown = mapDepartments.find((d) => d.id === "E-premium");
  await tap(
    departmentLabel(unknown, "en") + " · " + departmentLocation(unknown, "en"),
  );
  await locate((n) => /Needs confirmation/.test(n.text || ""), {
    scroll: true,
  });
  const button = await locate(
    (n) => n["content-desc"] === "Find route" && n.clickable === "true",
    { scroll: true },
  );
  assert.equal(button.enabled, "false");
  screenshot("native-pb033-unconfirmed");
  passed(
    "Unconfirmed E department has no invented floor or route; Visit stays Waiting",
  );
  writeFileSync(
    report,
    JSON.stringify({ passed: true, apkSha256, checks }, null, 2),
  );
} catch (error) {
  writeFileSync(
    report,
    JSON.stringify({ passed: false, checks, error: error.message }, null, 2),
  );
  throw error;
}
