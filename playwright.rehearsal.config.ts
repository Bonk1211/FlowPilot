import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  workers: 1,
  retries: 0,
  outputDir: "artifacts/demo/rehearsals",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/demo/rehearsals/results.json" }],
  ],
  grep: /M3 two consecutive|negative observation requires confirmation|complete persisted journey with sample log|recovery requires complete checks|failed mutation|offline/,
  projects: [
    { name: "chromium", use: { viewport: { width: 1440, height: 900 } } },
  ],
  use: {
    ...base.use,
    video: { mode: "on", size: { width: 1440, height: 900 } },
    trace: "on",
  },
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map(
    (server) => ({
      ...server,
      env: { ...server.env, FLOWPILOT_REASONING_TIMEOUT_SECONDS: "12" },
    }),
  ),
});
