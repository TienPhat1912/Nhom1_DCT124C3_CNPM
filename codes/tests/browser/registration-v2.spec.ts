import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Configuration, Session, Ticket } from "@hospital/shared";

const password = process.env.DEMO_PASSWORD!;
const base = process.env.API_URL!;
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
  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}
async function signInFixture(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  url: string,
) {
  const session = await api<Session>("/api/auth/register", null, {
    email: `${randomUUID()}@example.test`,
    password,
    name: "PB006 browser",
    contact: "synthetic-contact",
    language: "en",
  });
  await context.addCookies([
    {
      name: "hospital_session",
      value: session.token!,
      url,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hello, PB006 browser", exact: true }),
  ).toBeVisible();
  const navigate = async (label: string) => {
    if (await page.locator(".mobile-menu").isVisible())
      await page.locator(".mobile-menu").click();
    await page.getByRole("button", { name: label, exact: true }).click();
  };
  await navigate("Reception");
  return { session, navigate };
}

test("minimal form preserves the original and opens an existing pending request after retry", async ({
  page,
  context,
  baseURL,
}) => {
  await signInFixture(page, context, baseURL!);
  await expect(
    page.getByRole("button", { name: "With an appointment", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Support needs / additional information", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveCount(0);
  const original = "  原文\nBrowser original  ";
  await page
    .getByLabel("Description language", { exact: true })
    .selectOption("zh");
  await page
    .getByLabel("What you would like to tell staff", { exact: true })
    .fill(original);
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(
    page.getByLabel("Ngôn ngữ của mô tả", { exact: true }),
  ).toHaveValue("zh");
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(
    page.getByLabel("What you would like to tell staff", { exact: true }),
  ).toHaveValue(original);
  const payloads: unknown[] = [];
  let fail = true;
  await page.route("**/api/v2/requests", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    payloads.push(route.request().postDataJSON());
    if (fail) {
      fail = false;
      return route.abort("failed");
    }
    return route.continue();
  });
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByLabel("What you would like to tell staff", { exact: true }),
  ).toHaveValue(original);
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await expect(
    page.getByText(
      "Request submitted. Please wait for reception confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(payloads[1]).toEqual({
    contact: "synthetic-contact",
    preferredDepartmentId: null,
    description: original,
    sourceLanguage: "zh",
  });
  await expect
    .poll(() => page.locator("article p").last().textContent())
    .toBe(original);
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open existing request", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open existing request", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect
    .poll(() => page.locator("article p").last().textContent())
    .toBe(original);
  await expect(page.locator(".record-row")).toHaveCount(1);
});

test("active Visit conflict continues the authorized Visit", async ({
  page,
  context,
  baseURL,
}) => {
  const { session } = await signInFixture(page, context, baseURL!);
  const config = await api<Configuration>("/api/config");
  const reception = await api<Session>("/api/auth/login", null, {
    email: "reception@demo.local",
    password,
  });
  const departmentId = config.departments.find((d) => d.code === "CONSULT")!.id;
  const request = await api<{ id: string }>("/api/requests", session.token, {
    name: "PB006 browser",
    contact: "synthetic-contact",
    description: "",
    requests: "",
    departmentId,
  });
  const { visitId } = await api<{ visitId: string }>(
    `/api/requests/${request.id}/confirm`,
    reception.token,
    {
      version: 1,
      departmentId,
      locationId: config.locations.find((l) => l.room === "A101")!.id,
      attendeeVerified: true,
      verificationNote: "Browser active Visit fixture",
    },
  );
  const ticket = await api<Ticket>(
    `/api/visits/${visitId}/ticket`,
    session.token,
  );
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open existing Visit", exact: true })
    .click();
  await expect(page.locator(".visit-meta")).toContainText(ticket.number);
});

test("historical pending request remains readable without the supplement form", async ({
  page,
  context,
  baseURL,
}) => {
  const { session } = await signInFixture(page, context, baseURL!);
  const config = await api<Configuration>("/api/config");
  await api("/api/requests", session.token, {
    name: "Old browser fixture",
    contact: "synthetic-contact",
    description: "Legacy original",
    requests: "Legacy additional text",
    departmentId: config.departments.find((d) => d.code === "CONSULT")!.id,
  });
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open existing request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reception QR", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Legacy original", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update information", exact: true }),
  ).toHaveCount(0);
});

test("a new Guest completes the profile before submitting the contact-only form", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  const navigate = async (label: string) => {
    if (await page.locator(".mobile-menu").isVisible())
      await page.locator(".mobile-menu").click();
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
  };
  await expect(
    page.getByRole("button", { name: "Prepare for reception", exact: true }),
  ).toBeVisible();
  await navigate("Reception");
  await expect(
    page.getByRole("button", { name: "Submit information", exact: true }),
  ).toBeDisabled();
  await page
    .locator("main")
    .getByRole("button", { name: "My profile", exact: true })
    .click();
  await page
    .getByLabel("Full name", { exact: true })
    .fill("PB006 Guest browser");
  await page
    .getByLabel("Contact information", { exact: true })
    .fill("synthetic-contact");
  const [saved] = await Promise.all([
    page.waitForResponse(response => response.url().includes("/api/auth/profile") && response.request().method() === "PUT"),
    page.getByRole("button", { name: "Save changes", exact: true }).click(),
  ]);
  expect(saved.status()).toBe(200);
  // Profile refresh remounts its form, so validate persisted data, not a transient toast.
  const persisted = await page.request.get("/api/auth/profile");
  expect((await persisted.json()).name).toBe("PB006 Guest browser");
  await navigate("Reception");
  await page
    .getByRole("button", { name: "Submit information", exact: true })
    .click();
  await expect(
    page.getByText(
      "Request submitted. Please wait for reception confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
});
