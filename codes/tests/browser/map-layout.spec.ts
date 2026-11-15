import { mapFixture } from "../map/fixture";
import { test, expect } from "@playwright/test";
import { hospitalMap, shortestPath, mapUiCopy } from "@hospital/shared";

test("PB033 atlas: campus and all 25 floor plans have explicit frames, doors and complete floor coverage", async ({
  page,
}, info) => {
  // Retain phone/desktop width but fit a complete plan inside the atlas capture.
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 1800,
  });
  const f = await mapFixture(page),
    d = f.dialog;
  await expect(d.getByTestId("map-plan").locator("image")).toHaveCount(0);
  await expect(
    d.getByText(mapUiCopy.en.demo, { exact: true }).first(),
  ).toBeVisible();
  await d.locator(".map-canvas-scroll").evaluate((element: HTMLElement) => {
    element.style.maxHeight = "none";
    element.style.overflow = "visible";
  });
  const entries: Array<{ space: string; rooms: number }> = [];
  await d
    .locator(".map-visual")
    .screenshot({ path: `artifacts/pb033/${info.project.name}-campus.png` });
  for (const space of hospitalMap.spaces!.filter((s) => s.kind === "floor")) {
    await d
      .getByLabel("Displayed building", { exact: true })
      .selectOption(space.building!);
    await d
      .getByLabel("Displayed floor", { exact: true })
      .selectOption(space.floor);
    await expect(d.getByTestId("map-plan")).toHaveAttribute(
      "data-space",
      space.id,
    );
    await expect(d.getByTestId("map-room")).toHaveCount(space.rooms.length);
    await expect(
      d.getByTestId("map-plan").locator("[data-testid^='map-node-room-']"),
    ).toHaveCount(
      space.rooms.filter((r) => r.nodeId.startsWith("room-")).length,
    );
    await expect(
      d.getByTestId("map-plan").locator("[data-testid^='map-node-gate-']"),
    ).toHaveCount(0);
    if (space.entranceOnly)
      await expect(
        d.getByText(mapUiCopy.en.entranceOnly, { exact: true }).first(),
      ).toBeVisible();
    const file = `${info.project.name}-${space.building}-${space.floor}.png`;
    await d
      .locator(".map-visual")
      .screenshot({ path: `artifacts/pb033/${file}` });
    entries.push({ space: space.id, rooms: space.rooms.length });
    expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true,
    );
  }
  await info.attach("floor-coverage", {
    body: JSON.stringify(entries, null, 2),
    contentType: "application/json",
  });
  await d.locator(".map-coverage summary").click();
  await expect(d.locator(".map-coverage")).toContainText("Clinic 66");
  await expect(d.locator(".map-coverage")).toContainText("Room A999");
  await expect(d.locator(".map-coverage")).toContainText(
    "Building/floor unconfirmed",
  );
  expect(f.mutations).toEqual([]);
  expect(f.heartbeats.length).toBeGreaterThan(0);
});

test("PB033 legs, arrows, manual updates and destination replacement invalidate old route/voice without business mutations", async ({
  page,
}, info) => {
  const f = await mapFixture(page),
    d = f.dialog;
  await d.getByTestId("map-node-gate-1").click();
  await d.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(d.getByTestId("map-leg").last()).toHaveAttribute(
    "data-action",
    "arrive",
  );
  await expect(d.locator(".map-route-list > [data-action=arrive]")).toHaveCount(
    1,
  );
  await d
    .getByRole("button", { name: "Listen to directions", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              pb033: { calls: SpeechSynthesisUtterance[] };
            }
          ).pb033.calls.length,
      ),
    )
    .toBe(1);
  await d.getByLabel("Displayed building", { exact: true }).selectOption("A");
  await d.getByLabel("Displayed floor", { exact: true }).selectOption("1");
  await expect(d.getByTestId("map-node-room-A101")).toHaveClass(/is-target/);
  await expect(d.getByTestId("map-route-segment").first()).toHaveAttribute(
    "marker-end",
    /url\(#map-arrow-/,
  );
  await f.target("B201");
  await expect(d.getByTestId("map-leg")).toHaveCount(0);
  await expect(
    d.getByRole("button", { name: "Stop playback", exact: true }),
  ).toHaveCount(0);
  await d.getByTestId("map-node-gate-1").click();
  await d.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(d.getByTestId("map-leg")).toHaveCount(
    shortestPath(hospitalMap, "gate-1", "room-B201")!.legs.length,
  );
  await expect(d.locator("[data-action=elevator]")).toContainText(
    "ground floor to floor 2",
  );
  await d
    .locator("[data-action=elevator]")
    .getByRole("button", { name: "Show leg", exact: true })
    .click();
  await expect(d.getByTestId("map-plan")).toHaveAttribute(
    "data-space",
    "floor:B:2",
  );
  await d
    .getByRole("button", { name: "Listen to directions", exact: true })
    .click();
  await page.evaluate(() => {
    const calls = (
      window as unknown as { pb033: { calls: SpeechSynthesisUtterance[] } }
    ).pb033.calls;
    calls[0].onerror?.call(calls[0], {
      error: "network",
    } as SpeechSynthesisErrorEvent);
  });
  await expect(
    d.getByRole("button", { name: "Stop playback", exact: true }),
  ).toBeVisible();
  await expect(d.locator(".notice.error")).toHaveCount(0);
  await d
    .locator(".map-visual")
    .screenshot({ path: `artifacts/pb033/${info.project.name}-B2-route.png` });
  await d.getByTestId("map-node-room-B202").click();
  await d.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(
    d.locator(
      "[data-action=elevator], [data-action=enter], [data-action=exit]",
    ),
  ).toHaveCount(0);
  await f.target("A999");
  await expect(d.getByTestId("map-status")).toContainText(
    "do not match a mapped location",
  );
  await expect(
    d.getByRole("button", { name: "Find route", exact: true }),
  ).toBeDisabled();
  await expect(d.getByTestId("map-route-segment")).toHaveCount(0);
  expect(f.mutations).toEqual([]);
});
