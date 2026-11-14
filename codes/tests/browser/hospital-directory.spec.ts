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
for (const role of [
  "Patient",
  "Admin",
  "Doctor",
  "Reception",
  "Service",
  "Cashier",
]) {
  test(
    role + " has no department and clinician directory navigation",
    async ({ page }) => {
      const directoryRequests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/api/directory")
          directoryRequests.push(request.url());
      });
      await setup(page, role);
      await expect(page.locator(".app-shell")).toBeVisible();
      const menu = page.getByRole("button", { name: /^(Danh mục|Menu)$/ });
      if (await menu.isVisible()) await menu.click();
      await expect(
        page.getByRole("button", { name: "Khoa và bác sĩ", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Khoa và bác sĩ", exact: true }),
      ).toHaveCount(0);
      if (await menu.isVisible()) await menu.click();
      await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
      if (await menu.isVisible()) await menu.click();
      await expect(
        page.getByRole("button", {
          name: "Departments and doctors",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(directoryRequests).toEqual([]);
    },
  );
}

test("reception submits the selected department and clinic without choosing a doctor", async ({
  page,
}) => {
  await setup(page, "Reception");
  await page.getByRole("button", { name: /Bệnh nhân kiểm thử/ }).click();
  await expect(
    page.getByLabel("Bác sĩ phụ trách", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Khoa / bộ phận", { exact: true })
    .selectOption("D-paediatrics");
  const receptionForm = page.getByRole("group").filter({
    has: page.getByLabel("Khoa / bộ phận", { exact: true }),
  });
  const loc = receptionForm.getByLabel("Địa điểm", { exact: true });
  const confirm = page.getByRole("button", {
    name: "Xác nhận tiếp nhận & cấp phiếu",
    exact: true,
  });
  for (const clinic of source.clinics.filter(
    (c) => c.departmentKey === "D-paediatrics",
  )) {
    await loc.selectOption(clinic.id);
    await expect(confirm).toBeEnabled();
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
  const selectedLocation = await loc.inputValue();
  let confirmation: Record<string, unknown> | undefined;
  await page.route("**/api/requests/request-1/confirm", async (route) => {
    confirmation = route.request().postDataJSON();
    await route.fulfill({ json: { visitId: "new-visit" } });
  });
  await page
    .getByLabel("Ghi nhận xác minh", { exact: true })
    .fill("Verified test attendee");
  await page
    .getByLabel("Đã kiểm tra trực tiếp người đến khám", { exact: true })
    .check();
  await confirm.click();
  await expect
    .poll(() => confirmation)
    .toEqual({
      version: 1,
      departmentId: "B-internal",
      locationId: selectedLocation,
      attendeeVerified: true,
      verificationNote: "Verified test attendee",
    });
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
