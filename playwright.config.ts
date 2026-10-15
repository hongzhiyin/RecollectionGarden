import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { channel: 'chrome', baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4317', viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run dev -- --port 4317 --strictPort', url: 'http://127.0.0.1:4317',
    reuseExistingServer: true, timeout: 30_000 },
});
