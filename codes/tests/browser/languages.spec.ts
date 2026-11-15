import { test, expect } from "@playwright/test";
import {
  languages,
  translator,
  localizeText,
} from "../../packages/shared/src/index";

for (const language of languages) {
  test(`language ${language.code}: labels, persistence, API preference and reception`, async ({
    page,
  }) => {
    let signedIn = false;
    const t = translator(language.code);
    const session = {
      sessionId: "session",
      patientId: "patient",
      role: "Patient",
      name: "Nguyễn Văn A",
      language: language.code,
      isGuest: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      token: null,
      profileComplete: true,
    };
    const requests: string[] = [];
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      const locale =
        url.searchParams.get("language") ??
        route.request().headers()["x-hospital-language"] ??
        "vi";
      requests.push(locale);
      const department = {
        id: "lab",
        code: "LAB",
        mapKey: "lab",
        nameVi: "Xét nghiệm",
        nameEn: "Xét nghiệm",
        name: localizeText("Xét nghiệm", language.code),
        active: true,
        version: 1,
        createdAt: "2026-01-01T00:00:00Z",
        building: "B",
        floors: ["2"],
        locationConfirmed: true,
      };
      let body: unknown = [];
      let status = 200;
      if (url.pathname === "/api/auth/session") {
        status = signedIn ? 200 : 401;
        body = signedIn
          ? session
          : { title: "sessionRequired", detail: "Sign in" };
      } else if (url.pathname === "/api/auth/guest") {
        expect(route.request().postDataJSON().language).toBe(language.code);
        signedIn = true;
        body = session;
      } else if (url.pathname === "/api/auth/profile")
        body = {
          name: session.name,
          contact: "test-contact",
          language: language.code,
          version: 1,
        };
      else if (url.pathname === "/api/v2/presence/heartbeat")
        body = {
          lastSeenAt: new Date().toISOString(),
          heartbeatSeconds: 15,
          ttlSeconds: 60,
        };
      else if (url.pathname === "/api/config")
        body = {
          name: "An Tâm",
          demo: false,
          prdV2Enabled: true,
          departments: [department],
          services: [],
          locations: [],
          emergencyVi: "Trợ giúp",
          emergencyEn: "Trợ giúp",
          form: {},
          guestHours: 24,
          pollSeconds: 5,
        };
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto("/");
    expect(
      await page
        .getByRole("combobox")
        .first()
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["vi", "en", "zh", "ja"]);
    await page.getByRole("combobox").first().selectOption(language.code);
    await expect(
      page.getByRole("heading", { name: t("welcome") }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", language.code);
    await page.reload();
    await expect(page.getByRole("combobox").first()).toHaveValue(language.code);
    await page.getByRole("button", { name: t("guest"), exact: true }).click();
    await expect(
      page.getByRole("button", { name: t("guest"), exact: true }),
    ).toBeHidden();
    const menu = page.getByRole("button", { name: t("menu"), exact: true });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole("button", { name: t("reception"), exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: t("prepare"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(t("noRequests"), { exact: true }),
    ).toBeVisible();
    expect(requests).toContain(language.code);
    await expect(page.getByText(t("appointment"), { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText(t("linkExternal"), { exact: true }),
    ).toHaveCount(0);
    const width = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      screen: window.innerWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.screen + 1);
    await page.screenshot({
      path: `artifacts/pb027-${language.code}-${test.info().project.name}.png`,
      fullPage: true,
      animations: "disabled",
      timeout: 10000,
    });
  });
}

for (const { code } of languages)
  test(`PB027 Entry ${code}: picker and app/web links use the same language`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "userAgent", {
        get: () => "Desktop language fixture",
      }),
    );
    await page.route("**/api/**", (route) =>
      new URL(route.request().url()).pathname === "/api/auth/session"
        ? route.fulfill({
            status: 401,
            json: { status: 401, title: "sessionRequired", detail: "Sign in" },
          })
        : route.fulfill({
            json: {
              name: "Hospital",
              departments: [],
              locations: [],
              services: [],
              form: {},
            },
          }),
    );
    await page.goto(`/entry?language=${code}`);
    const picker = page.getByRole("combobox");
    await expect(picker).toHaveValue(code);
    expect(
      await picker
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["vi", "en", "zh", "ja"]);
    await expect(page.locator('a[href^="hguide:"]')).toHaveAttribute(
      "href",
      `hguide://entry?language=${code}`,
    );
    await expect(page.locator('a[href*="#hospital"]')).toHaveAttribute(
      "href",
      new RegExp(`language=${code}#hospital$`),
    );
    const next = code === "ja" ? "en" : "ja";
    await picker.selectOption(next);
    await page.reload();
    await expect(picker).toHaveValue(next);
    await expect(page.locator('a[href^="hguide:"]')).toHaveAttribute(
      "href",
      `hguide://entry?language=${next}`,
    );
  });

for (const legacy of ["ko", "ru"])
  test(`PB027 saved ${legacy}: clear fallback and language switch preserve history/session`, async ({
    page,
  }) => {
    const mutations: string[] = [];
    await page.addInitScript((language) => {
      localStorage.setItem("hospital.language", language);
      sessionStorage.setItem(
        "hospital.cache:retained",
        "private-history-fixture",
      );
    }, legacy);
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (
        route.request().method() !== "GET" &&
        path !== "/api/v2/presence/heartbeat"
      )
        mutations.push(path);
      const data =
        path === "/api/auth/session"
          ? {
              sessionId: "legacy-session",
              role: "Patient",
              name: "Legacy patient",
              language: legacy,
              isGuest: false,
              expiresAt: "2099-01-01T00:00:00Z",
            }
          : path === "/api/config"
            ? {
                prdV2Enabled: true,
                departments: [],
                locations: [],
                services: [],
                form: {},
                name: "Hospital",
              }
            : path === "/api/visits"
              ? [
                  {
                    id: "same-visit",
                    version: 7,
                    status: "Closed",
                    journeyStatus: "Completed",
                    ticketNumber: "PB027-001",
                    updatedAt: "2026-11-15T00:00:00Z",
                    createdAt: "2026-11-15T00:00:00Z",
                    closedAt: "2026-11-15T00:00:00Z",
                  },
                ]
              : path === "/api/v2/presence/heartbeat"
                ? {
                    lastSeenAt: new Date().toISOString(),
                    heartbeatSeconds: 15,
                    ttlSeconds: 60,
                  }
                : [];
      await route.fulfill({ json: data });
    });
    await page.goto("/");
    await expect(
      page.getByText(translator("vi")("legacyLanguageNotice"), { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("PB027-001", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("hospital.language")),
    ).toBe(legacy);
    await expect(page.getByRole("combobox").first()).toHaveValue("vi");
    await page.getByRole("combobox").first().selectOption("ja");
    await expect(page.getByText("PB027-001", { exact: true })).toBeVisible();
    await expect(
      page.getByText(translator("vi")("legacyLanguageNotice"), { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("hospital.cache:retained"),
      ),
    ).toBe("private-history-fixture");
    expect(mutations).toEqual([]);
  });
