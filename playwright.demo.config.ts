import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig(base, {
  workers: 1,
  projects: [{ name: "chromium", use: { viewport: { width: 1440, height: 900 } } }],
  outputDir: "artifacts/demo/recordings",
  grep: /complete persisted journey with sample log|negative observation requires confirmation/,
  use: {
    video: { mode: "on", size: { width: 1440, height: 900 } },
    viewport: { width: 1440, height: 900 },
    launchOptions: { slowMo: 300 },
  },
});
