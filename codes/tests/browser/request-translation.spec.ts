import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Session, RegistrationRequestV2 } from "@hospital/shared";

const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
const mock = process.env.MOCK_TRANSLATION_URL!;
async function api<T>(
  path: string,
  token?: string,
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
test("Reception reads exact original, sees failure, retries Vietnamese translation and keeps confirmation available", async ({
  page,
  context,
  baseURL,
}, info) => {
  const name = `PB018 ${randomUUID().slice(0, 8)}`;
  const original = "  Original description\n原文 " + randomUUID();
  const patient = await api<Session>("/api/auth/register", undefined, {
    email: `${randomUUID()}@example.test`,
    password,
    name,
    contact: "synthetic-contact",
    language: "en",
  });
  const request = await api<RegistrationRequestV2>(
    "/api/v2/requests",
    patient.token!,
    {
      contact: "synthetic-contact",
      preferredDepartmentId: null,
      description: original,
      sourceLanguage: "en",
    },
  );
  const reception = await api<Session>("/api/auth/login", undefined, {
    email: "reception@demo.local",
    password,
  });
  await context.addCookies([
    {
      name: "hospital_session",
      value: reception.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  let translationReads = 0;
  page.on("request", (r) => {
    if (r.url().includes(`/${request.id}/translation`)) translationReads++;
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: new RegExp(name) }),
  ).toBeVisible();
  expect(translationReads).toBe(0);
  await fetch(mock + "/fail");
  try {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const section = page.getByRole("region", {
      name: "Description translated into Vietnamese",
    });
    await expect(section).toContainText(
      "Description translation is unavailable",
    );
    expect(await page.locator(".detail-grid dd").last().textContent()).toBe(
      original,
    );
    await expect(
      page.getByRole("button", { name: "Confirm reception & issue ticket" }),
    ).toBeVisible();
    await fetch(mock + "/recover");
    await section.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(section).toContainText("Bản Việt: " + original.trim());
    expect(await page.locator(".detail-grid dd").last().textContent()).toBe(
      original,
    );
    const unchanged = await api<RegistrationRequestV2>(
      `/api/v2/requests/${request.id}`,
      patient.token!,
    );
    expect(unchanged.version).toBe(request.version);
    expect(unchanged.description).toBe(original);
    if (process.env.CAPTURE_SCREENSHOTS === "1")
      await page.screenshot({
        path: `artifacts/${info.project.name}-pb018.png`,
        timeout: 10000,
      });
  } finally {
    await fetch(mock + "/recover");
  }
});
