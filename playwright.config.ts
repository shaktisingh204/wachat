import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // Seeds the e2e fixture user in Mongo and writes the authenticated
  // storageState consumed by the `sabflow` project (see e2e/global-setup.ts).
  globalSetup: './e2e/global-setup',
  // Reuse a dev server that is already running on :3002 (the common case on
  // the dev box); start one only when nothing is listening there.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    timeout: 180000,
  },
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // sabflow specs run in their own authenticated project below.
      testIgnore: /e2e[\\/]sabflow[\\/]/,
    },
    {
      // Authenticated SabFlow suite — starts with the `session` cookie
      // minted by global-setup for the seeded e2e user.
      name: 'sabflow',
      testMatch: /e2e[\\/]sabflow[\\/].*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/sabflow.json',
      },
    },
  ],
});
