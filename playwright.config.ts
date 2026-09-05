import { defineConfig, devices } from "@playwright/test";

const testPort = 3_100;
const testBaseUrl = `http://localhost:${testPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: testBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-safari",
      testMatch: "recording-actions.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: `env HYDROPOP_NEXT_DIST_DIR=.next-playwright pnpm dev --port ${testPort}`,
    url: `${testBaseUrl}/auth/login`,
    reuseExistingServer: false,
  },
});
