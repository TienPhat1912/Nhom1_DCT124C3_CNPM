import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Session } from "@hospital/shared";
const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!,
  mock = process.env.MOCK_TRANSLATION_URL!;
async function api(path: string, body: unknown): Promise<Session> {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBeTruthy();
  return response.json();
}
async function enter(
  context: BrowserContext,
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
  await context.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeAttached();
  const menu = page.locator(".mobile-menu");
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Assistance", exact: true }).click();
  return page;
}
test("patient submits before Journey and tracks Reception handling despite a translation failure", async ({
  browser,
  baseURL,
}, info) => {
  const name = `PB019 browser ${randomUUID().slice(0, 8)}`;
  const patient = await api("/api/auth/register", {
    email: `${randomUUID()}@example.test`,
    password,
    name,
    contact: "synthetic-contact",
    language: "en",
  });
  const reception = await api("/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
  const patientContext = await browser.newContext(info.project.use),
    staffContext = await browser.newContext(info.project.use);
  try {
    const page = await enter(patientContext, patient, baseURL!);
    const original = "  Browser help " + randomUUID();
    await page.getByLabel("Description language").selectOption("en");
    await page.getByLabel("More details (optional)").fill(original);
    await page
      .getByRole("button", { name: "Request assistance", exact: true })
      .click();
    await expect(page.getByText(original, { exact: true })).toBeVisible();
    const staff = await enter(staffContext, reception, baseURL!);
    const card = staff.locator(".panel").filter({ hasText: name });
    await fetch(mock + "/fail");
    await card.getByRole("button", { name: "View details", exact: true }).click();
    await expect(card).toContainText("Description translation is unavailable");
    await expect(card.getByText(original, { exact: true })).toBeVisible();
    await fetch(mock + "/recover");
    await card.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(card).toContainText("Bản Việt: " + original.trim());
    await card
      .getByRole("button", { name: "Acknowledge", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Mark resolved", exact: true }),
    ).toBeVisible();
    await card
      .getByLabel("Resolution", { exact: true })
      .fill("Reception assisted");
    await card
      .getByRole("button", { name: "Mark resolved", exact: true })
      .click();
    await expect(card.getByRole("button", { name: "Mark resolved", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".sidebar")).toBeAttached();
    const menu = page.locator(".mobile-menu");
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: "Assistance", exact: true }).click();
    await expect(page.getByText("Reception assisted")).toBeVisible();
    if (process.env.CAPTURE_SCREENSHOTS === "1")
      await staff.screenshot({
        path: `artifacts/${info.project.name}-pb019.png`,
        timeout: 10000,
      });
  } finally {
    await fetch(mock + "/recover");
    await patientContext.close();
    await staffContext.close();
  }
});
test("Service has no assistance navigation", async ({
  browser,
  baseURL,
}, info) => {
  const service = await api("/api/auth/login", {
    email: "service@demo.local",
    password,
  });
  const context = await browser.newContext(info.project.use);
  try {
    await context.addCookies([
      {
        name: "hospital_session",
        value: service.token!,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await context.addInitScript(() =>
      localStorage.setItem("hospital.language", "en"),
    );
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeAttached();
    await expect(
      page
        .locator(".sidebar")
        .getByRole("button", { name: "Assistance", exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
