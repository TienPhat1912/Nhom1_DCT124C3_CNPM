import { test, expect } from "@playwright/test";
import {
  languages,
  translator,
  localizeText,
} from "../../packages/shared/src/index";

for (const language of languages.filter((l) =>
  ["zh", "ko", "ja", "ru"].includes(l.code),
)) {
  test(`language ${language.code}: labels, persistence, API preference and localized directory`, async ({
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
      expiresAt: "2030-01-01T00:00:00Z",
      token: null,
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
      } else if (url.pathname === "/api/config")
        body = {
          name: "An Tâm",
          demo: false,
          departments: [department],
          services: [],
          locations: [],
          emergencyVi: "Trợ giúp",
          emergencyEn: "Trợ giúp",
          form: {},
          guestHours: 24,
          pollSeconds: 5,
        };
      else if (url.pathname === "/api/directory")
        body = {
          version: "test",
          source: {},
          departments: [department],
          specialties: [],
          clinics: [],
          clinicians: [],
          warnings: [],
        };
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto("/");
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
      .getByRole("button", { name: t("directory"), exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("option", {
        name: localizeText("Xét nghiệm", language.code),
        exact: true,
      }),
    ).toBeAttached();
    expect(requests).toContain(language.code);
    const width = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      screen: window.innerWidth,
    }));
    expect(width.content).toBeLessThanOrEqual(width.screen + 1);
  });
}
