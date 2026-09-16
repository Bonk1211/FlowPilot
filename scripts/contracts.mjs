import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const result = spawnSync(
  "uv",
  ["run", "python", "-m", "flowpilot.export_contracts"],
  { encoding: "utf8", shell: false },
);
if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? result.stderr);
  process.exit(1);
}
const schema = JSON.parse(result.stdout);
const outputs = new Map([
  ["packages/contracts/openapi.json", JSON.stringify(schema, null, 2) + "\n"],
  ["packages/contracts/src/generated.ts", astToString(await openapiTS(schema))],
]);
for (const [path, content] of outputs) {
  if (process.argv.includes("--check")) {
    const existing = await readFile(path, "utf8").catch(() => "");
    if (existing.replaceAll("\r\n", "\n") !== content) {
      console.error(`Contract drift: ${path}. Run npm run contracts:generate.`);
      process.exitCode = 1;
    }
  } else {
    await writeFile(path, content);
    console.log(`Generated ${path}`);
  }
}
