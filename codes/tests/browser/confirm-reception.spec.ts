import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  Session,
  RegistrationRequestV2,
  ExaminationTicketV2,
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
  expect(response.ok).toBeTruthy();
  return response.json() as Promise<T>;
}
async function enter(
  context: BrowserContext,
  page: Page,
  session: Session,
  baseURL: string,
) {
  await context.addCookies([
    {
      name: "hospital_session",
      value: session.token!,
      url: baseURL,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeAttached();
}
test("Reception confirms once; patient enters active Journey without QR; reprint and reload preserve ticket", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const name = `PB008 ${randomUUID().slice(0, 8)}`;
  const patient = await api<Session>("/api/auth/register", null, {
    email: `${randomUUID()}@example.test`,
    password,
    name,
    contact: "test-contact",
    language: "en",
  });
  const reception = await api<Session>("/api/auth/login", null, {
    email: "reception@demo.local",
    password,
  });
  await enter(context, page, patient, baseURL!);
  const mobileMenu = page.locator(".mobile-menu");
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
    await expect(page.locator(".sidebar")).toHaveClass(/open/);
  }
  await page.getByRole("button", { name: "Reception", exact: true }).click();
  await page
    .getByLabel("What you would like to tell staff", { exact: true })
    .fill("  Browser original\n");
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await expect(
    page.getByText(
      "Request submitted. Please wait for reception confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
  const rows = await api<RegistrationRequestV2[]>(
    "/api/v2/requests",
    patient.token,
  );
  const row = rows[0];
  const staffContext = await browser.newContext({ baseURL });
  try {
    const staff = await staffContext.newPage();
    await enter(staffContext, staff, reception, baseURL!);
    await staff.getByRole("button", { name: new RegExp(name) }).click();
    await expect
      .poll(() => staff.locator(".detail-grid dd").last().textContent())
      .toBe("  Browser original\n");
    const clinics = await api<{ clinicLocationId: string; room: string }[]>(
      "/api/v2/reception/clinics",
      reception.token,
    );
    // Both the ticket lookup and confirmation form have a Location field.
    await staff
      .getByText("Find a ticket and recover Guest access", { exact: true })
      .click();
    const confirmation = staff.getByRole("group").filter({
      has: staff.getByRole("button", {
        name: "Confirm reception & issue ticket",
        exact: true,
      }),
    });
    await confirmation
      .getByLabel("Location", { exact: true })
      .selectOption(clinics.find((c) => c.room === "A101")!.clinicLocationId);
    await confirmation
      .getByLabel("Verification note", { exact: true })
      .fill("Verified at reception");
    await confirmation.getByRole("checkbox").check();
    await confirmation
      .getByRole("button", {
        name: "Confirm reception & issue ticket",
        exact: true,
      })
      .click();
    await expect(staff.getByTestId("ticket-v2")).toBeVisible();
    await staff.evaluate(() => {
      window.print = () => {
        document.body.dataset.printed = "yes";
      };
    });
    await staff
      .getByRole("button", { name: "Reprint ticket", exact: true })
      .click();
    await expect(staff.locator("body")).toHaveAttribute("data-printed", "yes");
    const confirmed = await api<RegistrationRequestV2>(
      `/api/v2/requests/${row.id}`,
      reception.token,
    );
    expect(confirmed.visitId).toBeTruthy();
    const ticket = await api<ExaminationTicketV2>(
      `/api/visits/${confirmed.visitId}/ticket`,
      patient.token,
    );
    await page.bringToFront();
    await expect(page).toHaveURL(new RegExp(`#visit=${confirmed.visitId}`));
    await expect(
      page.getByRole("heading", { name: "Your visit journey", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /activate/i })).toHaveCount(
      0,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Your visit journey", exact: true }),
    ).toBeVisible();
    expect(
      await api(`/api/visits/${confirmed.visitId}/ticket`, patient.token),
    ).toEqual(ticket);
    await staff.bringToFront();
    await staff.reload();
    await staff.getByRole("button", { name: new RegExp(name) }).click();
    await expect(staff.getByTestId("ticket-v2")).toContainText(ticket.number);
    await expect(staff.getByTestId("ticket-v2")).toContainText(ticket.issuedOn);
    await expect(
      staff.getByRole("button", {
        name: "Confirm reception & issue ticket",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await staffContext.close();
  }
});
