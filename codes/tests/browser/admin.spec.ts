import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AdminDashboardData } from "@hospital/shared";

const password =
  process.env.DEMO_PASSWORD ??
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEMO_PASSWORD="))!
    .slice("DEMO_PASSWORD=".length);

test("admin dashboard shows live statistics, filters, configuration links and recoverable errors", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("admin@demo.local");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/dashboard?days=7") && r.status() === 200,
    ),
    page.getByRole("button", { name: "Đăng nhập", exact: true }).last().click(),
  ]);
  const data = (await response.json()) as AdminDashboardData;
  await expect(
    page.getByRole("heading", { name: "Tổng quan hoạt động", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("metric-visitsToday")).toHaveText(
    data.summary.visitsToday.toLocaleString("vi-VN"),
  );
  await expect(page.getByTestId("metric-activeVisits")).toHaveText(
    data.summary.activeVisits.toLocaleString("vi-VN"),
  );
  await expect(page.locator(".dashboard-chart-day")).toHaveCount(7);
  await page.locator(".dashboard-chart-day").first().click();
  await expect(page.locator(".dashboard-chart-day").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByLabel("Khoảng thời gian thống kê", { exact: true })
    .selectOption("30");
  await expect(page.locator(".dashboard-chart-day")).toHaveCount(30);
  const search = page.getByLabel("Tìm khoa", { exact: true });
  await search.fill("no matching department 123");
  await expect(
    page.getByText("Không có khoa phù hợp để hiển thị.", { exact: true }),
  ).toBeVisible();
  await search.fill("");
  await expect(page.locator(".dashboard-table tbody tr")).toHaveCount(
    data.departments.length,
  );

  await page.getByRole("button", { name: /Nhân viên hoạt động/ }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Quản trị bệnh viện" })
      .getByRole("button", { name: "Nhân viên & quyền", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("button", { name: "Tạo mới", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await expect(page.getByTestId("metric-visitsToday")).toBeVisible();
  await page.getByLabel("Ngôn ngữ", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Operations overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Reporting period", { exact: true }),
  ).toBeVisible();

  await page.route("**/api/admin/dashboard?*", (route) =>
    route.abort("failed"),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("metric-visitsToday")).toBeVisible();
  await page.unroute("**/api/admin/dashboard?*");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: `artifacts/${info.project.name}-admin-dashboard.png`,
    fullPage: true,
  });
  await page.getByText("Public hospital entry QR", { exact: true }).click();
  await expect(page.getByRole("link", { name: /\/entry$/ })).toBeVisible();
});
