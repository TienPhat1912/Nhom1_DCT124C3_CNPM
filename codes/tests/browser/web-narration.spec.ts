import { test, expect, type Page } from "@playwright/test";

import type { VisitDeliveryEvent } from "@hospital/shared";
type SpeechMock = {
  calls: Array<{
    text: string;
    lang: string;
    onstart?: () => void;
    onend?: () => void;
    onerror?: (e: { error: string }) => void;
  }>;
  cancels: number;
  mode: string;
  voices: Array<{ lang: string }>;
};
declare global {
  interface Window {
    pb024: SpeechMock;
  }
}

function visit(id = "v1", room = "A101") {
  return {
    id,
    version: 1,
    ticketNumber: `${room}-007`,
    status: "Active",
    journeyStatus: "Active",
    examStatus: "Waiting",
    journeyVersion: 1,
    updatedAt: new Date().toISOString(),
    currentStepId: "s1",
    steps: [
      {
        id: "s1",
        version: 1,
        kind: "Consultation",
        status: "Ready",
        sequence: 1,
        destination: {
          id: room,
          name: room,
          nameVi: room,
          room,
          building: "A",
          floor: "1",
        },
        text: `Go to ${room}`,
        templateVersion: 1,
        contentKey: "content-1",
        contentLanguage: "en",
        queueNumber: "OLD",
        queueStatus: "Waiting",
        canCompleteGuidance: false,
      },
    ],
    orders: [],
  };
}
async function setup(page: Page, mode = "normal") {
  const visits = [visit(), visit("v2", "B202")];
  let polls = 0;
  let narrations = 0;
  let fail = false;
  let language = "en";
  let delay = false;
  let actualLanguage: string | null = null;
  let events: Array<
    Pick<VisitDeliveryEvent, "id" | "visitId" | "stale" | "expiresAt">
  > = [];
  const releases: Array<() => void> = [];
  await page.addInitScript((mode) => {
    localStorage.setItem("hospital.language", "en");
    window.pb024 = {
      calls: [],
      cancels: 0,
      mode,
      voices:
        mode === "loading"
          ? []
          : mode === "missing"
            ? [{ lang: "ja-JP" }]
            : [{ lang: "en-US" }, { lang: "vi-VN" }],
    };
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: () => {
          window.pb024.cancels++;
        },
        getVoices: () => window.pb024.voices,
        speak: (u: SpeechMock["calls"][number]) => {
          window.pb024.calls.push(u);
          if (window.pb024.mode === "throw") throw new Error("blocked");
          if (window.pb024.mode === "blocked")
            u.onerror?.({ error: "not-allowed" });
          else if (window.pb024.mode !== "silent") u.onstart?.();
        },
      },
    });
  }, mode);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const selected =
      visits.find((v) => path.startsWith(`/api/visits/${v.id}`)) ?? visits[0];
    let body: unknown = [];
    if (path === "/api/auth/session")
      body = {
        sessionId: "session-1",
        patientId: "patient",
        role: "Patient",
        name: "Narration Patient",
        isGuest: false,
        language: "en",
        expiresAt: "2099-01-01T00:00:00Z",
      };
    else if (path === "/api/config")
      body = {
        name: "Hospital",
        departments: [],
        services: [],
        locations: [],
        form: {},
        prdV2Enabled: true,
      };
    else if (path === "/api/visits") body = visits;
    else if (path.endsWith("/events")) {
      polls++;
      body = {
        visitId: selected.id,
        cursor: `${selected.id}:9007199254740993`,
        reset: !new URL(route.request().url()).searchParams.has("after"),
        pollAfterMs: 1000,
        state: selected,
        events,
      };
    } else if (path.endsWith("/narration")) {
      narrations++;
      const requested = route.request().postDataJSON();
      language = requested.language;
      body = {
        text: `${actualLanguage ?? language}: Go to ${selected.steps[0].destination.room}`,
        language: actualLanguage ?? language,
        revision: 1,
        cacheKey: requested.contentKey,
      };
      if (delay) await new Promise<void>((resolve) => releases.push(resolve));
      if (fail)
        return route.fulfill({
          status: 503,
          json: { title: "templateUnavailable", detail: "Unavailable" },
        });
    } else if (path.startsWith("/api/visits/")) body = selected;
    await route.fulfill({ json: body });
  });
  await page.goto("/#visit=v1");
  await expect(page.locator(".current-step h2")).toBeVisible();
  return {
    visits,
    get polls() {
      return polls;
    },
    get narrations() {
      return narrations;
    },
    get language() {
      return language;
    },
    fail(value: boolean) {
      fail = value;
    },
    delay(value: boolean) {
      delay = value;
    },
    actualLanguage(value: string) {
      actualLanguage = value;
    },
    events(value: typeof events) {
      events = value;
    },
    release() {
      releases.splice(0).forEach((r) => r());
    },
    get pending() {
      return releases.length;
    },
    async refresh() {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
  };
}
const spoken = (page: Page) =>
  page.evaluate(() =>
    window.pb024.calls.map((c) => ({ text: c.text, lang: c.lang })),
  );
const autoplay = (page: Page) => page.locator(".narration-preference input");
const listen = (page: Page) =>
  page.getByRole("button", { name: "Listen", exact: true });

test("repeated, expired and stale event deliveries never replay historical audio", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  f.events([
    {
      id: "old",
      visitId: "v1",
      stale: true,
      expiresAt: "2099-01-01T00:00:00Z",
    },
    {
      id: "expired",
      visitId: "v1",
      stale: false,
      expiresAt: "2000-01-01T00:00:00Z",
    },
    {
      id: "fresh",
      visitId: "v1",
      stale: false,
      expiresAt: "2099-01-01T00:00:00Z",
    },
  ]);
  const polls = f.polls;
  await expect.poll(() => f.polls).toBeGreaterThan(polls + 2);
  expect(await spoken(page)).toHaveLength(1);
  expect(f.narrations).toBe(1);
});

test("stopping while voices load cancels the old attempt; manual playback still works", async ({
  page,
}) => {
  await setup(page, "loading");
  await expect(page.getByTestId("narration-text")).toBeVisible();
  await autoplay(page).uncheck();
  await page.evaluate(() => {
    window.pb024.voices = [{ lang: "en-US" }];
  });
  await listen(page).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  await page.waitForTimeout(900);
  expect(await spoken(page)).toHaveLength(1);
});

test("automatic narration, stable polling dedup, queue call and measured delivery", async ({
  page,
}, info) => {
  const f = await setup(page);
  await expect
    .poll(() => spoken(page))
    .toEqual([
      {
        text: "Examination ticket: A101-007. Room: A101. en: Go to A101",
        lang: "en-US",
      },
    ]);
  f.visits[0].version++;
  // Legacy queue updates cannot call a V2 consultation before doctor acceptance.
  f.visits[0].steps[0].queueStatus = "Called";
  await f.refresh();
  await expect.poll(() => f.polls).toBeGreaterThan(2);
  expect(await spoken(page)).toHaveLength(1);
  const committed = Date.now();
  f.visits[0].version++;
  f.visits[0].examStatus = "InConsultation";
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  const elapsed = Date.now() - committed;
  await info.attach("commit-to-display-ms", {
    body: String(elapsed),
    contentType: "text/plain",
  });
  expect(elapsed).toBeLessThan(3500);
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
  expect((await spoken(page))[1].text).toContain("A101-007. Room: A101.");
  await page.screenshot({
    path: `artifacts/${info.project.name}-pb024-narration.png`,
    fullPage: true,
  });
});

test("autoplay off preserves manual replay and does not stop on Visit.Version", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  const before = await page.evaluate(() => window.pb024.cancels);
  f.visits[0].version++;
  await f.refresh();
  await expect.poll(() => f.polls).toBeGreaterThan(1);
  expect(await page.evaluate(() => window.pb024.cancels)).toBe(before);
  await autoplay(page).uncheck();
  f.visits[0].examStatus = "InConsultation";
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  expect(await spoken(page)).toHaveLength(1);
  await listen(page).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
  await listen(page).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(3);
});

for (const mode of ["blocked", "silent", "throw", "missing"]) {
  test(`${mode}: visible text, actionable error and manual recovery`, async ({
    page,
  }) => {
    await setup(page, mode);
    await expect(page.locator(".notice.error")).toBeVisible();
    await expect(page.getByTestId("narration-text")).toContainText("A101-007");
    await page.evaluate(() => {
      window.pb024.mode = "normal";
      window.pb024.voices = [{ lang: "en-US" }];
    });
    await listen(page).click();
    await expect(page.locator(".notice.error")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Stop playback", exact: true }),
    ).toBeVisible();
  });
}

test("late narration and callbacks cannot cross Visit, step or language boundaries", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  await autoplay(page).uncheck();
  f.delay(true);
  // Drop the cache by changing content, then hold the resulting request.
  f.visits[0].steps[0].contentKey = "content-2";
  f.visits[0].steps[0].text = "Changed instruction";
  await f.refresh();
  await expect(page.locator(".next-action p")).toHaveText(
    "Changed instruction",
  );
  await listen(page).click();
  await expect.poll(() => f.pending).toBe(1);
  await page.locator(".visit-picker select").selectOption("v2");
  await expect(page.locator(".queue-card strong")).toHaveText("B202-007");
  f.delay(false);
  f.release();
  expect(await spoken(page)).toHaveLength(1);
  await listen(page).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
  await page.evaluate(() =>
    window.pb024.calls[0].onerror?.({ error: "network" }),
  );
  await expect(page.locator(".notice.error")).toHaveCount(0);
  f.visits[1].currentStepId = "s2";
  f.visits[1].steps[0].id = "s2";
  f.visits[1].steps[0].destination.room = "LAB1";
  await f.refresh();
  await expect(page.locator(".current-step .destination")).toContainText(
    "LAB1",
  );
  await expect(
    page.getByRole("button", { name: "Stop playback", exact: true }),
  ).toHaveCount(0);
  await page.locator(".language-picker select").selectOption("vi");
  await page.locator(".journey-tools button").first().click();
  await expect.poll(() => f.language).toBe("vi");
  await expect
    .poll(async () => (await spoken(page)).at(-1)?.lang)
    .toBe("vi-VN");
});

test("legacy and service queue calls use the displayed queue number and room", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  f.visits[0].version++;
  f.visits[0].examStatus = "";
  f.visits[0].steps[0].kind = "Service";
  f.visits[0].steps[0].queueStatus = "Called";
  f.visits[0].steps[0].queueNumber = "LAB-012";
  f.visits[0].steps[0].destination.room = "LAB1";
  await f.refresh();
  await expect(page.locator(".queue-card strong")).toHaveText("LAB-012");
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
  expect((await spoken(page))[1].text).toContain("LAB-012. Room: LAB1.");
  await expect(page.getByTestId("narration-text")).toContainText(
    "Go to the destination",
  );
});

test("failed narration can be retried manually", async ({ page }) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  await autoplay(page).uncheck();
  f.fail(true);
  f.visits[0].steps[0].contentKey = "new-content";
  f.visits[0].steps[0].text = "Retry instruction";
  await f.refresh();
  await expect(page.locator(".next-action p")).toHaveText("Retry instruction");
  await listen(page).click();
  await expect(page.locator(".notice.error")).toBeVisible();
  f.fail(false);
  await listen(page).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(2);
});

test("translation fallback uses the actual Vietnamese voice and text", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  f.actualLanguage("vi");
  f.visits[0].steps[0].contentKey = "fallback-content";
  f.visits[0].steps[0].text = "Fallback instruction";
  await f.refresh();
  await expect
    .poll(async () => (await spoken(page)).at(-1)?.lang)
    .toBe("vi-VN");
  await expect(page.getByTestId("narration-text")).toContainText(
    "vi: Go to A101",
  );
});

test("logout discards in-flight narration and cancels the old patient's audio", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  await autoplay(page).uncheck();
  f.delay(true);
  f.visits[0].steps[0].contentKey = "logout-content";
  f.visits[0].steps[0].text = "Updated instruction before logout";
  await f.refresh();
  await expect(page.locator(".next-action p")).toHaveText(
    "Updated instruction before logout",
  );
  await listen(page).click();
  await expect.poll(() => f.pending).toBe(1);
  if (await page.locator(".mobile-menu").isVisible())
    await page.locator(".mobile-menu").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  f.release();
  expect(await spoken(page)).toHaveLength(1);
  await page.evaluate(() => window.pb024.calls[0].onend?.());
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("hidden journey and unmounted journey release speech and polling", async ({
  page,
}) => {
  const f = await setup(page);
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const count = f.polls;
  await page.waitForTimeout(2200);
  expect(f.polls).toBe(count);
  await expect(
    page.getByRole("button", { name: "Stop playback", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => f.polls).toBeGreaterThan(count);
  if (await page.locator(".mobile-menu").isVisible())
    await page.locator(".mobile-menu").click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const stopped = f.polls;
  await page.waitForTimeout(2200);
  expect(f.polls).toBe(stopped);
});
