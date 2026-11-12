import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({
  ...config,
  testIgnore: [],
  testMatch: "registration-v2.spec.ts",
});
