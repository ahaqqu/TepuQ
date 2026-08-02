import { defineConfig, devices } from '@playwright/test';

// Allow multiple agents/worktrees to run E2E tests concurrently on the same machine
// by picking a unique preview port via TEPUQ_E2E_PORT. When the test runner is
// invoked via scripts/run-e2e.js the preview server is already started on a
// free port and TEPUQ_E2E_NO_WEBSERVER is set, so Playwright does not spawn its own.
const NO_WEBSERVER = process.env.TEPUQ_E2E_NO_WEBSERVER === 'true';
const E2E_PORT = Number(process.env.TEPUQ_E2E_PORT) || 4173;
const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: NO_WEBSERVER
    ? undefined
    : {
        command: `bun run preview --port ${E2E_PORT}`,
        url: E2E_BASE_URL,
        reuseExistingServer: !process.env.CI,
      },
});
