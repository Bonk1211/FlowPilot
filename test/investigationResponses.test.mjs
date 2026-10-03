import test from "node:test";
import assert from "node:assert/strict";
import { responseStatement } from "../apps/web/src/incidents/investigationResponses.ts";

test("recorded statements preserve opposing answers, uncertainty and confirmation state", () => {
  const node = { target_fact: "pressure_trend", choices: [] };
  assert.equal(
    responseStatement(node, {
      status: "confirmed",
      confirmed_value: "unstable",
    }),
    "Pressure records show variation.",
  );
  assert.equal(
    responseStatement(node, { status: "confirmed", confirmed_value: "stable" }),
    "Recorded pressure is stable.",
  );
  assert.equal(
    responseStatement(node, { status: "unknown", choice: "unknown" }),
    "Pressure trend remains unknown.",
  );
  assert.equal(
    responseStatement(node, { status: "pending", choice: "stable" }),
    "The response awaits confirmation.",
  );
  assert.equal(
    responseStatement(node, { status: "clarification", choice: "unstable" }),
    "The response needs clarification.",
  );
  assert.equal(
    responseStatement(node, { status: "clarification" }, true),
    "The original response was clarified.",
  );
  assert.equal(
    responseStatement(
      { target_fact: "timing", choices: [] },
      { status: "confirmed", confirmed_value: "not_aligned" },
    ),
    "The sample times do not align.",
  );
});

test("adaptive facts use their saved labels without dropping a long qualification", () => {
  const node = {
    target_fact: "setup_comparison",
    choices: [{ value: "mismatch", label: "Different setups were recorded" }],
  };
  assert.equal(
    responseStatement(node, {
      status: "confirmed",
      confirmed_value: "mismatch",
    }),
    "Setup comparison: Different setups were recorded.",
  );
  assert.equal(
    responseStatement(node, {
      status: "confirmed",
      confirmed_value:
        "This observation is qualified by missing samples and unaligned time records, so the conclusion is uncertain",
    }),
    "A response is recorded; see answer details.",
  );
});
