import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Explicit opt-in only: uses the backend's configured key and a fresh test database.
export default defineConfig({
  ...base,
  testDir: "./test/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  outputDir: "artifacts/demo/live-browser",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/demo/live-browser-results.json" }],
  ],
  webServer: [
    {
      command: "node scripts/e2e-api.mjs --live",
      url: "http://127.0.0.1:8100/api/health",
      reuseExistingServer: false,
      env: { FLOWPILOT_REASONING_TIMEOUT_SECONDS: "12" },
    },
    {
      command: "npm run dev --workspace @flowpilot/web -- --port 5174",
      url: "http://127.0.0.1:5174",
      env: { FLOWPILOT_API_URL: "http://127.0.0.1:8100" },
      reuseExistingServer: false,
    },
  ],
});
