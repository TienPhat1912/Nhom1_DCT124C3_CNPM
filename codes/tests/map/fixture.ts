import { expect, type Page } from "@playwright/test";
import { mapDepartments, mappedJourneyRooms } from "@hospital/shared";
export async function mapFixture(page: Page, manual = true, autoplay = true) {
  let destination = { ...mappedJourneyRooms[0] };
  let version = 1;
  let announcing = false;
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
          const mode = (window as unknown as { routeSpeechMode?: string })
            .routeSpeechMode;
          if (mode === "throw") throw new Error("blocked");
          if (mode === "blocked")
            u.onerror?.call(u, {
              error: "not-allowed",
            } as SpeechSynthesisErrorEvent);
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
          templateVersion: announcing ? 1 : undefined,
          text: announcing ? "Priority queue call" : undefined,
          contentLanguage: "en",
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
            departments: mapDepartments.map((d) => ({
              ...d,
              name:
                new URL(route.request().url()).searchParams.get("language") ===
                "vi"
                  ? d.nameVi
                  : d.nameEn,
              active: true,
            })),
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
            : path === "/api/visits/map-layout/narration"
              ? { text: "Priority queue call", language: "en", revision: 1 }
              : path === "/api/visits/map-layout"
                ? visit
                : [];
    await route.fulfill({ json: data });
  });
  await page.goto("/#visit=map-layout");
  if (manual || !autoplay)
    await page
      .getByRole("checkbox", {
        name: "Automatically read instructions and queue calls",
        exact: true,
      })
      .uncheck();
  await page.getByRole("button", { name: "Directions", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (manual)
    await dialog.getByRole("button", { name: "Manual", exact: true }).click();
  await expect(dialog.getByTestId("map-plan")).toHaveAttribute(
    "data-space",
    "campus",
  );
  if (!manual && !autoplay)
    await dialog
      .getByRole("checkbox", {
        name: "Automatically read directions",
        exact: true,
      })
      .uncheck();
  return {
    dialog,
    mutations,
    async announce() {
      announcing = true;
      version++;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(
        page.getByRole("button", { name: "Listen", exact: true }),
      ).toBeEnabled();
    },
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
      if (manual)
        await expect(dialog.locator(".map-destination")).toContainText(room);
      else
        await expect(dialog.getByTestId("simulation-panel")).toHaveAttribute(
          "data-target",
          mappedJourneyRooms.find((r) => r.room === room)?.id ?? "",
        );
    },
  };
}
