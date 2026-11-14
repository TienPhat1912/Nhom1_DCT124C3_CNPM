import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  Session,
  RegistrationRequestV2,
  ConfirmReceptionResultV2,
  VisitV2,
  OrderPreviewV2,
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
test("preview/cancel/stale review/confirm makes an immutable service order and releases the next patient", async ({
  page,
  context,
  baseURL,
}, info) => {
  const reception = await api<Session>("/api/auth/login", null, {
    email: "reception@demo.local",
    password,
  });
  const doctor = await api<Session>("/api/auth/login", null, {
    email: "doctor@demo.local",
    password,
  });
  const clinic = (
    await api<{ clinicLocationId: string; version: number; room: string }[]>(
      "/api/v2/reception/clinics",
      reception.token,
    )
  ).find((c) => c.room === "A101")!;
  const service = (
    await api<{ id: string; code: string }[]>(
      "/api/v2/order-services",
      doctor.token,
    )
  ).find((s) => s.code === "LAB")!;
  const visits: (VisitV2 & { name: string })[] = [];
  for (let i = 0; i < 2; i++) {
    const name = `PB011 browser ${i} ${randomUUID().slice(0, 6)}`;
    const patient = await api<Session>("/api/auth/register", null, {
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
      reception.token,
      {
        version: request.version,
        clinicLocationId: clinic.clinicLocationId,
        clinicAssignmentVersion: clinic.version,
        attendeeVerified: true,
        verificationNote: "Synthetic PB011 web verification",
      },
    );
    visits.push({ ...result.visit, name });
  }
  const current = await api<VisitV2>(
    `/api/v2/visits/${visits[0].id}/consultations/accept`,
    doctor.token,
    { version: visits[0].version },
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
  await page.getByLabel("Service", { exact: true }).selectOption(service.id);
  await page.getByLabel("Note", { exact: true }).fill("Original instruction");
  const preview = page.getByRole("button", {
    name: "Preview order",
    exact: true,
  });
  const confirm = page.getByRole("button", {
    name: "Confirm service order",
    exact: true,
  });
  await preview.click();
  await expect(page.getByTestId("order-preview")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await api<VisitV2>(`/api/v2/visits/${current.id}`, doctor.token)).orders,
  ).toHaveLength(0);
  await preview.click();
  await expect(confirm).toBeVisible();
  fixtureSql(
    `UPDATE HospitalService SET Version=Version+1 WHERE Id='${service.id}'`,
  );
  await confirm.click();
  await expect(preview).toBeVisible();
  await expect(page.getByTestId("order-preview")).toHaveCount(0);
  await preview.click();
  await expect(confirm).toBeVisible();
  await confirm.click();
  const receipt = page.getByTestId("ordered-service");
  await expect(receipt).toContainText("Undergoing service", { timeout: 15000 });
  await expect(receipt).toContainText("Original instruction");
  await expect(page.getByText("No data yet.", { exact: true })).toHaveCount(0);
  const nextRow = page
    .locator("article.record-row")
    .filter({ hasText: visits[1].name });
  await expect(
    nextRow.getByRole("button", { name: "Accept consultation", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(visits[0].name) }).click();
  await expect(receipt).toContainText("Original instruction");
  expect(
    (await api<VisitV2>(`/api/v2/visits/${current.id}`, doctor.token)).orders,
  ).toHaveLength(1);
  if (process.env.PB011_CAPTURE === "1")
    await receipt.scrollIntoViewIfNeeded();
  if (process.env.PB011_CAPTURE === "1")
    await page.screenshot({
      path: `artifacts/${info.project.name}-pb011.png`,
      timeout: 10000,
      animations: "disabled",
    });
  await nextRow
    .getByRole("button", { name: "Accept consultation", exact: true })
    .click();
  await expect(page.getByTestId("current-consultation")).toContainText(
    visits[1].name,
  );
  const next = await api<VisitV2>(
    `/api/v2/visits/${visits[1].id}`,
    doctor.token,
  );
  const p = await api<OrderPreviewV2>(
    `/api/v2/visits/${next.id}/orders/preview`,
    doctor.token,
    { version: next.version, serviceId: service.id, note: "Fixture cleanup" },
  );
  await api<VisitV2>(`/api/v2/visits/${next.id}/orders`, doctor.token, {
    version: next.version,
    serviceId: service.id,
    note: p.note,
    previewId: p.previewId,
  });
});
