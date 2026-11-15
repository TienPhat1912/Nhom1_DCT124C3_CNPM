import {
  test,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Session, OnlinePresenceV2 } from "@hospital/shared";
const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
async function api<T>(
  path: string,
  token?: string | null,
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
async function contextFor(browser: Browser, token: string, baseURL: string, options: Parameters<Browser["newContext"]>[0]) {
  const context = await browser.newContext({ ...options, baseURL });
  await context.addCookies([
    {
      name: "hospital_session",
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await context.addInitScript(() => {
    localStorage.setItem("hospital.language", "en");
    // Keep both test tabs foreground for deterministic multi-tab traffic.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });
  return context;
}
async function enter(context: BrowserContext) {
  const page = await context.newPage();
  const heartbeat = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v2/presence/heartbeat" &&
      r.status() === 200,
  );
  await page.goto("/");
  await heartbeat;
  return page;
}
test("API counts one Account across tabs/devices, independent Guest, and session-specific logout", async ({
  browser,
  baseURL,
}, info) => {
  const email = `${randomUUID()}@example.test`;
  const account = await api<Session>("/api/auth/register", null, {
    email,
    password,
    name: "PB029 same identity",
    contact: "same-contact",
    language: "en",
  });
  const otherDevice = await api<Session>("/api/auth/login", null, {
    email,
    password,
  });
  const guest = await api<Session>("/api/auth/guest", null, { language: "en" });
  await api(
    "/api/auth/profile",
    guest.token!,
    {
      name: "PB029 same identity",
      contact: "same-contact",
      language: "en",
      version: 1,
    },
    "PUT",
  );
  const admin = await api<Session>("/api/auth/login", null, {
    email: "admin@demo.local",
    password,
  });
  const sessions = [account, otherDevice, guest, admin];
  const contexts: BrowserContext[] = [];
  const counts = () =>
    api<OnlinePresenceV2>("/api/v2/admin/presence", admin.token!);
  try {
    const first = await contextFor(browser, account.token!, baseURL!, info.project.use);
    contexts.push(first);
    await enter(first);
    await enter(first);
    const second = await contextFor(browser, otherDevice.token!, baseURL!, info.project.use);
    contexts.push(second);
    await enter(second);
    await expect.poll(async () => (await counts()).accounts).toBe(1);
    const guestContext = await contextFor(browser, guest.token!, baseURL!, info.project.use);
    contexts.push(guestContext);
    await enter(guestContext);
    await expect.poll(async () => (await counts()).guests).toBe(1);
    const adminContext = await contextFor(browser, admin.token!, baseURL!, info.project.use);
    contexts.push(adminContext);
    const dashboard = await enter(adminContext);
    const card = dashboard.getByRole("region", {
      name: "Online now",
      exact: true,
    });
    await expect(card.getByTestId("online-accounts")).toHaveText("2");
    await expect(card.getByTestId("online-guests")).toHaveText("1");
    await expect(card.getByTestId("online-total")).toHaveText("3");
    await api("/api/auth/logout", account.token!, {});
    await expect.poll(async () => (await counts()).accounts).toBe(2); // Other Account device + Admin.
    await api("/api/auth/logout", otherDevice.token!, {});
    await expect(card.getByTestId("online-accounts")).toHaveText("1");
    await expect(card.getByTestId("online-total")).toHaveText("2");
    if (process.env.CAPTURE_SCREENSHOTS === "1")
      await card.screenshot({
        path: `artifacts/${info.project.name}-pb029-live.png`,
        timeout: 10000,
      });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await Promise.all(
      sessions.map((session) =>
        fetch(base + "/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hospital-Client": "1",
            Authorization: `Bearer ${session.token}`,
          },
          body: "{}",
        }).catch(() => {}),
      ),
    );
  }
});
