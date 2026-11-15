import { test, expect, type Page } from "@playwright/test";
import { mapFixture } from "../map/fixture";
type MockSpeech = {
  pb033: { calls: SpeechSynthesisUtterance[]; cancels: number };
};
const count = (page: Page) =>
  page.evaluate(() => (window as unknown as MockSpeech).pb033.calls.length);
async function end(page: Page, index = -1, start = false) {
  await page.evaluate(
    ({ index, start }) => {
      const calls = (window as unknown as MockSpeech).pb033.calls;
      const u = index < 0 ? calls.at(-1)! : calls[index];
      if (start) u.onstart?.call(u, {} as SpeechSynthesisEvent);
      else u.onend?.call(u, {} as SpeechSynthesisEvent);
    },
    { index, start },
  );
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-16T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-16T00:00:01Z"));
});
test("PB026 long speech, reroute mid-edge and manual replay reject old callbacks", async ({
  page,
}, info) => {
  const f = await mapFixture(page, false),
    d = f.dialog,
    p = d.getByTestId("simulation-position");
  await expect.poll(() => count(page)).toBe(1);
  const initial = [
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ];
  await page.clock.runFor(6000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(initial);
  await end(page);
  await page.clock.runFor(2500);
  const mid = [await p.getAttribute("data-x"), await p.getAttribute("data-y")];
  expect(mid).not.toEqual(initial);
  await f.target("B201");
  await expect.poll(() => count(page)).toBe(2);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(mid);
  await end(page, 0);
  await page.clock.runFor(2000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(mid);
  await d
    .getByRole("button", { name: "Listen to directions", exact: true })
    .click();
  await expect.poll(() => count(page)).toBe(3);
  await end(page, 1);
  await page.clock.runFor(1000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(mid);
  await end(page);
  await page.clock.runFor(1000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).not.toEqual(mid);
  await d.screenshot({
    path: `artifacts/pb026/${info.project.name}-guidance.png`,
  });
  expect(f.mutations).toEqual([]);
});
test("PB026 autoplay off still moves, manual replay holds the same prompt, and arrival never mutates a Visit", async ({
  page,
}) => {
  const f = await mapFixture(page, false, false),
    d = f.dialog,
    p = d.getByTestId("simulation-position");
  await d
    .getByLabel("Simulated origin", { exact: true })
    .selectOption("room-P01");
  await page.clock.runFor(6000);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "guidance",
  );
  expect(await count(page)).toBe(0);
  const point = [
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ];
  await d
    .getByRole("button", { name: "Listen to directions", exact: true })
    .click();
  await expect.poll(() => count(page)).toBe(1);
  await page.clock.runFor(6000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(point);
  await end(page);
  await page.clock.runFor(30000);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "arrived",
  );
  expect(await count(page)).toBe(1);
  expect(f.mutations).toEqual([]);
});
for (const mode of ["blocked", "throw", "silent"])
  test(`PB026 ${mode}: speech failure/timeout cannot lock movement and replay recovers`, async ({
    page,
  }) => {
    await page.addInitScript(
      (mode) => Object.assign(window, { routeSpeechMode: mode }),
      mode,
    );
    const f = await mapFixture(page, false),
      d = f.dialog;
    await page.clock.runFor(mode === "silent" ? 15000 : 1000);
    await expect(d.locator(".notice.error")).toBeVisible();
    await expect(d.getByTestId("simulation-status")).toHaveAttribute(
      "data-status",
      "moving",
    );
    await page.evaluate(() =>
      Object.assign(window, { routeSpeechMode: "normal" }),
    );
    await d
      .getByRole("button", { name: "Listen to directions", exact: true })
      .click();
    await expect(d.locator(".notice.error")).toHaveCount(0);
    await end(page);
    expect(f.mutations).toEqual([]);
  });
test("PB026 actual Journey hook preempts motion and route speech resumes only after priority release", async ({
  page,
}) => {
  const f = await mapFixture(page, false),
    d = f.dialog,
    p = d.getByTestId("simulation-position");
  await expect.poll(() => count(page)).toBe(1);
  await end(page);
  await page.clock.runFor(3000);
  await f.announce();
  await page.clock.runFor(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as MockSpeech).pb033.calls.some((u) =>
          u.text.includes("Priority queue call"),
        ),
      ),
    )
    .toBe(true);
  await end(page, -1, true);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "paused",
  );
  const point = [
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ];
  await page.clock.runFor(6000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(point);
  const before = await count(page);
  await end(page);
  await page.clock.runFor(1);
  await expect.poll(() => count(page)).toBe(before + 1);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "guidance",
  );
  await page.clock.runFor(1000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(point);
  await end(page);
  await page.clock.runFor(1000);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "moving",
  );
  expect(f.mutations.filter((path) => !path.endsWith("/narration"))).toEqual(
    [],
  );
});
test("PB026 hidden/foreground, signal recovery, missing destination and close discard prior audio", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const f = await mapFixture(page, false),
    d = f.dialog;
  await expect.poll(() => count(page)).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await end(page, 0);
  await page.clock.runFor(20000);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "paused",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await count(page)).toBe(1);
  await d.getByRole("button", { name: "Start / resume", exact: true }).click();
  await expect.poll(() => count(page)).toBe(2);
  await d.getByRole("button", { name: "Lose signal", exact: true }).click();
  await end(page, 1);
  await d.getByRole("button", { name: "Restore signal", exact: true }).click();
  await page.clock.runFor(5000);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "paused",
  );
  await d.getByRole("button", { name: "Start / resume", exact: true }).click();
  await expect.poll(() => count(page)).toBe(3);
  await f.target("A999");
  await end(page, 2);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "no-route",
  );
  await d.getByLabel("Close", { exact: true }).click();
  await page.clock.runFor(20000);
  expect(errors).toEqual([]);
});

test("PB026 language refresh preserves mid-edge fix while replacing old voice and localized graph labels", async ({
  page,
}) => {
  const f = await mapFixture(page, false),
    d = f.dialog,
    p = d.getByTestId("simulation-position");
  await expect.poll(() => count(page)).toBe(1);
  await end(page);
  await page.clock.runFor(3000);
  const point = [
      await p.getAttribute("data-x"),
      await p.getAttribute("data-y"),
    ],
    session = await p.getAttribute("data-session");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("vi");
  await expect(
    d.getByRole("heading", { name: "Mô phỏng RTLS", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as MockSpeech).pb033.calls.some(
          (u) => u.lang === "vi-VN",
        ),
      ),
    )
    .toBe(true);
  await expect(p).toHaveAttribute("data-session", session!);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(point);
  await end(page, 0);
  await page.clock.runFor(2000);
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(point);
  await end(page);
  await page.clock.runFor(1000);
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "moving",
  );
});
