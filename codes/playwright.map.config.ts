import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// Isolated source server: map tests must not reuse an older Docker web build.
const port = Number(process.env.MAP_TEST_PORT ?? 5189);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid MAP_TEST_PORT.");
const url = `http://127.0.0.1:${port}`;
export default defineConfig({
  ...config,
  testMatch: "hospital-map.spec.ts",
  use: { ...config.use, baseURL: url },
  webServer: {
    command: `npm run dev --workspace @hospital/web -- --port ${port}`,
    url,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
