import { test, expect, type Page } from "@playwright/test";
import source from "../../packages/shared/data/hospital-roster.json";
import mapDepartments from "../../packages/shared/data/hospital-departments.json";

const createdAt = "2025-08-01T00:00:00Z";
const departments = mapDepartments.map((d) => ({
  ...d,
  id: d.id,
  mapKey: d.id,
  active: true,
  version: 1,
  createdAt,
  locationConfirmed: !!d.building && !!d.floors.length,
}));
const locations = source.clinics.map((c) => ({
  id: c.id,
  departmentId: c.departmentKey,
  nameVi: c.name,
  nameEn: c.name,
  room: c.room ?? "?",
  building: "?",
  floor: "?",
  active: true,
  version: 1,
  createdAt,
}));
const directory = {
  ...source,
  departments,
  specialties: source.specialties.map((s) => ({
    ...s,
    departmentId: s.departmentKey,
  })),
  clinics: source.clinics.map((c) => ({
    ...c,
    departmentId: c.departmentKey,
    locationConfirmed: false,
    building: "?",
    floor: "?",
  })),
  clinicians: source.clinicians.map((d) => ({
    ...d,
    departmentId: d.departmentKey,
    directoryOnly: true,
  })),
};
const doctors = source.clinicians
  .filter((d) => d.isDoctor)
  .map((d) => ({
    id: d.id,
    name: d.name,
    departments: [d.departmentKey],
    specialties: source.specialties
      .filter((s) => d.specialtyIds.includes(s.id))
      .map((s) => s.name),
    clinicIds: d.clinicIds,
    directoryOnly: true,
  }));
const staff = doctors.map((d) => ({
  ...d,
  departmentIds: d.departments,
  role: "Doctor",
  active: true,
  version: 1,
  createdAt,
  email: "directory-" + d.id + "@example.invalid",
}));
const request = {
  id: "request-1",
  version: 1,
  createdAt,
  status: "Submitted",
  name: "Bệnh nhân kiểm thử",
  contact: "test-contact",
  description: "",
  requests: "",
  messages: [],
  departmentId: "A-outpatients",
  appointmentId: null,
  visitId: null,
};
async function setup(page: Page, role: string) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const values: Record<string, unknown> = {
      "/api/config": {
        name: "Hospital",
        demo: true,
        departments,
        locations,
        services: [],
        guestHours: 24,
        pollSeconds: 5,
        form: {
          nameMin: 2,
          nameMax: 120,
          contactMin: 5,
          contactMax: 80,
          descriptionMax: 2000,
        },
        emergencyVi: "",
        emergencyEn: "",
      },
      "/api/auth/session": {
        sessionId: "catalog-session",
        patientId: role === "Patient" ? "p" : null,
        role,
        name: "Staff test",
        language: "vi",
        isGuest: false,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
      "/api/staff/profile": {
        id: "staff",
        name: "Staff test",
        role,
        departments: departments.filter((d) => d.id === "C-neurosurgery"),
        specialties: ["Ngoại thần kinh"],
        clinics: locations.filter((c) => c.departmentId === "C-neurosurgery"),
      },
      "/api/visits": [],
      "/api/notifications": [],
      "/api/directory": directory,
      "/api/requests": [request],
      "/api/requests/request-1": request,
      "/api/reception/resources": {
        doctors,
        clinics: source.clinics.map((c) => ({
          id: c.id,
          specialty: source.specialties.find((s) => s.id === c.specialtyId)!
            .name,
        })),
        templates: [],
      },
      "/api/admin/configuration": {
        departments,
        locations,
        services: [],
        mappings: [],
        templates: [],
        routes: [],
        staff,
      },
    };
    if (!(path in values))
      return route.fulfill({
        status: 503,
        json: { title: "fixtureUnavailable", detail: "No fixture" },
      });
    await route.fulfill({ json: values[path] });
  });
  await page.goto("/");
}
async function directoryNav(page: Page) {
  const menu = page.getByRole("button", { name: "Danh mục", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Khoa và bác sĩ", exact: true })
    .click();
}
for (const role of ["Patient", "Admin", "Doctor", "Reception"]) {
  test(
    role + " uses the same department and clinician directory",
    async ({ page }, info) => {
      await setup(page, role);
      await directoryNav(page);
      await expect(
        page.getByRole("heading", { name: "Khoa và bác sĩ", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Chọn khoa/phòng").locator("option"),
      ).toHaveCount(51);
      await page
        .getByLabel("Tìm bác sĩ, chuyên khoa hoặc phòng khám")
        .fill("kieu minh rin");
      await expect(page.locator(".directory-card")).toHaveCount(1);
      await expect(page.locator(".directory-card")).toContainText(
        "Kiều Minh Rin",
      );
      await page.getByLabel("Tìm bác sĩ, chuyên khoa hoặc phòng khám").fill("");
      await page.getByLabel("Chọn khoa/phòng").selectOption("C-neurosurgery");
      await expect(page.locator(".directory-card")).toHaveCount(3);
      await expect(
        page.getByTestId("directory-department-location"),
      ).toContainText("Tầng 4");
      await expect(page.locator(".directory-card").first()).toContainText(
        "Cần xác nhận vị trí phòng khám",
      );
      await page.screenshot({
        path: "artifacts/" + info.project.name + "-directory-" + role + ".png",
        fullPage: true,
      });
      await page.getByLabel("Chọn khoa/phòng").selectOption("C-psychiatry");
      await expect(page.locator(".directory-card")).toHaveCount(5);
      await expect(
        page
          .locator(".directory-card")
          .filter({ hasText: "Chuyên viên (CN.)" }),
      ).toHaveCount(3);
      await page.getByLabel("Chọn khoa/phòng").selectOption("E-pathology");
      await expect(page.locator(".directory-card")).toHaveCount(0);
      await expect(
        page.getByTestId("directory-department-location"),
      ).toContainText("cần xác nhận");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        )
        .toBe(true);
    },
  );
}
test("reception filters department, specialty and compatible doctor together", async ({
  page,
}) => {
  await setup(page, "Reception");
  await page.getByRole("button", { name: /Bệnh nhân kiểm thử/ }).click();
  await page
    .getByLabel("Khoa / bộ phận", { exact: true })
    .selectOption("D-paediatrics");
  const loc = page.getByLabel("Địa điểm", { exact: true });
  const doctor = page.getByLabel("Bác sĩ phụ trách", { exact: true });
  for (const clinic of source.clinics.filter(
    (c) => c.departmentKey === "D-paediatrics",
  )) {
    await loc.selectOption(clinic.id);
    const expected = doctors.filter(
      (d) =>
        d.departments.includes("D-paediatrics") &&
        d.clinicIds.includes(clinic.id),
    );
    await expect(doctor.locator("option")).toHaveCount(expected.length);
    expect(expected.map((d) => d.id)).toContain(await doctor.inputValue());
  }
  await page
    .getByLabel("Khoa / bộ phận", { exact: true })
    .selectOption("B-internal");
  await page
    .getByLabel("Chuyên khoa / nhóm phòng khám", { exact: true })
    .selectOption("Hô hấp");
  const expected = source.clinics.filter(
    (c) =>
      c.departmentKey === "B-internal" &&
      source.specialties.find((s) => s.id === c.specialtyId)?.name === "Hô hấp",
  );
  await expect(loc.locator("option")).toHaveCount(expected.length);
  await expect(
    page.getByText("Excel chưa có tòa/tầng của phòng khám này.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("admin searches imported profiles and sees specialties and disabled login", async ({
  page,
}) => {
  await setup(page, "Admin");
  await page
    .getByRole("button", { name: "Nhân viên & quyền", exact: true })
    .click();
  await page.getByLabel("Tìm trong danh mục").fill("Kiều Minh Rin");
  await page.getByRole("button", { name: /Kiều Minh Rin/ }).click();
  await expect(
    page.getByText("Hồ sơ từ Excel, chưa có đăng nhập.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Khoa Ngoại thần kinh", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".split-layout > div.panel")).toContainText(
    "Ngoại thần kinh",
  );
});
