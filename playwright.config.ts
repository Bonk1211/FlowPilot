import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "uv run uvicorn flowpilot.main:app --host 127.0.0.1 --port 8100",
      url: "http://127.0.0.1:8100/api/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev --workspace @flowpilot/web -- --port 5174",
      url: "http://127.0.0.1:5174",
      env: { FLOWPILOT_API_URL: "http://127.0.0.1:8100" },
      reuseExistingServer: false,
    },
  ],
});
