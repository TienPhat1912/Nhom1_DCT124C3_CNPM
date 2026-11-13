import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  testIgnore: [],
  testMatch: "clinic-assignment.spec.ts",
  outputDir: "artifacts/pb005-browser-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/pb005-playwright-report", open: "never" }],
  ],
});
