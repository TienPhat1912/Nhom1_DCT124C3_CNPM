import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  timeout: 30000,
  testIgnore: [],
  testMatch: "web-narration.spec.ts",
});
