import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Review identifiers cover public contracts, canonical fixtures, and their behavior.
// Normalize line endings so Windows checkout settings do not change the candidate.
const paths = [
  "apps/api/src/flowpilot/investigations/models.py",
  "apps/api/src/flowpilot/diagnosis/models.py",
  "apps/api/src/flowpilot/diagnosis/reasoning.py",
  "apps/api/src/flowpilot/procedures/models.py",
  "apps/api/src/flowpilot/golden.py",
  "apps/api/src/flowpilot/cases.py",
  "apps/web/src/prototype/model.ts",
  "fixtures/v1/golden-scenario.json",
  "fixtures/v1/scoring-rules.json",
  "fixtures/v1/evidence-units.json",
  "packages/contracts/openapi.json",
  "packages/contracts/src/generated.ts",
  "packages/contracts/src/index.ts",
].sort();
const hash = (text) => createHash("sha256").update(text).digest("hex");
const files = Object.fromEntries(
  paths.map((path) => [
    path,
    hash(readFileSync(path, "utf8").replaceAll("\r\n", "\n")),
  ]),
);
const candidate = {
  base_commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  candidate_sha256: hash(JSON.stringify(files)),
  files,
};
const path = "docs/contract-review-candidate.json";
if (process.argv.includes("--check")) {
  const recorded = JSON.parse(readFileSync(path, "utf8"));
  if (recorded.candidate_sha256 !== candidate.candidate_sha256) {
    throw new Error(
      "Contract review candidate changed. Regenerate and obtain review of the new candidate.",
    );
  }
  console.log(
    `Contract review candidate unchanged: ${candidate.candidate_sha256}`,
  );
} else {
  writeFileSync(path, JSON.stringify(candidate, null, 2) + "\n");
  console.log(
    `Prepared review candidate ${candidate.candidate_sha256}; this does not record acceptance.`,
  );
}
