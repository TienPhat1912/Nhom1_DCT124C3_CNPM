import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  Session,
  VisitV2,
  RegistrationRequestV2,
  ConfirmReceptionResultV2,
  OrderPreviewV2,
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
test("Service completes two rounds; Doctor sees A waiting while B remains in consultation", async ({
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
  const reception = await login("reception"),
    doctor = await login("doctor"),
    service = await login("service");
  const clinic = (
    await api<{ clinicLocationId: string; version: number; room: string }[]>(
      "/api/v2/reception/clinics",
      reception.token,
    )
  ).find((c) => c.room === "A101")!;
  const catalog = (
    await api<{ id: string; code: string }[]>(
      "/api/v2/order-services",
      doctor.token,
    )
  ).find((s) => s.code === "LAB")!;
  async function register() {
    const name = `PB012 browser ${randomUUID().slice(0, 8)}`;
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
        verificationNote: "Synthetic PB012 browser verification",
      },
    );
    return { ...result.visit, name };
  }
  async function send(v: VisitV2) {
    const p = await api<OrderPreviewV2>(
      `/api/v2/visits/${v.id}/orders/preview`,
      doctor.token,
      {
        version: v.version,
        serviceId: catalog.id,
        note: "PB012 browser instruction",
      },
    );
    return api<VisitV2>(`/api/v2/visits/${v.id}/orders`, doctor.token, {
      version: v.version,
      serviceId: catalog.id,
      note: p.note,
      previewId: p.previewId,
    });
  }
  const a = await register(),
    b = await register();
  const first = await send(
    await api<VisitV2>(
      `/api/v2/visits/${a.id}/consultations/accept`,
      doctor.token,
      { version: a.version },
    ),
  );
  const currentB = await api<VisitV2>(
    `/api/v2/visits/${b.id}/consultations/accept`,
    doctor.token,
    { version: b.version },
  );
  await context.addCookies([
    {
      name: "hospital_session",
      value: service.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  const row = page.getByTestId(`service-order-${first.orders[0].id}`);
  await expect(row).toContainText(a.name);
  if (process.env.PB012_CAPTURE === "1")
    await page.screenshot({
      path: `artifacts/${info.project.name}-pb012-service.png`,
      animations: "disabled",
    });
  await expect(row.locator("input,textarea")).toHaveCount(0);
  await row
    .getByRole("button", { name: "Complete service", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(row).toContainText("Completed");
  await expect(
    row.getByRole("button", { name: "Complete service", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(row).toContainText(a.name);

  const doctorContext = await browser.newContext({
    viewport: page.viewportSize(),
  });
  try {
    await doctorContext.addCookies([
      {
        name: "hospital_session",
        value: doctor.token!,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await doctorContext.addInitScript(() =>
      localStorage.setItem("hospital.language", "en"),
    );
    const doctorPage = await doctorContext.newPage();
    await doctorPage.goto(baseURL!);
    await expect(doctorPage.getByTestId("current-consultation")).toContainText(
      b.name,
    );
    const waitingA = doctorPage
      .locator("article.record-row")
      .filter({ hasText: a.name });
    const accept = waitingA.getByRole("button", {
      name: "Accept consultation",
      exact: true,
    });
    await expect(accept).toBeDisabled();
    if (process.env.PB012_CAPTURE === "1")
      await doctorPage.screenshot({
        path: `artifacts/${info.project.name}-pb012-doctor.png`,
        animations: "disabled",
      });
    await send(currentB);
    await expect(accept).toBeEnabled({ timeout: 15000 });
    await accept.click();
    await expect(doctorPage.getByTestId("current-consultation")).toContainText(
      a.name,
    );
    const acceptedA = await api<VisitV2>(
      `/api/v2/visits/${a.id}`,
      doctor.token,
    );
    expect(acceptedA.consultationCount).toBe(2);
    const second = await send(acceptedA);
    await page
      .getByRole("button", { name: "Not completed", exact: true })
      .click();
    const secondRow = page.getByTestId(
      `service-order-${second.orders.at(-1)!.id}`,
    );
    await secondRow
      .getByRole("button", { name: "Complete service", exact: true })
      .click();
    await expect(secondRow).toHaveCount(0);
    await expect(
      waitingA.getByRole("button", {
        name: "Accept consultation",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 15000 });
    const final = await api<VisitV2>(`/api/v2/visits/${a.id}`, doctor.token);
    expect(final.examStatus).toBe("Waiting");
    expect(final.orders.every((o) => o.status === "Completed")).toBeTruthy();
    expect(
      final.steps.filter((s) => s.kind === "ReturnConsultation"),
    ).toHaveLength(2);
    expect(final.ticket).toEqual(first.ticket);
    expect(final.currentStep?.destination).toEqual(first.clinic);
  } finally {
    await doctorContext.close();
  }
});
