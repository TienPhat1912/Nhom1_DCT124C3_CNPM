import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  VisitV2,
  RegistrationRequestV2,
  ConfirmReceptionResultV2,
  Session,
  ClinicalCatalogPageV2,
} from "@hospital/shared";

const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
async function api<T>(
  path: string,
  token?: string | null,
  body?: unknown,
): Promise<T> {
  const response = await fetch(base + path, {
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
  expect(response.ok, `${path}: ${response.status}`).toBeTruthy();
  return response.json();
}

test("cashier settles both outcomes and patient observes completed journey", async ({
  page,
  context,
  browser,
  baseURL,
}, info) => {
  const login = (name: string) =>
    api<Session>("/api/auth/login", null, {
      email: `${name}@demo.local`,
      password,
    });
  const doctor = await login("doctor"),
    reception = await login("reception"),
    cashier = await login("cashier");
  await context.addCookies([
    {
      name: "hospital_session",
      value: cashier.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  for (const outcome of ["Final", "NoPaymentRequired"] as const) {
    const patient = await api<Session>("/api/auth/register", null, {
      email: `${randomUUID()}@example.test`,
      password,
      name: `PB015 ${outcome}`,
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
        verificationNote: "Synthetic PB015 verification",
      },
    );
    const accepted = await api<VisitV2>(
      `/api/v2/visits/${confirmation.visit.id}/consultations/accept`,
      doctor.token,
      { version: confirmation.visit.version },
    );
    const diagnosis = (
      await api<ClinicalCatalogPageV2>(
        "/api/v2/clinical-catalog/diagnoses",
        doctor.token,
      )
    ).items[0];
    const template = (
      await api<ClinicalCatalogPageV2>(
        "/api/v2/clinical-catalog/templates",
        doctor.token,
      )
    ).items[0];
    const preview = await api<{ previewId: string }>(
      `/api/v2/visits/${accepted.id}/examination/preview`,
      doctor.token,
      {
        version: accepted.version,
        symptomSelections: [],
        signSelections: [],
        diagnosisSelections: [{ id: diagnosis.id, version: diagnosis.version }],
        template: { id: template.id, version: template.version },
      },
    );
    await api(
      `/api/v2/visits/${accepted.id}/examination/complete`,
      doctor.token,
      { version: accepted.version, previewId: preview.previewId },
    );

    const patientContext = await browser.newContext({
      ...info.project.use,
      baseURL,
    });
    try {
      await patientContext.addCookies([
        {
          name: "hospital_session",
          value: patient.token!,
          url: baseURL!,
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);
      await patientContext.addInitScript(() =>
        localStorage.setItem("hospital.language", "en"),
      );
      const patientPage = await patientContext.newPage();
      await patientPage.goto("/");
      await patientPage
        .locator("main")
        .getByRole("button", { name: "My journey", exact: true })
        .click();
      await expect(patientPage.locator(".visit-meta")).toContainText("Active");
      await page.goto("/");
      const workspace = page.getByTestId("cashier-settlements");
      await workspace
        .getByRole("button", { name: new RegExp(`PB015 ${outcome}`) })
        .click();
      const form = page.getByTestId("settlement-form");
      await expect(form.getByRole("option")).toHaveCount(2);
      const submit = form.getByRole("button", {
        name: "Record outcome",
        exact: true,
      });
      await expect(submit).toBeDisabled();
      await form.getByRole("combobox").selectOption(outcome);
      await form.getByRole("checkbox").check();
      if (outcome === "Final") {
        // Exercise the UI conflict path without racing the polling timer.
        await page.route(
          /\/api\/v2\/visits\/[^/]+\/settlement(?:\?.*)?$/,
          (route) =>
            route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                title: "conflict",
                status: 409,
                detail: "Review the updated Visit.",
              }),
            }),
          { times: 1 },
        );
        await submit.click();
        await expect(form.getByRole("checkbox")).not.toBeChecked();
        await expect(submit).toBeDisabled();
        await form.getByRole("checkbox").check();
      }
      await submit.click();
      await expect(form).toContainText(
        "Settlement recorded. Visit and journey completed.",
      );
      await expect(form).toContainText("Closed");
      await expect(patientPage.locator(".completion-card")).toBeVisible({
        timeout: 15000,
      });
      await expect(patientPage.locator(".visit-meta")).toContainText("Closed");
      await expect(
        patientPage.getByRole("button", { name: /complete guidance/i }),
      ).toHaveCount(0);
      if (process.env.PB015_CAPTURE === "1") {
        await page.screenshot({
          path: `artifacts/${info.project.name}-pb015-${outcome}.png`,
          animations: "disabled",
        });
        await patientPage.screenshot({
          path: `artifacts/${info.project.name}-pb015-patient.png`,
          animations: "disabled",
        });
      }
    } finally {
      await patientContext.close();
    }
  }
});
