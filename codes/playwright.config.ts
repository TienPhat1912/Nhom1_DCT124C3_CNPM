import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90_000, expect: { timeout: 12_000 }, fullyParallel: false, workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]],
  outputDir: 'artifacts/browser-results',
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:5180', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } }],
});
