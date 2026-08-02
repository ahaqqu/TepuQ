import { defineConfig, devices } from '@playwright/test';

// Allow multiple agents/worktrees to run E2E tests concurrently on the same machine
// by picking a unique preview port via TEPUQ_E2E_PORT.
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
  webServer: {
    command: `bun run preview --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
