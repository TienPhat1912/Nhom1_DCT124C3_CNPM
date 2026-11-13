import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  AdminConfig,
  AdminClinicAssignment,
  RegistrationRequestV2,
  Session,
} from "@hospital/shared";

async function api<T>(
  path: string,
  token?: string | null,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(process.env.API_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      "Idempotency-Key": randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  expect(response.ok, await response.clone().text()).toBeTruthy();
  return response.json() as Promise<T>;
}

test("Admin provisions room, reviews and saves duty, handles stale edits and Active Visit lock", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  const admin = await api<Session>("/api/auth/login", null, {
    email: "admin@demo.local",
    password: process.env.DEMO_PASSWORD,
  });
  const config = await api<AdminConfig>(
    "/api/admin/configuration",
    admin.token,
  );
  const departmentId = config.departments.find((d) => d.code === "CONSULT")!.id;
  const suffix = randomUUID().slice(0, 8);
  const roomName = `Phòng browser ${suffix}`;
  const room = await api<{ id: string }>("/api/admin/locations", admin.token, {
    version: 0,
    nameVi: roomName,
    departmentId,
    building: "A",
    floor: "1",
    room: suffix,
    active: true,
  });
  const doctors = [];
  for (const name of [`Doctor A ${suffix}`, `Doctor B ${suffix}`]) {
    doctors.push({
      name,
      ...(await api<{ id: string }>("/api/admin/staff", admin.token, {
        version: 0,
        email: `${randomUUID()}@example.test`,
        name,
        role: "Doctor",
        departmentIds: [departmentId],
        active: true,
        password: process.env.DEMO_PASSWORD,
      })),
    });
  }
  await context.addCookies([
    {
      name: "hospital_session",
      value: admin.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Clinic assignments", exact: true })
    .click();
  await page.getByLabel("Find clinic").fill(roomName);
  await page.getByRole("button", { name: new RegExp(roomName) }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(roomName) }),
  ).toBeVisible();
  for (const doctor of doctors)
    await page.getByLabel(doctor.name, { exact: true }).check();
  await page
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await expect(
    page.getByText(`${doctors[0].name} · ${doctors[1].name}`, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (
      await api<AdminClinicAssignment>(
        `/api/v2/admin/clinics/${room.id}/assignment`,
        admin.token,
      )
    ).doctorIds,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm and save assignment", exact: true })
    .click();
  await expect(
    page
      .getByLabel("Active doctor", { exact: true })
      .getByRole("option", { name: doctors[0].name }),
  ).toBeAttached();
  await page
    .getByLabel("Active doctor", { exact: true })
    .selectOption(doctors[0].id);
  await page
    .getByRole("button", { name: "Review active doctor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm and save assignment", exact: true })
    .click();
  await expect(page.locator(".detail-grid dd").first()).toHaveText(
    doctors[0].name,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Clinic assignments", exact: true })
    .click();
  await page.getByLabel("Find clinic").fill(roomName);
  await page.getByRole("button", { name: new RegExp(roomName) }).click();
  await expect(page.getByLabel("Active doctor", { exact: true })).toHaveValue(
    doctors[0].id,
  );
  await page
    .getByLabel("Active doctor", { exact: true })
    .selectOption(doctors[1].id);
  await page
    .getByRole("button", { name: "Review active doctor", exact: true })
    .click();
  const before = await api<AdminClinicAssignment>(
    `/api/v2/admin/clinics/${room.id}/assignment`,
    admin.token,
  );
  await api(
    `/api/v2/admin/clinics/${room.id}/active-doctor`,
    admin.token,
    { version: before.version, doctorId: null },
    "PUT",
  );
  await page
    .getByRole("button", { name: "Confirm and save assignment", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("Active doctor", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByLabel("Active doctor", { exact: true })
    .selectOption(doctors[1].id);
  await page
    .getByRole("button", { name: "Review active doctor", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm and save assignment", exact: true })
    .click();
  await expect(page.locator(".detail-grid dd").first()).toHaveText(
    doctors[1].name,
  );
  await page.screenshot({
    path: testInfo.outputPath("assignment-saved.png"),
    fullPage: true,
  });

  const patient = await api<Session>("/api/auth/register", null, {
    email: `${randomUUID()}@example.test`,
    name: `Patient ${suffix}`,
    contact: "test-contact",
    language: "en",
    password: process.env.DEMO_PASSWORD,
  });
  const request = await api<RegistrationRequestV2>(
    "/api/v2/requests",
    patient.token,
    {
      contact: "test-contact",
      preferredDepartmentId: null,
      description: "Browser lock test",
      sourceLanguage: "en",
    },
  );
  const reception = await api<Session>("/api/auth/login", null, {
    email: "reception@demo.local",
    password: process.env.DEMO_PASSWORD,
  });
  const current = await api<AdminClinicAssignment>(
    `/api/v2/admin/clinics/${room.id}/assignment`,
    admin.token,
  );
  // The Visit opens after the Admin has reviewed a change. The server guard must still reject it.
  await page
    .getByLabel("Active doctor", { exact: true })
    .selectOption(doctors[0].id);
  await page
    .getByRole("button", { name: "Review active doctor", exact: true })
    .click();
  await api(`/api/v2/requests/${request.id}/confirm`, reception.token, {
    version: request.version,
    clinicLocationId: room.id,
    clinicAssignmentVersion: current.version,
    attendeeVerified: true,
    verificationNote: "Verified browser attendee",
  });
  await page
    .getByRole("button", { name: "Confirm and save assignment", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "all related Visits have closed",
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByLabel("Active doctor", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel(doctors[0].name, { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Review assignment", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".detail-grid dd").first()).toHaveText(
    doctors[1].name,
  );
  await expect(page.locator(".detail-grid dd").last()).toHaveText("1");
  await page.screenshot({
    path: testInfo.outputPath("assignment-locked.png"),
    fullPage: true,
  });
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
});
