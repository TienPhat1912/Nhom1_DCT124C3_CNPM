import { test, expect } from "@playwright/test";
import { mapFixture } from "../map/fixture";
import { hospitalMap, shortestPath } from "@hospital/shared";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-16T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-16T00:00:01Z"));
});

test("PB034 default simulation, smooth marker, minimum dwell, pause, signal and reset without business writes", async ({
  page,
}, info) => {
  const f = await mapFixture(page, false, false),
    d = f.dialog,
    p = d.getByTestId("simulation-position"),
    marker = d.getByTestId("simulation-marker");
  await expect(
    d.getByText("RTLS simulation", { exact: true }).last(),
  ).toBeVisible();
  await d
    .getByLabel("Simulated origin", { exact: true })
    .selectOption("room-P01");
  const session = await p.getAttribute("data-session"),
    initial = await marker.getAttribute("transform");
  await d.getByRole("button", { name: "Start / resume", exact: true }).click();
  await page.clock.runFor(999);
  await expect(marker).toHaveAttribute("transform", initial!);
  await page.clock.runFor(2501);
  await expect(marker).not.toHaveAttribute("transform", initial!);
  await d.getByRole("button", { name: "Pause", exact: true }).click();
  const frozen = await marker.getAttribute("transform");
  await page.clock.runFor(12000);
  await expect(marker).toHaveAttribute("transform", frozen!);
  await d.getByRole("button", { name: "Lose signal", exact: true }).click();
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "lost",
  );
  await d.getByRole("button", { name: "Restore signal", exact: true }).click();
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "paused",
  );
  await page.clock.runFor(12000);
  await expect(marker).toHaveAttribute("transform", frozen!);
  await d
    .getByRole("button", { name: "Try stale signal", exact: true })
    .click();
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "stale",
  );
  await d
    .getByRole("button", { name: "Reset simulation", exact: true })
    .click();
  await expect(p).toHaveAttribute("data-space", "campus");
  await expect(p).not.toHaveAttribute("data-session", session!);
  await d.getByRole("button", { name: "Try deviation", exact: true }).click();
  await expect(d.getByLabel("Simulated origin", { exact: true })).toHaveValue(
    "gate-2",
  );
  await d.screenshot({
    path: `artifacts/pb034/${info.project.name}-controls.png`,
  });
  expect(f.mutations).toEqual([]);
});

test("PB034 same-floor, cross-floor and cross-building simulation follows every frame and arrives only after final hold", async ({
  page,
}, info) => {
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 1800,
  });
  const f = await mapFixture(page, false, false),
    d = f.dialog;
  for (const origin of ["room-P01", "lobby-a", "room-B201"]) {
    await d
      .getByLabel("Simulated origin", { exact: true })
      .selectOption(origin);
    const route = shortestPath(hospitalMap, origin, "room-A101")!;
    for (const leg of route.legs) {
      await expect(d.getByTestId("simulation-marker")).toHaveAttribute(
        "data-space",
        leg.fromSpace,
      );
      await page.clock.runFor(999);
      await expect(d.getByTestId("simulation-status")).toHaveAttribute(
        "data-status",
        "guidance",
      );
      await page.clock.runFor(1);
      if (leg.action === "arrive") break;
      if (leg.transition) {
        await page.clock.runFor(2500);
        await expect(d.getByTestId("simulation-marker")).toHaveAttribute(
          "data-space",
          leg.fromSpace,
        );
        await page.clock.runFor(2500);
      } else await page.clock.runFor(5000);
      await expect(d.getByTestId("simulation-marker")).toHaveAttribute(
        "data-space",
        leg.toSpace,
      );
      if (leg.transition)
        await d.getByTestId("map-plan").screenshot({
          path: `artifacts/pb034/${info.project.name}-${origin}-${route.legs.indexOf(leg)}-transition.png`,
        });
    }
    await expect(d.getByTestId("simulation-status")).toHaveAttribute(
      "data-status",
      "arrived",
    );
    await d.getByTestId("map-plan").screenshot({
      path: `artifacts/pb034/${info.project.name}-${origin}-arrived.png`,
    });
  }
  expect(f.mutations).toEqual([]);
});

test("PB034 retarget between edges, hidden/foreground and closing map invalidate old progress; manual mode independent", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const f = await mapFixture(page, false, false),
    d = f.dialog,
    p = d.getByTestId("simulation-position");
  await d.getByRole("button", { name: "Start / resume", exact: true }).click();
  await page.clock.runFor(3500);
  const before = [
      await p.getAttribute("data-x"),
      await p.getAttribute("data-y"),
    ],
    session = await p.getAttribute("data-session");
  await f.target("B201");
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(before);
  await expect(p).toHaveAttribute("data-session", session!);
  await d.getByRole("button", { name: "Start / resume", exact: true }).click();
  await page.clock.runFor(1500);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "paused",
  );
  const frozen = [
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ];
  await page.clock.runFor(30000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect([
    await p.getAttribute("data-x"),
    await p.getAttribute("data-y"),
  ]).toEqual(frozen);
  await d.getByRole("button", { name: "Manual", exact: true }).click();
  await expect(d.getByTestId("simulation-panel")).toHaveCount(0);
  await page.clock.runFor(10000);
  await d.getByRole("button", { name: "RTLS simulation", exact: true }).click();
  await expect(p).toHaveAttribute("data-space", "campus");
  await expect(p).not.toHaveAttribute("data-session", session!);
  await f.target("A999");
  await expect(d.getByTestId("simulation-status")).toHaveAttribute(
    "data-status",
    "no-route",
  );
  await expect(
    d.getByRole("button", { name: "Start / resume", exact: true }),
  ).toBeDisabled();
  await d.getByLabel("Close", { exact: true }).click();
  await page.clock.runFor(10000);
  await expect(page.getByTestId("simulation-panel")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(f.mutations).toEqual([]);
});
