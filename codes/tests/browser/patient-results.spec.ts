import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  ClinicalCatalogPageV2,
  CompleteExaminationResultV2,
  ConfirmReceptionResultV2,
  Content,
  RegistrationRequestV2,
  Session,
  VisitV2,
} from "@hospital/shared";
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
  expect(r.ok, `${path}: ${r.status}`).toBeTruthy();
  return r.json();
}
const login = (name: string) =>
  api<Session>("/api/auth/login", null, {
    email: `${name}@demo.local`,
    password,
  });
const account = () =>
  api<Session>("/api/auth/register", null, {
    email: `${randomUUID()}@example.test`,
    password,
    name: "PB016 browser",
    contact: "synthetic-contact",
    language: "en",
  });
test.beforeEach(async ({ page }) => {
  // Exercise slow session bootstrap: the responsive menu does not exist yet
  // when the document initially loads on the CI runner.
  await page.route("**/api/auth/session", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
});

async function navigate(page: Page, name: string, isMobile: boolean) {
  const sidebar = page.locator(".sidebar");
  const target = sidebar
    .getByRole("navigation")
    .getByRole("button", { name, exact: true });
  // Wait for the authenticated workspace before deciding how to navigate.
  await expect(target).toBeAttached();
  if (isMobile) {
    const toggle = page.locator(".mobile-menu");
    await expect(toggle).toBeVisible();
    if (!(await sidebar.getAttribute("class"))?.split(/\s+/).includes("open"))
      await toggle.click();
    await expect(sidebar).toHaveClass(/\bopen\b/);
  }
  await expect(target).toBeInViewport();
  await target.click();
  await expect(target).toHaveClass(/\bactive\b/);
  if (isMobile) await expect(sidebar).not.toHaveClass(/\bopen\b/);
}

async function prepare() {
  const patient = await account(),
    reception = await login("reception"),
    doctor = await login("doctor");
  const req = await api<RegistrationRequestV2>(
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
      {
        clinicLocationId: string;
        departmentId: string;
        version: number;
        room: string;
      }[]
    >("/api/v2/reception/clinics", reception.token),
    clinic = clinics.find((c) => c.room === "A101")!;
  const { visit } = await api<ConfirmReceptionResultV2>(
    `/api/v2/requests/${req.id}/confirm`,
    reception.token,
    {
      version: req.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "PB016 synthetic verification",
    },
  );
  const accepted = await api<VisitV2>(
    `/api/v2/visits/${visit.id}/consultations/accept`,
    doctor.token,
    { version: visit.version },
  );
  const load = async (kind: string) =>
    (
      await api<ClinicalCatalogPageV2>(
        `/api/v2/clinical-catalog/${kind}`,
        doctor.token,
      )
    ).items[0];
  const [symptom, sign, diagnosis, template] = await Promise.all(
    ["symptoms", "signs", "diagnoses", "templates"].map(load),
  );
  const pick = (x: { id: string; version: number }) => ({
    id: x.id,
    version: x.version,
  });
  const preview = await api<{ previewId: string }>(
    `/api/v2/visits/${visit.id}/examination/preview`,
    doctor.token,
    {
      version: accepted.version,
      symptomSelections: [pick(symptom)],
      signSelections: [pick(sign)],
      diagnosisSelections: [pick(diagnosis)],
      template: pick(template),
    },
  );
  await api(`/api/visits/${visit.id}/follow-ups`, doctor.token, {
    departmentId: visit.departmentId,
    recommendedAt: new Date(Date.now() + 86400000).toISOString(),
    text: "PB016 original recommendation",
    language: "vi",
    reviewed: true,
  });
  return { patient, doctor, visit: accepted, preview, diagnosis };
}
test("confirmed structured results are visible before settlement; language and recommendation original remain consistent", async ({
  page,
  context,
  baseURL,
  isMobile,
}, info) => {
  const { patient, doctor, visit, preview, diagnosis } = await prepare();
  await context.addCookies([
    {
      name: "hospital_session",
      value: patient.token!,
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
    .locator("main")
    .getByRole("button", { name: "My journey", exact: true })
    .click();
  await navigate(page, "Results & care", isMobile);
  await expect(page.getByTestId("confirmed-results")).toHaveCount(0);
  await expect(
    page.getByText("PB016 original recommendation", { exact: true }),
  ).toHaveCount(0);
  const done = await api<CompleteExaminationResultV2>(
    `/api/v2/visits/${visit.id}/examination/complete`,
    doctor.token,
    { version: visit.version, previewId: preview.previewId },
  );
  expect(done.visit.status).toBe("Active");
  const record = page.getByTestId("confirmed-results");
  await expect(record).toBeVisible({ timeout: 15000 });
  await expect(record).toContainText(diagnosis.code);
  await expect(record).toContainText(diagnosis.nameVi);
  await expect(record).toContainText(done.record.author.name);
  await expect(
    page.getByText("PB016 original recommendation", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /book/i })).toHaveCount(0);
  for (const locale of ["vi", "zh", "en"]) {
    await page.getByRole("combobox").first().selectOption(locale);
    await expect(record).toContainText(diagnosis.code);
    await expect(record).toContainText(diagnosis.nameVi);
  }
  const source = page.locator("details.panel");
  await source.locator("summary").click();
  await expect(source).toContainText(done.record.content.diagnosis);
  if (process.env.PB016_CAPTURE === "1")
    await page.screenshot({
      path: `artifacts/${info.project.name}-pb016-results.png`,
      fullPage: true,
      animations: "disabled",
    });
  // A failed grant/ownership refresh must hide a previously displayed snapshot.
  await page.route(`**/api/visits/${visit.id}/content*`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        title: "forbidden",
        status: 403,
        detail: "Access expired",
      }),
    }),
  );
  await expect(record).toHaveCount(0, { timeout: 15000 });
});

test("published legacy results and history remain available without booking handoff", async ({
  page,
  context,
  baseURL,
  isMobile,
}) => {
  const patient = await account(),
    reception = await login("reception"),
    doctor = await login("doctor");
  const config = await api<{
    locations: { id: string; departmentId: string; room: string }[];
  }>("/api/config");
  const location = config.locations.find((x) => x.room === "A101")!;
  const req = await api<{ id: string }>("/api/requests", patient.token, {
    name: "PB016 legacy",
    contact: "synthetic-contact",
    description: "History",
    requests: "",
    departmentId: location.departmentId,
  });
  const detail = await api<{ version: number }>(
    `/api/requests/${req.id}`,
    reception.token,
  );
  const v = await api<{ visitId: string }>(
    `/api/requests/${req.id}/confirm`,
    reception.token,
    {
      version: detail.version,
      departmentId: location.departmentId,
      locationId: location.id,
      attendeeVerified: true,
      verificationNote: "PB016 historical verification",
    },
  );
  const draft = await api<{ id: string }>(
    `/api/visits/${v.visitId}/drafts`,
    doctor.token,
    {
      diagnosis: "PB016 legacy diagnosis",
      explanation: "",
      instructions: "PB016 legacy care",
      language: "vi",
      documentReference: "PB016 history reference",
    },
  );
  const drafts = await api<{ id: string; version: number }[]>(
    `/api/visits/${v.visitId}/drafts`,
    doctor.token,
  );
  await api(
    `/api/visits/${v.visitId}/drafts/${draft.id}/publish`,
    doctor.token,
    { version: drafts.find((x) => x.id === draft.id)!.version, reviewed: true },
  );
  await context.addCookies([
    {
      name: "hospital_session",
      value: patient.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  await navigate(page, "Visit history", isMobile);
  await page.locator(".record-row").first().click();
  await expect(
    page
      .locator("main")
      .getByRole("heading", { name: "Results & care", exact: true }),
  ).toBeVisible();
  await navigate(page, "Results & care", isMobile);
  await expect(
    page.getByText("PB016 legacy diagnosis", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("confirmed-results")).toHaveCount(0);
  const data = await api<Content>(
    `/api/visits/${v.visitId}/content`,
    patient.token,
  );
  expect(data.summary?.documentReference).toBe("PB016 history reference");
  await expect(page.getByRole("link", { name: /book/i })).toHaveCount(0);
});
