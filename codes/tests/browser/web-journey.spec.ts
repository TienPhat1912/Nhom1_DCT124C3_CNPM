import { translator } from "@hospital/shared";
import { test, expect, type Page } from "@playwright/test";

function step(id: string, kind: string, room: string, status = "Ready") {
  return {
    id,
    version: 1,
    kind,
    status,
    sequence: Number(id.slice(1)),
    destination: {
      id: room,
      name: room,
      nameVi: room,
      room,
      building: "A",
      floor: "1",
    },
    text: `Go to ${room}`,
    queueNumber: "OLD-QUEUE",
    queueStatus: "Waiting",
    canCompleteGuidance: true,
    templateVersion: 1,
    contentLanguage: "en",
  };
}
function visit() {
  return {
    id: "journey-fixture",
    version: 1,
    ticketNumber: "A101-007",
    status: "Active",
    journeyStatus: "Active",
    examStatus: "Waiting",
    journeyVersion: 1,
    doctorName: "Fixture Doctor",
    updatedAt: new Date().toISOString(),
    currentStepId: "s1",
    steps: [step("s1", "Consultation", "A101")],
    orders: [],
  };
}
async function fixture(page: Page, useHash = true) {
  let current = visit();
  let disconnected = false;
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.route("**/api/**", async (route) => {
    if (disconnected) return route.abort("internetdisconnected");
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/auth/session"
        ? {
            sessionId: "journey-session",
            patientId: "patient",
            name: "Fixture Patient",
            role: "Patient",
            isGuest: true,
            language: "en",
            expiresAt: "2099-01-01T00:00:00Z",
          }
        : path === "/api/config"
          ? {
              name: "Hospital",
              departments: [],
              services: [],
              locations: [],
              form: {},
              prdV2Enabled: true,
            }
          : path === "/api/visits/journey-fixture"
            ? current
            : path === "/api/visits"
              ? [current]
              : [];
    await route.fulfill({ json: body });
  });
  await page.goto(useHash ? "/#visit=journey-fixture" : "/");
  if (!useHash)
    await page
      .locator("main")
      .getByRole("button", { name: "My journey", exact: true })
      .click();
  await expect(page.locator(".current-step h2")).toHaveText(
    "Initial consultation",
  );
  return {
    get current() {
      return current;
    },
    set(value: typeof current) {
      current = value;
    },
    disconnect(value: boolean) {
      disconnected = value;
    },
    async refresh() {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
  };
}

for (const rounds of [0, 2]) {
  test(`four examination states and automatic closure with ${rounds} service rounds`, async ({
    page,
  }, info) => {
    const f = await fixture(page);
    const exam = page.getByTestId("exam-status");
    await expect(exam).toContainText("Waiting");
    await expect(page.locator(".queue-card strong")).toHaveText("A101-007");
    for (let round = 0; round <= rounds; round++) {
      f.set({
        ...f.current,
        version: f.current.version + 1,
        examStatus: "InConsultation",
      });
      await f.refresh();
      await expect(exam).toContainText("In consultation");
      if (round === rounds) break;
      const service = step(`s${round * 2 + 2}`, "Service", `LAB${round + 1}`);
      f.set({
        ...f.current,
        version: f.current.version + 1,
        examStatus: "InService",
        currentStepId: service.id,
        steps: [
          ...f.current.steps.map((s) => ({ ...s, status: "Completed" })),
          service,
        ],
      });
      await f.refresh();
      await expect(exam).toContainText("Undergoing service");
      await expect(page.locator(".current-step .destination")).toContainText(
        service.destination.room,
      );
      if (round === 0)
        await page.screenshot({
          path: `artifacts/${info.project.name}-pb021-service.png`,
          fullPage: true,
        });
      const returned = step(`s${round * 2 + 3}`, "ReturnConsultation", "A101");
      f.set({
        ...f.current,
        version: f.current.version + 1,
        examStatus: "Waiting",
        currentStepId: returned.id,
        steps: [
          ...f.current.steps.map((s) => ({ ...s, status: "Completed" })),
          returned,
        ],
      });
      await f.refresh();
      await expect(page.locator(".current-step h2")).toHaveText(
        "Return consultation",
      );
      await expect(page.locator(".current-step .destination")).toContainText(
        "A101",
      );
      await expect(exam).toContainText("Waiting");
      await expect(page.locator(".queue-card strong")).toHaveText("A101-007");
    }
    const settlement = step("s99", "Settlement", "CASHIER");
    f.set({
      ...f.current,
      version: f.current.version + 1,
      examStatus: "Completed",
      currentStepId: settlement.id,
      steps: [
        ...f.current.steps.map((s) => ({ ...s, status: "Completed" })),
        settlement,
      ],
    });
    await f.refresh();
    await expect(exam).toContainText("Completed");
    await expect(page.locator(".completion-card")).toHaveCount(0);
    await expect(page.locator(".visit-meta")).toContainText("Active");
    f.set({
      ...f.current,
      version: f.current.version + 1,
      status: "Closed",
      journeyStatus: "Completed",
      currentStepId: "",
      steps: f.current.steps.map((s) => ({ ...s, status: "Completed" })),
    });
    await f.refresh();
    await expect(page.locator(".completion-card")).toBeVisible();
    await expect(page.locator(".visit-meta")).toContainText("Closed");
    await expect(page.locator(".timeline-step.done")).toHaveCount(
      f.current.steps.length,
    );
    await expect(
      page.getByRole("button", { name: /Complete guidance/i }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/${info.project.name}-pb021-${rounds}-rounds.png`,
      fullPage: true,
    });
  });
}

test("cached journey survives API loss and reload, reconnect rejects older snapshots", async ({
  page,
}) => {
  const f = await fixture(page);
  const old = f.current;
  f.set({ ...old, version: 10, examStatus: "InConsultation" });
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  f.disconnect(true);
  await f.refresh();
  await expect(
    page.getByText(/Showing previously loaded information/),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  await expect(
    page.getByText(/Showing previously loaded information/),
  ).toBeVisible();
  f.disconnect(false);
  f.set(old);
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  f.set({
    ...old,
    version: 11,
    examStatus: "InService",
    currentStepId: "s2",
    steps: [step("s2", "Service", "LAB")],
  });
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    "Undergoing service",
  );
  await expect(
    page.getByText(/Showing previously loaded information/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Listen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Get help", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a late request cannot replace a newer snapshot and an auth denial clears tab snapshots", async ({
  page,
}) => {
  const f = await fixture(page);
  const delayedSnapshot = f.current;
  let release: (() => void) | undefined;
  await page.route(
    "**/api/visits/journey-fixture?*",
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ json: delayedSnapshot }).catch(() => {});
    },
    { times: 1 },
  );
  await f.refresh();
  await expect.poll(() => !!release).toBe(true);
  f.set({ ...f.current, version: 12, examStatus: "InConsultation" });
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  release!();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: { title: "sessionExpired", status: 401, detail: "Expired" },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue as guest", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter(
        (key) =>
          key.startsWith("hospital.cache:") ||
          key === "hospital.offline-session",
      ),
    ),
  ).toEqual([]);
  await expect(page.getByText("A101-007", { exact: true })).toHaveCount(0);
});

test("changing language cannot restore an older examination version", async ({
  page,
}) => {
  const f = await fixture(page);
  f.set({ ...f.current, version: 10, examStatus: "InConsultation" });
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    "In consultation",
  );
  f.set({ ...f.current, version: 1, examStatus: "Waiting" });
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("vi");
  await expect(page.getByTestId("exam-status")).toContainText(
    translator("vi")("InConsultation"),
  );
  await expect(page.getByTestId("exam-status")).not.toContainText("examStatus");
  f.set({ ...f.current, version: 11, examStatus: "InService" });
  await f.refresh();
  await expect(page.getByTestId("exam-status")).toContainText(
    translator("vi")("InService"),
  );
});

test("opening the default journey preserves its selection on reload", async ({
  page,
}) => {
  await fixture(page, false);
  await expect(page).toHaveURL(/#visit=journey-fixture/);
  await page.reload();
  await expect(page.locator(".current-step h2")).toHaveText(
    "Initial consultation",
  );
});
