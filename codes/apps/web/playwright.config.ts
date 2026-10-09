import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '../../.artifacts/playwright-report', open: 'never' }]],
  outputDir: '../../.artifacts/playwright-results',
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'python ../../scripts/serve_test_api.py', url: 'http://127.0.0.1:5049/health', timeout: 60000 },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', env: { VITE_API_BASE_URL: 'http://127.0.0.1:5049' }, timeout: 60000 }
  ]
});
