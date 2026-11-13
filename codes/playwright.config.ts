import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Prefer the installed Windows browser when Playwright's download is absent.
// CI keeps bundled Chromium; PLAYWRIGHT_CHANNEL can explicitly override this.
const requested = process.env.PLAYWRIGHT_CHANNEL;
const chromeRoots = [
  process.env.ProgramFiles,
  process.env["ProgramFiles(x86)"],
  process.env.LOCALAPPDATA,
].filter(Boolean) as string[];
const installedChannel =
  process.platform === "win32" && !process.env.CI
    ? chromeRoots.some((root) =>
        existsSync(join(root, "Google/Chrome/Application/chrome.exe")),
      )
      ? "chrome"
      : chromeRoots.some((root) =>
            existsSync(join(root, "Microsoft/Edge/Application/msedge.exe")),
          )
        ? "msedge"
        : undefined
    : undefined;
if (requested && !["chrome", "msedge", "chromium"].includes(requested)) {
  throw new Error("PLAYWRIGHT_CHANNEL must be chrome, msedge or chromium.");
}
const channel = requested ?? installedChannel;
const envText = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const port = Number(envText.match(/^WEB_PORT=(\d+)\s*$/m)?.[1] ?? 5180);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid WEB_PORT.");
const localUrl = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: ["registration-v2.spec.ts", "confirm-reception.spec.ts", "clinic-assignment.spec.ts", "doctor-accept.spec.ts"],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
  ],
  outputDir: "artifacts/browser-results",
  use: {
    baseURL: process.env.WEB_URL ?? localUrl,
    channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.WEB_URL
    ? undefined
    : {
        command: `npm run dev --workspace @hospital/web -- --port ${port}`,
        url: localUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], channel },
    },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"], channel } },
  ],
});
