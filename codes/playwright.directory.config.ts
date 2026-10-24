import { defineConfig } from "@playwright/test";
import config from "./playwright.map.config";
export default defineConfig({
  ...config,
  testMatch: "hospital-directory.spec.ts",
});
