import { test, expect, type Page } from "@playwright/test";
import {
  mapDepartments,
  mappedJourneyRooms,
  hospitalMap,
  shortestPath,
  mapUiCopy,
} from "@hospital/shared";

async function fixture(page: Page) {
  let destination = { ...mappedJourneyRooms[0] };
  let version = 1;
  const mutations: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("hospital.language", "en");
    const calls: SpeechSynthesisUtterance[] = [];
    Object.assign(window, { pb033: { calls, cancels: 0 } });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {
          (window as unknown as { pb033: { cancels: number } }).pb033.cancels++;
        },
        getVoices() {
          return [{ lang: "en-US" }, { lang: "vi-VN" }];
        },
        speak(u: SpeechSynthesisUtterance) {
          calls.push(u);
        },
      },
    });
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") mutations.push(path);
    const visit = {
      id: "map-layout",
      version,
      ticketNumber: "PB033-007",
      status: "Active",
      journeyStatus: "Active",
      currentStepId: destination.id,
      updatedAt: "2026-11-15T00:00:00Z",
      steps: [
        {
          id: destination.id,
          kind: "Consultation",
          status: "Ready",
          queueStatus: "Waiting",
          destination,
        },
      ],
      orders: [],
    };
    const data =
      path === "/api/config"
        ? {
            name: "Map demo",
            catalogVersion: "pb033",
            departments: mapDepartments.map((d) => ({ ...d, active: true })),
            services: [],
            locations: [
              ...mappedJourneyRooms.map((r) => ({
                ...r,
                nameVi: r.nameVi,
                active: true,
              })),
              {
                id: "unconfirmed-clinic",
                nameVi: "Clinic 66",
                building: "?",
                floor: "?",
                room: "66",
                active: true,
              },
              {
                id: "unmapped-room",
                nameVi: "Room A999",
                building: "A",
                floor: "1",
                room: "A999",
                active: true,
              },
            ],
            form: {},
          }
        : path === "/api/auth/session"
          ? {
              sessionId: "pb033-session",
              role: "Patient",
              patientId: "patient",
              name: "Map Patient",
              isGuest: true,
              expiresAt: "2099-01-01T00:00:00Z",
            }
          : path === "/api/visits"
            ? [visit]
            : path === "/api/visits/map-layout"
              ? visit
              : [];
    await route.fulfill({ json: data });
  });
  await page.goto("/#visit=map-layout");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("map-plan")).toHaveAttribute(
    "data-space",
    "campus",
  );
  return {
    dialog,
    mutations,
    async target(room: string) {
      destination = {
        ...destination,
        ...(mappedJourneyRooms.find((r) => r.room === room) ?? {
          id: room,
          room,
          building: "A",
          floor: "1",
        }),
      };
      version++;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(dialog.locator(".map-destination")).toContainText(room);
    },
  };
}

test("PB033 atlas: campus and all 25 floor plans have explicit frames, doors and complete floor coverage", async ({
  page,
}, info) => {
  // Retain phone/desktop width but fit a complete plan inside the atlas capture.
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 1800,
  });
  const f = await fixture(page),
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
});

test("PB033 legs, arrows, manual updates and destination replacement invalidate old route/voice without business mutations", async ({
  page,
}, info) => {
  const f = await fixture(page),
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
