import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
for (const key of ["API_URL", "DEMO_PASSWORD", "ACCEPTANCE_DB"])
  assert.ok(process.env[key], `Set ${key} for isolated native acceptance.`);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(process.env.API_URL).hostname),
);
assert.match(process.env.ACCEPTANCE_DB, /^HospitalAcceptance_\d+$/);
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
const report = "artifacts/android/android-journey.json";
const font = adb("shell", "settings", "get", "system", "font_scale").trim();
const port = new URL(process.env.API_URL).port || "80";
const connect = () => adb("reverse", "tcp:5280", `tcp:${port}`);
const has = (label) =>
  nodes().some((n) => (n["content-desc"] || n.text) === label);
async function request(token) {
  const r = await fetch(process.env.API_URL + "/api/v2/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      contact: "synthetic-contact",
      description: "PB022 synthetic",
      sourceLanguage: "en",
      preferredDepartmentId: null,
    }),
  });
  assert.equal(r.status, 201);
  return r.json();
}
try {
  assert.match(
    adb("emu", "avd", "name"),
    /cnpm_api36/,
    "Use the dedicated acceptance emulator.",
  );
  const apkSha256 = verifyInstalledApk();
  connect();
  assert.equal((await api("/api/config")).prdV2Enabled, true);
  const staff = {};
  for (const role of ["reception", "doctor", "service", "cashier"])
    staff[role] = await api("/api/auth/login", null, {
      email: `${role}@demo.local`,
      password,
    });
  for (const rounds of [0, 2]) {
    await restart("hguide://entry?language=en");
    await locate(
      (n) =>
        ["Overview", "Continue as guest"].includes(n["content-desc"] || n.text),
      { scroll: true },
    );
    if (has("Overview")) {
      await tap("Overview");
      await tap("Sign out");
    }
    const email = `pb022-${randomUUID()}@example.test`;
    const patient = await api("/api/auth/register", null, {
      email,
      password,
      name: `PB022 Native ${rounds}`,
      contact: "synthetic-contact",
      language: "en",
    });
    await fill("Email", email);
    await fill("Password", password);
    await tap(
      (n) =>
        n["content-desc"] === "Sign in" &&
        n.clickable === "true" &&
        n.class !== "android.widget.RadioButton",
    );
    const req = await request(patient.token);
    const clinic = (
      await api("/api/v2/reception/clinics", staff.reception.token)
    ).find((c) => c.room === "A101");
    const confirmed = await api(
      `/api/v2/requests/${req.id}/confirm`,
      staff.reception.token,
      {
        version: req.version,
        clinicLocationId: clinic.clinicLocationId,
        clinicAssignmentVersion: clinic.version,
        attendeeVerified: true,
        verificationNote: "PB022 isolated native acceptance",
      },
    );
    let current = confirmed.visit;
    const read = () => api(`/api/v2/visits/${current.id}`, patient.token);
    const command = async (suffix, body, role = "doctor") => {
      current = await api(
        `/api/v2/visits/${current.id}/${suffix}`,
        staff[role].token,
        { version: current.version, ...body },
      );
    };
    const ticket = JSON.stringify(current.ticket);
    await restart(`hguide://entry?visit=${current.id}&language=en`);
    await locate("Examination status", { scroll: true });
    await locate("Wait for consultation at the clinic on your ticket.", {
      scroll: true,
    });
    await restart();
    await locate("Your visit journey", { scroll: true });
    passed(
      `V2 ${rounds} rounds: authorized deep link and restart retain original Visit`,
    );
    for (let round = 0; round <= rounds; round++) {
      await command("consultations/accept", {});
      await locate("In consultation", { scroll: true });
      if (round === rounds) break;
      const service = (
        await api("/api/v2/order-services", staff.doctor.token)
      ).find((s) => s.code === "LAB");
      const preview = await api(
        `/api/v2/visits/${current.id}/orders/preview`,
        staff.doctor.token,
        {
          version: current.version,
          serviceId: service.id,
          note: "PB022 native service round",
        },
      );
      await command("orders", {
        serviceId: service.id,
        note: preview.note,
        previewId: preview.previewId,
      });
      await locate("Undergoing service", { scroll: true });
      const order = current.orders.find((o) => o.status !== "Completed");
      assert.ok(order);
      if (round === 0) {
        screenshot("native-pb022-service");
        adb("reverse", "--remove", "tcp:5280");
        await restart();
        await locate(
          (n) => /Showing previously loaded information/.test(n.text || ""),
          { scroll: true, timeout: 90000 },
        );
        await locate("Undergoing service", { scroll: true });
        screenshot("native-pb022-offline-restart");
        connect();
        await tap("Retry");
        passed(
          "Offline process restart retains scoped snapshot with stale label and retry reconnects",
        );
      }
      await command(
        `orders/${order.id}/complete`,
        { orderVersion: order.version },
        "service",
      );
      assert.equal(current.examStatus, "Waiting");
      assert.equal(JSON.stringify(current.ticket), ticket);
      assert.equal(current.currentStep.destination.room, "A101");
      await locate("Return consultation", { scroll: true });
      await locate("Wait for consultation at the clinic on your ticket.", {
        scroll: true,
      });
    }
    const pick = (x) => ({ id: x.id, version: x.version });
    const load = async (kind) =>
      (await api(`/api/v2/clinical-catalog/${kind}`, staff.doctor.token))
        .items[0];
    const [diagnosis, template] = await Promise.all([
      load("diagnoses"),
      load("templates"),
    ]);
    const preview = await api(
      `/api/v2/visits/${current.id}/examination/preview`,
      staff.doctor.token,
      {
        version: current.version,
        symptomSelections: [],
        signSelections: [],
        diagnosisSelections: [pick(diagnosis)],
        template: pick(template),
      },
    );
    await command("examination/complete", { previewId: preview.previewId });
    assert.equal(current.examStatus, "Completed");
    assert.equal(current.status, "Active");
    await locate("Final settlement", { scroll: true });
    await command(
      "settlement",
      {
        workRevision: current.workRevision,
        outcome: rounds ? "Final" : "NoPaymentRequired",
      },
      "cashier",
    );
    await locate(
      (n) =>
        (n.text || n["content-desc"] || "").includes(
          "Your guidance journey is complete",
        ),
      { scroll: true },
    );
    assert.equal((await read()).status, "Closed");
    assert.ok(
      !nodes().some((n) =>
        /Activate|Complete guidance|Link account/.test(
          n["content-desc"] || n.text || "",
        ),
      ),
    );
    adb("shell", "settings", "put", "system", "font_scale", "1.5");
    await restart();
    await locate(
      (n) =>
        (n.text || n["content-desc"] || "").includes(
          "Your guidance journey is complete",
        ),
      { scroll: true },
    );
    const result = await locate("Results & care", { scroll: true });
    const bounds = result.bounds.match(/\d+/g).map(Number);
    assert.ok(bounds[2] > bounds[0] && bounds[3] > bounds[1]);
    screenshot(`native-pb022-complete-${rounds}-large-font`);
    adb("shell", "settings", "put", "system", "font_scale", font);
    passed(
      `V2 ${rounds} service rounds: original ticket/clinic, automatic settlement closure and large text`,
    );
    await tap("Overview");
    await tap("Sign out");
    screenshot(`native-pb022-signed-out-${rounds}`);
  }
  writeFileSync(
    report,
    JSON.stringify({ status: "pass", apkSha256, checks }, null, 2) + "\n",
  );
} catch (error) {
  writeFileSync(
    report,
    JSON.stringify({ status: "fail", checks, error: error.message }, null, 2) +
      "\n",
  );
  throw error;
} finally {
  connect();
  if (font === "null")
    adb("shell", "settings", "delete", "system", "font_scale");
  else adb("shell", "settings", "put", "system", "font_scale", font);
}
