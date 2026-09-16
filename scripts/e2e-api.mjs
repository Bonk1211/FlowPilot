import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Every browser suite gets its own migrated database, never a developer's case data.
mkdirSync(".cache", { recursive: true });
const directory = mkdtempSync(resolve(".cache/e2e-"));
const env = {
  ...process.env,
  FLOWPILOT_REASONING_ENABLED: process.argv.includes("--live") ? "true" : "false",
  FLOWPILOT_DATABASE_URL: `sqlite:///${resolve(directory, "cases.db").replaceAll("\\", "/")}`,
};
for (const args of [
  ["run", "alembic", "-c", "apps/api/alembic.ini", "upgrade", "head"],
  [
    "run",
    "uvicorn",
    "flowpilot.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8100",
  ],
]) {
  const result = spawnSync("uv", args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
