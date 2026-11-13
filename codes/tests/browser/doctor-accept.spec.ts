import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  Session,
  RegistrationRequestV2,
  ConfirmReceptionResultV2,
  VisitV2,
} from "@hospital/shared";
import { fixtureSql } from "../api/sql-fixture.mjs";
const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
async function api<T>(
  path: string,
  token?: string | null,
  body?: unknown,
): Promise<T> {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      "Idempotency-Key": randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  expect(r.ok).toBeTruthy();
  return r.json();
}
test("doctor selects a later waiting patient, sees current consultation and cannot accept another", async ({
  page,
  context,
  baseURL,
}, info) => {
  const staff = await api<Session>("/api/auth/login", undefined, {
    email: "reception@demo.local",
    password,
  });
  const doctor = await api<Session>("/api/auth/login", undefined, {
    email: "doctor@demo.local",
    password,
  });
  const clinics = await api<
    { clinicLocationId: string; room: string; version: number }[]
  >("/api/v2/reception/clinics", staff.token);
  const clinic = clinics.find((c) => c.room === "A101")!;
  const visits: (VisitV2 & { name: string })[] = [];
  for (let i = 0; i < 2; i++) {
    const name = `PB010 browser ${i} ${randomUUID().slice(0, 6)}`;
    const patient = await api<Session>("/api/auth/register", undefined, {
      email: `${randomUUID()}@example.test`,
      password,
      name,
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
    const result = await api<ConfirmReceptionResultV2>(
      `/api/v2/requests/${request.id}/confirm`,
      staff.token,
      {
        version: request.version,
        clinicLocationId: clinic.clinicLocationId,
        clinicAssignmentVersion: clinic.version,
        attendeeVerified: true,
        verificationNote: "Synthetic browser verification",
      },
    );
    visits.push({ ...result.visit, name });
  }
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
  await expect(
    page.getByRole("heading", {
      name: "Consultation waiting list",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".visit-picker")).toHaveCount(0);
  const newer = page
    .locator("article.record-row")
    .filter({ hasText: visits[1].name });
  await newer
    .getByRole("button", { name: "Accept consultation", exact: true })
    .click();
  const current = page.getByTestId("current-consultation");
  await expect(current).toContainText(visits[1].name);
  await expect(current.getByText("In consultation", { exact: true })).toBeVisible();
  await expect(
    page
      .locator("article.record-row")
      .filter({ hasText: visits[0].name })
      .getByRole("button", { name: "Accept consultation" }),
  ).toBeDisabled();
  await page.reload();
  await expect(current).toContainText(visits[1].name);
  if (process.env.PB010_CAPTURE === "1") await page.screenshot({ path: `artifacts/${info.project.name}-pb010.png`, timeout: 10000, animations: "disabled" });
  // Release the synthetic room for the following viewport; no clinical completion API is implemented here.
  fixtureSql(
    `UPDATE Visits SET ExamStatus='Completed' WHERE Id='${visits[1].id}'`,
  );
});
