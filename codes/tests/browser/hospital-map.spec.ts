import { test, expect } from "@playwright/test";
import { hospitalMap } from "../../packages/shared/src/hospitalMap";

test("indoor/outdoor selection, ticket destination, route narration, transfers and safe fallbacks", async ({
  page,
}, info) => {
  let destination = {
    id: "location-A101",
    nameVi: "Phòng khám tổng quát",
    nameEn: "Consultation room",
    building: "A",
    floor: "1",
    room: "A101",
  };
  const createdAt = new Date().toISOString();
  const locations = hospitalMap.nodes
    .filter((n) => n.kind === "room")
    .map((n) => ({
      id: `location-${n.room}`,
      version: 1,
      createdAt,
      departmentId: "consult",
      nameVi: n.nameVi,
      nameEn: n.nameEn,
      building: n.building,
      floor: n.floor,
      room: n.room,
      active: true,
    }));
  await page.addInitScript(() => {
    const voice = { texts: [] as string[], cancelled: 0, fail: false };
    Object.assign(window, { mapVoice: voice });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {
          voice.cancelled++;
        },
        getVoices() {
          return [];
        },
        speak(utterance: SpeechSynthesisUtterance) {
          if (voice.fail) throw new Error("unavailable");
          voice.texts.push(utterance.text);
        },
      },
    });
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const summary = {
      id: "map-visit",
      version: 1,
      createdAt,
      patientName: "Bệnh nhân bản đồ",
      ticketNumber: "MAP-001",
      status: "Active",
      journeyStatus: "Active",
      closedAt: null,
      workRevision: 1,
    };
    const data =
      path === "/api/config"
        ? {
            name: "An Tâm",
            demo: true,
            departments: [],
            services: [],
            locations,
            guestHours: 24,
            pollSeconds: 5,
            form: {},
            emergencyVi: "",
            emergencyEn: "",
          }
        : path === "/api/auth/session"
          ? {
              sessionId: "map-session",
              patientId: "patient",
              role: "Patient",
              name: "Bệnh nhân bản đồ",
              language: "vi",
              isGuest: true,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              token: null,
            }
          : path === "/api/visits"
            ? [summary]
            : path === "/api/visits/map-visit"
              ? {
                  ...summary,
                  journeyId: "journey",
                  journeyVersion: 1,
                  currentStepId: "consultation",
                  updatedAt: createdAt,
                  orders: [],
                  steps: [
                    {
                      id: "consultation",
                      version: 1,
                      createdAt,
                      kind: "Consultation",
                      status: "Ready",
                      authority: "Doctor",
                      locationId: destination.id,
                      departmentId: "consult",
                      destination,
                      queueNumber: "001",
                      queueStatus: "Waiting",
                      queueUpdatedAt: createdAt,
                      text: "Đến phòng trên phiếu khám.",
                      contentLanguage: "vi",
                      fallback: false,
                      prerequisites: [],
                    },
                  ],
                }
              : [];
    await route.fulfill({ json: data });
  });
  await page.goto("/#visit=map-visit");
  await page.getByRole("button", { name: "Chỉ đường", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole('button', { name: 'Thủ công', exact: true }).click();
  await expect(dialog.getByText("Bản đồ mẫu", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Tìm đường", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByLabel("Checkpoint gần nhất", { exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByTestId("map-route-segment")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);

  // Outside: select a fixed checkpoint directly on the campus map.
  await dialog.getByTestId("map-node-gate-1").click();
  await expect(
    dialog.getByLabel("1. Vị trí của bạn", { exact: true }),
  ).toHaveValue("outside");
  await expect(
    dialog.getByLabel("2. Lầu đang đứng", { exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByTestId("map-route-segment")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Tìm đường", exact: true }).click();
  await expect(dialog.getByTestId("map-status")).toHaveText(
    "Đường đi ngắn nhất",
  );
  await expect
    .poll(() => dialog.getByTestId("map-route-segment").count())
    .toBeGreaterThan(0);
  await dialog
    .getByRole("button", { name: "Nghe chỉ đường", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & { mapVoice: { texts: string[] } }
        ).mapVoice.texts.at(-1),
      ),
    )
    .toContain("A101");
  await expect(
    dialog.getByRole("button", { name: "Dừng đọc", exact: true }),
  ).toBeVisible();

  // Translating configuration and Visit data must not unmount the map.
  // Keep its selected origin, calculated route, displayed floor and zoom.
  await dialog.getByLabel("Phóng to", { exact: true }).click();
  await dialog.getByLabel("Tòa đang xem", { exact: true }).selectOption("A");
  await dialog.getByLabel("Tầng đang xem", { exact: true }).selectOption("1");
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByLabel("1. Your location", { exact: true }),
  ).toHaveValue("outside");
  await expect(
    dialog.getByLabel("Nearest checkpoint", { exact: true }),
  ).toHaveValue("gate-1");
  await expect(
    dialog.getByLabel("Displayed floor", { exact: true }),
  ).toHaveValue("1");
  await expect(dialog.getByLabel("Fit map", { exact: true })).toHaveText(
    "150%",
  );
  await expect(dialog.getByTestId("map-status")).toHaveText("Shortest route");
  await expect(dialog.getByTestId("map-node-room-A101")).toHaveClass(
    /is-target/,
  );
  await page.getByLabel("Language", { exact: true }).selectOption("vi");
  await expect(dialog.getByTestId("map-status")).toHaveText(
    "Đường đi ngắn nhất",
  );
  await dialog.getByLabel("Vừa khung", { exact: true }).click();
  await dialog
    .getByLabel("Tòa đang xem", { exact: true })
    .selectOption("campus");

  // Changing building/floor clears the route and stops stale narration.
  await dialog
    .getByLabel("1. Vị trí của bạn", { exact: true })
    .selectOption("B");
  await expect(
    dialog.getByRole("button", { name: "Dừng đọc", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByTestId("map-route-segment")).toHaveCount(0);
  await expect(
    dialog.getByLabel("Checkpoint gần nhất", { exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("2. Lầu đang đứng", { exact: true })
    .selectOption("2");
  await expect(
    dialog
      .getByLabel("Checkpoint gần nhất", { exact: true })
      .locator("option[value='room-A101']"),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Checkpoint gần nhất", { exact: true })
    .selectOption("room-B201");
  await dialog.getByRole("button", { name: "Tìm đường", exact: true }).click();
  await expect(
    dialog.getByText("Đi thang máy tòa B từ tầng 2 đến tầng trệt.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByLabel("Phóng to", { exact: true }).click();
  await expect(dialog.getByLabel("Vừa khung", { exact: true })).toHaveText(
    "150%",
  );
  await dialog.getByLabel("Vừa khung", { exact: true }).click();

  // Same room is an arrival, without artificial path segments.
  await dialog
    .getByLabel("1. Vị trí của bạn", { exact: true })
    .selectOption("A");
  await dialog
    .getByLabel("2. Lầu đang đứng", { exact: true })
    .selectOption("1");
  await dialog
    .getByLabel("Checkpoint gần nhất", { exact: true })
    .selectOption("room-A101");
  await dialog.getByRole("button", { name: "Tìm đường", exact: true }).click();
  await expect(dialog.getByTestId("map-status")).toHaveText(
    "Bạn đã ở đúng phòng trên phiếu.",
  );
  await expect(dialog.getByTestId("map-route-segment")).toHaveCount(0);

  destination = {
    ...destination,
    id: "location-B201",
    building: "B",
    floor: "2",
    room: "B201",
    nameVi: "Phòng lấy mẫu",
    nameEn: "Sample collection",
  };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    dialog.getByLabel("1. Vị trí của bạn", { exact: true }),
  ).toHaveValue("");
  await dialog.getByTestId("map-node-gate-1").focus();
  await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Tìm đường", exact: true }).click();
  await expect(
    dialog.getByText("Đi thang máy tòa B từ tầng trệt đến tầng 2.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByLabel("Tòa đang xem", { exact: true }).selectOption("B");
  await dialog.getByLabel("Tầng đang xem", { exact: true }).selectOption("2");
  await expect(dialog.getByTestId("map-node-room-B201")).toHaveClass(
    /is-target/,
  );
  await expect
    .poll(() => dialog.getByTestId("map-route-segment").count())
    .toBeGreaterThan(0);
  await dialog
    .locator(".map-visual")
    .screenshot({ path: `artifacts/${info.project.name}-hospital-map.png` });

  await expect
    .poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    .toBe(true);
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `artifacts/${info.project.name}-hospital-map-screen.png`,
  });
  // Speech failure leaves the written route intact.
  await page.evaluate(() => {
    (window as Window & { mapVoice: { fail: boolean } }).mapVoice.fail = true;
  });
  await dialog
    .getByRole("button", { name: "Nghe chỉ đường", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Không phát được âm thanh",
  );
  await expect(dialog.getByTestId("map-status")).toHaveText(
    "Đường đi ngắn nhất",
  );

  await dialog.getByLabel("Đóng", { exact: true }).click();
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  await page.getByRole('dialog').getByRole('button', {name:'Manual', exact:true}).click();
  await expect(dialog.getByText("Sample map", { exact: true })).toBeVisible();
  await dialog
    .getByLabel("1. Your location", { exact: true })
    .selectOption("outside");
  await dialog
    .getByLabel("Nearest checkpoint", { exact: true })
    .selectOption("gate-2");
  await dialog.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(dialog.getByTestId("map-status")).toHaveText("Shortest route");
  destination = { ...destination, room: "B999" };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(dialog.getByTestId("map-status")).toContainText(
    "do not match a mapped location",
  );
  await expect(dialog.getByTestId("map-route-segment")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Find route", exact: true }),
  ).toBeDisabled();

  // Directory destinations never rewrite the ticket; missing positions have no route.
  await dialog.locator(".map-directory > summary").click();
  await expect(
    dialog
      .getByLabel("Destination department", { exact: true })
      .locator("option"),
  ).toHaveCount(51);
  await dialog.getByLabel("Search departments", { exact: true }).fill("neuro");
  await dialog
    .getByLabel("Destination department", { exact: true })
    .selectOption("C-neurosurgery");
  await dialog
    .getByLabel("1. Your location", { exact: true })
    .selectOption("outside");
  await dialog
    .getByLabel("Nearest checkpoint", { exact: true })
    .selectOption("gate-1");
  await dialog.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(
    dialog.getByText(
      "Take the lift in building C from ground floor to floor 4.",
      { exact: true },
    ),
  ).toBeVisible();
  await dialog
    .getByLabel("Displayed building", { exact: true })
    .selectOption("C");
  await dialog.getByLabel("Displayed floor", { exact: true }).selectOption("4");
  await expect(
    dialog.getByTestId("map-node-department-C-neurosurgery-4"),
  ).toHaveClass(/is-target/);
  await dialog
    .locator(".map-visual")
    .screenshot({ path: `artifacts/${info.project.name}-department-C4.png` });

  await dialog.getByLabel("Search departments", { exact: true }).fill("");
  await dialog
    .getByLabel("Destination department", { exact: true })
    .selectOption("C-pharmacy");
  await dialog
    .getByLabel("1. Your location", { exact: true })
    .selectOption("outside");
  await dialog
    .getByLabel("Nearest checkpoint", { exact: true })
    .selectOption("gate-2");
  await dialog.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(
    dialog.getByText(
      "Take the lift in building C from ground floor to basement.",
      { exact: true },
    ),
  ).toBeVisible();
  await dialog
    .getByLabel("Displayed building", { exact: true })
    .selectOption("C");
  await dialog
    .getByLabel("Displayed floor", { exact: true })
    .selectOption("-1");
  await expect(
    dialog.getByTestId("map-node-department-C-pharmacy--1"),
  ).toHaveClass(/is-target/);

  await dialog
    .getByLabel("Destination department", { exact: true })
    .selectOption("B-internal");
  await expect(dialog.getByTestId("map-status")).toContainText(
    "Choose the department destination floor",
  );
  await dialog
    .getByLabel("Destination floor", { exact: true })
    .selectOption("2");
  await dialog
    .getByLabel("1. Your location", { exact: true })
    .selectOption("B");
  await dialog.getByLabel("2. Your floor", { exact: true }).selectOption("2");
  await dialog
    .getByLabel("Nearest checkpoint", { exact: true })
    .selectOption("department-B-internal-2");
  await dialog.getByRole("button", { name: "Find route", exact: true }).click();
  await expect(dialog.getByTestId("map-status")).toHaveText(
    "You have reached your selected destination.",
  );

  await dialog
    .getByLabel("Destination department", { exact: true })
    .selectOption("E-premium");
  await expect(dialog.getByTestId("map-status")).toContainText(
    "Needs confirmation",
  );
  await expect(dialog.getByTestId("map-route-segment")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Find route", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Destination department", { exact: true })
    .selectOption("unlocated-dermatology");
  await expect(dialog.getByTestId("map-status")).toContainText(
    "Needs confirmation",
  );
  await dialog
    .getByLabel("Destination department", { exact: true })
    .selectOption("");
  await expect(dialog.getByTestId("map-status")).toContainText(
    "do not match a mapped location",
  );
});
