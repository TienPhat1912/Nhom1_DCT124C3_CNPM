import { test, expect } from "@playwright/test";

const now = Date.parse("2026-11-15T00:00:00Z");
const configuration = {
  name: "Hospital",
  demo: false,
  departments: [],
  services: [],
  locations: [],
  form: {},
  guestHours: 24,
  pollSeconds: 5,
};
const session = (id: string, role = "Patient") => ({
  sessionId: id,
  patientId: role === "Patient" ? id : null,
  role,
  name: "Presence fixture",
  language: "en",
  isGuest: role === "Patient",
  expiresAt: new Date(now + 3600000).toISOString(),
});
const heartbeat = {
  lastSeenAt: new Date(now).toISOString(),
  heartbeatSeconds: 15,
  ttlSeconds: 60,
};

test("web foreground heartbeat, re-renders, logout and new Guest never retain the old timer", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(now - 1000) });
  await page.clock.pauseAt(new Date(now));
  await page.addInitScript(() => {
    localStorage.setItem("hospital.language", "en");
    const state = window as typeof window & { presenceVisible: boolean };
    state.presenceVisible = true;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (state.presenceVisible ? "visible" : "hidden"),
    });
  });
  let current: ReturnType<typeof session> | null = session("first");
  const beats: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v2/presence/heartbeat") {
      beats.push(current?.sessionId ?? "none");
      expect(route.request().method()).toBe("POST");
      expect(route.request().postData()).toBeNull();
      expect(route.request().headers()["idempotency-key"]).toBeUndefined();
      await route.fulfill({ json: heartbeat });
      return;
    }
    if (path === "/api/auth/logout") {
      current = null;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (path === "/api/auth/guest") {
      current = session("second");
      await route.fulfill({ json: current });
      return;
    }
    await route.fulfill({
      json:
        path === "/api/auth/session"
          ? current
          : path === "/api/config"
            ? configuration
            : [],
    });
  });
  await page.goto("/");
  await expect.poll(() => beats.length).toBe(1);
  await page.clock.fastForward(14999);
  expect(beats).toEqual(["first"]);
  await page.clock.fastForward(1);
  await expect.poll(() => beats.length).toBe(2);
  await page.evaluate(() => {
    (window as typeof window & { presenceVisible: boolean }).presenceVisible =
      false;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(60000);
  expect(beats.length).toBe(2);
  await page.evaluate(() => {
    (window as typeof window & { presenceVisible: boolean }).presenceVisible =
      true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => beats.length).toBe(3);
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
  });
  expect(beats.length).toBe(3);
  const menu = page.locator(".mobile-menu");
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue as guest", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(60000);
  expect(beats.length).toBe(3);
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await expect.poll(() => beats.length).toBe(4);
  expect(beats.at(-1)).toBe("second");
  await page.getByLabel("Language", { exact: true }).selectOption("ja");
  expect(beats.length).toBe(4);
  await page.clock.fastForward(15000);
  await expect.poll(() => beats.length).toBe(5);
  expect(beats).toEqual(["first", "first", "first", "second", "second"]);
});

test("online card refreshes every five seconds and keeps counts and timestamp stale on failure", async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date(now - 1000) });
  await page.clock.pauseAt(new Date(now));
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  let failing = true,
    reads = 0;
  let online = {
    generatedAt: new Date(now).toISOString(),
    ttlSeconds: 60,
    accounts: 2,
    guests: 1,
    total: 3,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v2/admin/presence") {
      reads++;
      if (failing) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({ json: online });
      return;
    }
    const dashboard = {
      generatedAt: online.generatedAt,
      timeZone: "Asia/Ho_Chi_Minh",
      days: 7,
      online,
      summary: {
        visitsToday: 0,
        closedToday: 0,
        activeVisits: 0,
        pendingRequests: 0,
        openAssistance: 0,
      },
      daily: [],
      departments: [],
      configuration: {
        activeDepartments: 0,
        activeStaff: 0,
        activeServices: 0,
        servicesWithoutMapping: 0,
      },
    };
    await route.fulfill({
      json:
        path === "/api/auth/session"
          ? session("admin", "Admin")
          : path === "/api/config"
            ? configuration
            : path === "/api/admin/dashboard"
              ? dashboard
              : path === "/api/v2/presence/heartbeat"
                ? heartbeat
                : [],
    });
  });
  await page.goto("/");
  const card = page.getByRole("region", { name: "Online now", exact: true });
  await expect(card).toContainText("Online counts are unavailable.");
  await expect(card.getByTestId("online-total")).toHaveCount(0);
  failing = false;
  await card.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(card.getByTestId("online-total")).toHaveText("3");
  const before = reads;
  const original = online.generatedAt;
  await page.clock.fastForward(4999);
  expect(reads).toBe(before);
  failing = true;
  await page.clock.fastForward(1);
  await expect(card).toContainText(
    "Connection lost; showing the last successfully updated counts.",
  );
  await expect(card.getByTestId("online-total")).toHaveText("3");
  await expect(card.getByTestId("online-updated")).toHaveAttribute(
    "datetime",
    original,
  );
  failing = false;
  online = {
    ...online,
    generatedAt: new Date(now + 5000).toISOString(),
    accounts: 4,
    total: 5,
  };
  await card.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(card.getByTestId("online-total")).toHaveText("5");
  await expect(card.getByTestId("online-updated")).toHaveAttribute(
    "datetime",
    online.generatedAt,
  );
  await expect(card).not.toContainText("Connection lost");
  if (process.env.CAPTURE_SCREENSHOTS === "1")
    await card.screenshot({
      path: `artifacts/${info.project.name}-pb029-online.png`,
      timeout: 10000,
    });
});


test("logout broadcasts the cookie session change and stops other tabs", async ({ context, page }) => {
  let current: ReturnType<typeof session> | null = session("shared-cookie");
  let beats = 0;
  await context.addInitScript(() => {
    localStorage.setItem("hospital.language", "en");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v2/presence/heartbeat") beats++;
    if (path === "/api/auth/logout") current = null;
    await route.fulfill({ json: path === "/api/auth/session" ? current : path === "/api/config" ? configuration : path === "/api/v2/presence/heartbeat" ? heartbeat : [] });
  });
  const other = await context.newPage();
  for (const tab of [page, other]) {
    await tab.clock.install({ time: new Date(now - 1000) });
    await tab.clock.pauseAt(new Date(now));
    await tab.goto("/");
  }
  await expect.poll(() => beats).toBe(2);
  const menu = page.locator(".mobile-menu");
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  for (const tab of [page, other]) {
    await expect(tab.getByRole("button", { name: "Continue as guest", exact: true })).toBeVisible();
    await tab.clock.fastForward(60000);
  }
  expect(beats).toBe(2);
});
