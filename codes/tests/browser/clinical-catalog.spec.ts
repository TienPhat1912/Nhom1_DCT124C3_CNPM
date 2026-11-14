import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type {
  ClinicalCatalogPageV2,
  ClinicalCatalogEntryV2,
  Session,
} from "@hospital/shared";
const base = process.env.API_URL!,
  password = process.env.DEMO_PASSWORD!;
async function api<T>(
  path: string,
  token?: string | null,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      "Idempotency-Key": randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  expect(response.ok, `${path}: ${response.status}`).toBeTruthy();
  return response.json();
}
test("Admin creates, edits and retires four catalogs; handles stale edits and labels demo data", async ({
  page,
  context,
  baseURL,
}, info) => {
  const login = (name: string) =>
    api<Session>("/api/auth/login", null, {
      email: `${name}@demo.local`,
      password,
    });
  const admin = await login("admin"),
    doctor = await login("doctor");
  await context.addCookies([
    {
      name: "hospital_session",
      value: admin.token!,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.addInitScript(() =>
    localStorage.setItem("hospital.language", "en"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Clinical catalog", exact: true })
    .click();
  const catalog = page.getByTestId("clinical-catalog"),
    editor = page.getByTestId("clinical-catalog-editor");
  const created: {
    kind: string;
    code: string;
    item: ClinicalCatalogEntryV2;
  }[] = [];
  for (const [kind, title] of [
    ["symptoms", "Symptoms"],
    ["signs", "Signs"],
    ["diagnoses", "Diagnoses"],
    ["templates", "Vietnamese result templates"],
  ]) {
    await catalog.getByRole("button", { name: title, exact: true }).click();
    const code = "PB013WEB_" + randomUUID().slice(0, 8).toUpperCase();
    await catalog
      .getByRole("button", { name: "Create new", exact: true })
      .click();
    await editor.getByLabel("Code", { exact: true }).fill(code);
    await editor
      .getByLabel("Vietnamese name", { exact: true })
      .fill(`Nội dung tổng hợp ${code}`);
    await editor.getByLabel("Enabled", { exact: true }).check();
    if (kind === "templates") {
      await editor
        .getByLabel("Diagnosis summary (vi)", { exact: true })
        .fill("Chẩn đoán: {{diagnoses}}");
      await editor
        .getByLabel("Doctor’s explanation (vi)", { exact: true })
        .fill("{{unknown}}");
      await editor
        .getByLabel("Care instructions (vi)", { exact: true })
        .fill("Hướng dẫn tổng hợp");
      await editor
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(editor.getByRole("alert")).toBeVisible();
      await editor
        .getByLabel("Doctor’s explanation (vi)", { exact: true })
        .fill("{{symptoms}}; {{signs}}");
    }
    await editor
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    const row = catalog.locator("button.record-row").filter({ hasText: code });
    // Use a search to avoid unrelated fixture pages influencing the browser suite.
    await catalog
      .getByLabel("Search by code or name", { exact: true })
      .fill(code);
    await expect(row).toBeVisible();
    const available = await api<ClinicalCatalogPageV2>(
      `/api/v2/clinical-catalog/${kind}?search=${code}`,
      doctor.token,
    );
    expect(available.items).toHaveLength(1);
    await row.click();
    await expect(editor.getByLabel("Code", { exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
    await editor
      .getByLabel("Vietnamese name", { exact: true })
      .fill(`Ngừng dùng ${code}`);
    await editor.getByLabel("Enabled", { exact: true }).uncheck();
    if (process.env.PB013_CAPTURE === "1" && kind === "templates")
      await editor.screenshot({
        path: `artifacts/${info.project.name}-pb013-template.png`,
        animations: "disabled",
      });
    await editor
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(row).toContainText("Inactive");
    expect(
      (
        await api<ClinicalCatalogPageV2>(
          `/api/v2/clinical-catalog/${kind}?search=${code}`,
          doctor.token,
        )
      ).items,
    ).toHaveLength(0);
    const saved = (
      await api<ClinicalCatalogPageV2>(
        `/api/v2/admin/clinical-catalog/${kind}?search=${code}`,
        admin.token,
      )
    ).items[0];
    created.push({ kind, code, item: saved as ClinicalCatalogEntryV2 });
  }
  await page.reload();
  await page
    .getByRole("button", { name: "Clinical catalog", exact: true })
    .click();
  await catalog
    .getByLabel("Search by code or name", { exact: true })
    .fill("DEMO_SYMPTOM_01");
  await catalog
    .locator("button.record-row")
    .filter({ hasText: "DEMO_SYMPTOM_01" })
    .click();
  await expect(editor).toContainText("has not been approved by the hospital");
  const original = created[0].item;
  await catalog
    .getByLabel("Search by code or name", { exact: true })
    .fill(original.code);
  await catalog
    .locator("button.record-row")
    .filter({ hasText: original.code })
    .click();
  await api(
    `/api/v2/admin/clinical-catalog/symptoms/${original.id}`,
    admin.token,
    {
      version: original.version,
      code: original.code,
      nameVi: "Mục mới từ phiên khác",
      active: true,
    },
    "PUT",
  );
  await editor
    .getByLabel("Vietnamese name", { exact: true })
    .fill("Không ghi đè phiên mới");
  await editor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await editor.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    editor.getByLabel("Vietnamese name", { exact: true }),
  ).toHaveValue("Mục mới từ phiên khác");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await catalog
    .getByRole("button", { name: "Create new", exact: true })
    .click();
  const cancelled = "PB013CANCEL_" + randomUUID().slice(0, 8).toUpperCase();
  await editor.getByLabel("Code", { exact: true }).fill(cancelled);
  await editor
    .getByLabel("Vietnamese name", { exact: true })
    .fill("Bản cấu hình hủy trước lưu");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (
      await api<ClinicalCatalogPageV2>(
        `/api/v2/admin/clinical-catalog/symptoms?search=${cancelled}`,
        admin.token,
      )
    ).items,
  ).toHaveLength(0);
  await catalog
    .getByLabel("Search by code or name", { exact: true })
    .fill(original.code);
  await expect(catalog.locator("button.record-row")).toContainText(
    "Mục mới từ phiên khác",
  );
  if (process.env.PB013_CAPTURE === "1")
    await page.screenshot({
      path: `artifacts/${info.project.name}-pb013-catalog.png`,
      animations: "disabled",
    });
});
