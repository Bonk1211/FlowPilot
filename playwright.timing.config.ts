import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Local browser timing for the incident flow under dev:mock settings; not a production benchmark.
export default defineConfig({
  ...base,
  testDir: "./test/timing",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "artifacts/demo/timing",
  reporter: [["list"]],
  projects: [
    { name: "chromium", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map(
    (server) => ({
      ...server,
      env: {
        ...server.env,
        FLOWPILOT_INCIDENT_AUTH_MODE: "demo",
        FLOWPILOT_INCIDENT_AUTO_PROCESS: "true",
        FLOWPILOT_REASONING_ENABLED: "false",
        FLOWPILOT_INCIDENT_JEV_ENABLED: "false",
      },
    }),
  ),
});
