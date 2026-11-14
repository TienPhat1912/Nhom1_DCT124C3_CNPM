import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  Session,
  ConfirmReceptionResultV2,
  RegistrationRequestV2,
} from "@hospital/shared";
const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
async function api<T>(
  path: string,
  token?: string,
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
  expect(response.ok).toBeTruthy();
  return response.json();
}
async function enter(context: BrowserContext, url: string, token?: string) {
  if (token)
    await context.addCookies([
      {
        name: "hospital_session",
        value: token,
        url,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  await context.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  const page = await context.newPage();
  await page.goto("/");
  return page;
}
test("Reception selects the printed ticket and a new device recovers the same Journey", async ({
  browser,
  baseURL,
}, info) => {
  const guest = await api<Session>("/api/auth/guest", undefined, {
    language: "en",
  });
  const name = `PB020 browser ${randomUUID().slice(0, 8)}`;
  await api(
    "/api/auth/profile",
    guest.token!,
    { name, contact: "synthetic-contact", language: "en", version: 1 },
    "PUT",
  );
  const reception = await api<Session>("/api/auth/login", undefined, {
    email: "reception@demo.local",
    password,
  });
  const clinic = (
    await api<{ clinicLocationId: string; version: number }[]>(
      "/api/v2/reception/clinics",
      reception.token!,
    )
  )[0];
  const request = await api<RegistrationRequestV2>(
    "/api/v2/requests",
    guest.token!,
    {
      contact: "synthetic-contact",
      description: "",
      sourceLanguage: "vi",
      preferredDepartmentId: null,
    },
  );
  const result = await api<ConfirmReceptionResultV2>(
    `/api/v2/requests/${request.id}/confirm`,
    reception.token!,
    {
      version: request.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "Synthetic guest verification",
    },
  );
  const staffContext = await browser.newContext(info.project.use),
    device = await browser.newContext(info.project.use);
  try {
    const staff = await enter(staffContext, baseURL!, reception.token!);
    await expect(staff.locator(".sidebar")).toBeAttached();
    await staff
      .getByText("Find a ticket and recover Guest access", { exact: true })
      .click();
    await staff
      .getByLabel("Ticket number", { exact: true })
      .fill(String(result.ticket.sequenceNumber));
    await staff
      .getByLabel("Ticket issue date", { exact: true })
      .fill(result.ticket.issuedOn);
    const lookup = staff.locator("details.panel");
    await lookup
      .getByLabel("Location", { exact: true })
      .selectOption(clinic.clinicLocationId);
    await lookup
      .getByRole("button", { name: "Find tickets", exact: true })
      .click();
    await lookup.getByRole("button", { name: new RegExp(name) }).click();
    await lookup.locator("details.sub-panel summary").click();
    const issue = lookup.getByRole("button", {
      name: "Issue single-use recovery code",
      exact: true,
    });
    await expect(issue).toBeDisabled();
    await lookup
      .getByLabel("Verification note", { exact: true })
      .fill("Verified printed ticket and attendee");
    await lookup.getByLabel("I verified the attendee in person").check();
    await issue.click();
    const code = await lookup.locator(".code-wrap").textContent();
    expect(code).toMatch(/^[a-f0-9]{64}$/);
    await expect(lookup).toContainText("Valid until");
    const patient = await enter(device, baseURL!);
    await patient
      .getByRole("button", { name: "Recover access", exact: true })
      .click();
    await patient
      .getByLabel("Recovery code from reception", { exact: true })
      .fill(` ${code} `);
    await patient
      .locator("form")
      .getByRole("button", { name: "Recover access", exact: true })
      .click();
    await expect(patient).toHaveURL(new RegExp(`#visit=${result.visit.id}`));
    await expect(patient.locator(".sidebar")).toBeAttached();
    const read = await device.request.get(
      baseURL + `/api/visits/${result.visit.id}?language=vi`,
    );
    expect(read.ok()).toBeTruthy();
    expect((await read.json()).journeyId).toBe(result.ticket.journeyId);
    if (process.env.CAPTURE_SCREENSHOTS === "1")
      await patient.screenshot({
        path: `artifacts/${info.project.name}-pb020.png`,
        timeout: 10000,
      });
  } finally {
    await staffContext.close();
    await device.close();
  }
});
