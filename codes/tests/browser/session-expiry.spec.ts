import { test, expect } from "@playwright/test";

const day = 24 * 60 * 60 * 1000;
for (const scenario of [
  {
    name: "long session re-arms without overflowing the browser timer",
    duration: 40 * day,
    firstJump: 25 * day,
  },
  {
    name: "short session expires at its actual deadline",
    duration: 5000,
    firstJump: 4000,
  },
]) {
  test(scenario.name, async ({ page }) => {
    const now = Date.parse("2026-11-15T00:00:00Z");
    await page.clock.install({ time: new Date(now - 1000) });
    await page.clock.pauseAt(new Date(now));
    await page.addInitScript(() =>
      localStorage.setItem("hospital.language", "en"),
    );
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body =
        path === "/api/auth/session"
          ? {
              sessionId: "timer-session",
              patientId: "timer-patient",
              name: "Timer Guest",
              role: "Patient",
              isGuest: true,
              language: "en",
              expiresAt: new Date(now + scenario.duration).toISOString(),
            }
          : path === "/api/config"
            ? {
                name: "Hospital",
                demo: false,
                departments: [],
                services: [],
                locations: [],
                form: {},
                guestHours: 24,
                pollSeconds: 5,
              }
            : [];
      await route.fulfill({ json: body });
    });
    await page.goto("/");
    await expect(page.locator(".sidebar")).toBeAttached();
    // Keep each clock jump below the fake clock's signed 32-bit duration limit.
    const advance = async (milliseconds: number) => {
      while (milliseconds > 0) {
        const chunk = Math.min(milliseconds, 10 * day);
        await page.clock.fastForward(chunk);
        milliseconds -= chunk;
      }
    };
    await advance(scenario.firstJump);
    await expect(page.locator(".sidebar")).toBeAttached();
    await advance(scenario.duration - scenario.firstJump);
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue as guest", exact: true }),
    ).toBeVisible();
  });
}
