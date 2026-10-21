import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const password =
  process.env.DEMO_PASSWORD ??
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEMO_PASSWORD="))!
    .slice("DEMO_PASSWORD=".length);

test("HTTP-compatible command keys survive a retry and origins stay restricted", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  const loginKeys: string[] = [];
  await page.route("**/api/auth/login", async (route) => {
    loginKeys.push(route.request().headers()["idempotency-key"]);
    if (loginKeys.length === 1) await route.abort("failed");
    else await route.continue();
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("admin@demo.local");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  const signIn = page
    .getByRole("button", { name: "Đăng nhập", exact: true })
    .last();
  await signIn.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await signIn.click();
  await expect(
    page.getByRole("heading", { name: "Tổng quan hoạt động", exact: true }),
  ).toBeVisible();
  expect(loginKeys).toHaveLength(2);
  expect(loginKeys[0]).toMatch(/^[a-f0-9]{32}$/);
  expect(loginKeys[1]).toBe(loginKeys[0]);

  const origin = new URL(page.url()).origin;
  const allowed = await page.request.fetch("/api/auth/login", {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
  });
  expect(allowed.headers()["access-control-allow-origin"]).toBe(origin);
  const forbidden = await page.request.post("/api/auth/login", {
    headers: { Origin: "http://untrusted.invalid", "X-Hospital-Client": "1" },
    data: { email: "admin@demo.local", password, language: "vi" },
  });
  expect(forbidden.status()).toBe(403);
  expect((await forbidden.json()).title).toBe("requestOrigin");
  const preflight = await page.request.fetch("/api/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: "http://untrusted.invalid",
      "Access-Control-Request-Method": "POST",
    },
  });
  expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
  if (await page.locator(".mobile-menu").isVisible())
    await page.locator(".mobile-menu").click();
  const [logout] = await Promise.all([
    page.waitForRequest((request) =>
      request.url().endsWith("/api/auth/logout"),
    ),
    page.getByRole("button", { name: "Đăng xuất", exact: true }).click(),
  ]);
  expect(logout.headers()["idempotency-key"]).toMatch(/^[a-f0-9]{32}$/);
  expect(logout.headers()["idempotency-key"]).not.toBe(loginKeys[0]);
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
});

test("registration creates a session that survives reload and can sign in again", async ({ page }) => {
  const email = `lan-browser-${randomUUID()}@example.test`;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByLabel("Họ và tên", { exact: true }).fill("LAN Browser Test");
  await page.getByLabel("Thông tin liên hệ", { exact: true }).fill("browser-test-contact");
  const [registered] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/auth/register")),
    page.getByRole("button", { name: "Tạo tài khoản", exact: true }).last().click(),
  ]);
  expect(registered.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
  if (await page.locator(".mobile-menu").isVisible())
    await page.locator(".mobile-menu").click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("a stalled login stops spinning and allows retry", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    let stallLogin = true;
    window.fetch = (input, init) => {
      if (stallLogin && String(input).endsWith("/api/auth/login")) {
        stallLogin = false;
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      return originalFetch(input, init);
    };
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("admin@demo.local");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  const signIn = page.getByRole("button", { name: "Đăng nhập", exact: true }).last();
  await signIn.click();
  await expect(signIn).toBeDisabled();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 16_000 });
  await expect(signIn).toBeEnabled();
  await signIn.click();
  await expect(page.getByRole("heading", { name: "Tổng quan hoạt động", exact: true })).toBeVisible();
});
