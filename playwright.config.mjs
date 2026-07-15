import { defineConfig } from "@playwright/test";
import { assertSafeTestDatabaseUrl } from "./src/server/test-database-guard.mjs";

const CI = Boolean(process.env.CI);
const testDatabaseUrl = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL ?? "postgresql:///rego_test");
process.env.TEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [["line"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{platform}{ext}",
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.03 },
  },
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "npm run db:migrate && npm run dev -- --hostname 127.0.0.1 --port 3107",
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      NEXT_PUBLIC_SHOW_INTERNAL_DEMOS: "true",
    },
    url: "http://127.0.0.1:3107",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});