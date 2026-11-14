import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  VisitV2,
  RegistrationRequestV2,
  ConfirmReceptionResultV2,
  Session,
} from "@hospital/shared";
const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
async function api<T>(
  path: string,
  token?: string | null,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(base + path, {
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
  expect(response.ok, `${path}: ${response.status}`).toBeTruthy();
  return response.json();
}
test("doctor previews, edits, cancels and confirms examination; patient sees only confirmed result", async ({
  page,
  context,
  baseURL,
}, info) => {
  const login = (name: string) =>
    api<Session>("/api/auth/login", null, {
      email: `${name}@demo.local`,
      password,
    });
  const doctor = await login("doctor"),
    reception = await login("reception");
  const patient = await api<Session>("/api/auth/register", null, {
    email: `${randomUUID()}@example.test`,
    password,
    name: "PB014 browser synthetic",
    contact: "synthetic-contact",
    language: "en",
  });
  const request = await api<RegistrationRequestV2>(
    "/api/v2/requests",
    patient.token,
    {
      contact: "synthetic-contact",
      description: "Original",
      sourceLanguage: "en",
      preferredDepartmentId: null,
    },
  );
  const clinics = await api<
    { clinicLocationId: string; version: number; room: string }[]
  >("/api/v2/reception/clinics", reception.token);
  const clinic = clinics.find((c) => c.room === "A101")!;
  const confirmation = await api<ConfirmReceptionResultV2>(
    `/api/v2/requests/${request.id}/confirm`,
    reception.token,
    {
      version: request.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "Synthetic PB014 verification",
    },
  );
  await api<VisitV2>(
    `/api/v2/visits/${confirmation.visit.id}/consultations/accept`,
    doctor.token,
    { version: confirmation.visit.version },
  );
  await context.addCookies([
    {
      name: "hospital_session",
      value: doctor.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  const form = page.getByTestId("examination-form");
  const choose = async () => {
    await form
      .locator("section.sub-panel")
      .filter({
        has: page.getByRole("heading", { name: "Diagnoses", exact: true }),
      })
      .locator('input[type="checkbox"]')
      .first()
      .check();
    await form
      .locator("section.sub-panel")
      .filter({
        has: page.getByRole("heading", {
          name: "Vietnamese template",
          exact: true,
        }),
      })
      .locator('input[type="radio"]')
      .first()
      .check();
  };
  await choose();
  await form
    .getByRole("button", { name: "Preview examination", exact: true })
    .click();
  await expect(page.getByTestId("examination-preview")).toBeVisible();
  expect(
    await api(
      `/api/v2/visits/${confirmation.visit.id}/clinical-record`,
      patient.token,
    ),
  ).toBeNull();
  await form
    .getByRole("button", { name: "Edit selections", exact: true })
    .click();
  await choose();
  await form
    .getByRole("button", { name: "Preview examination", exact: true })
    .click();
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await api(
      `/api/v2/visits/${confirmation.visit.id}/clinical-record`,
      patient.token,
    ),
  ).toBeNull();
  await form
    .getByRole("button", { name: "Preview examination", exact: true })
    .click();
  await form
    .getByRole("checkbox", {
      name: "I reviewed the Vietnamese content",
      exact: true,
    })
    .check();
  await form
    .getByRole("button", { name: "Confirm examination", exact: true })
    .click();
  await expect(page.getByTestId("current-consultation")).toHaveCount(0);
  await expect(page.getByTestId("completed-examination")).toBeVisible();
  if (process.env.PB014_CAPTURE === "1")
    await page.screenshot({
      path: `artifacts/${info.project.name}-pb014.png`,
      animations: "disabled",
    });
  const v = await api<VisitV2>(
    `/api/v2/visits/${confirmation.visit.id}`,
    doctor.token,
  );
  expect(v.examStatus).toBe("Completed");
  expect(v.currentStep?.kind).toBe("Settlement");
  expect(
    await api(`/api/v2/visits/${v.id}/clinical-record`, patient.token),
  ).toBeTruthy();
});
