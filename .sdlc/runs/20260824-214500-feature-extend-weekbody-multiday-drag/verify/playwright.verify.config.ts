import { defineConfig, devices } from "@playwright/test";

const REPO = "/home/sainadh/projects/compass-calendar/compass/compass-calendar";
const TEST_PORT = 9150;

export default defineConfig({
  testDir: __dirname,
  timeout: 90_000,
  retries: 0,
  workers: 1,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: `${__dirname}/artifacts`,
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: "off",
    screenshot: "off",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: {
          cookies: [],
          origins: [
            {
              origin: `http://localhost:${TEST_PORT}`,
              localStorage: [
                { name: "compass.onboarding.has-seen-welcome", value: "true" },
              ],
            },
          ],
        },
      },
    },
  ],
  webServer: {
    command: "cd packages/web && bun run dev.ts",
    cwd: REPO,
    env: { COMPASS_CONFIG_FILE: `${REPO}/e2e/compass.playwright.yaml` },
    port: TEST_PORT,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
