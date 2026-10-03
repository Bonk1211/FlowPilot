import assert from "node:assert/strict";
import test from "node:test";
import {
  actOnIncident,
  converseWithInvestigation,
  loadIncident,
} from "../apps/web/src/incidents/api.ts";

test("manual investigation requests outlast source retrieval and report ambiguous timeouts accurately", async (t) => {
  globalThis.window = { location: { origin: "http://localhost" } };
  globalThis.sessionStorage = { getItem: () => null };
  t.after(() => {
    delete globalThis.window;
    delete globalThis.sessionStorage;
  });
  const limits = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    limits.push(milliseconds);
    return new AbortController().signal;
  });
  const requests = [];
  t.mock.method(globalThis, "fetch", async (path, options) => {
    requests.push({ path, options });
    return new Response(JSON.stringify({ id: "INC-test" }));
  });
  await loadIncident("INC-test");
  await actOnIncident("INC-test", { action: "analyze", revision: 0 });
  await converseWithInvestigation("INC-test", {
    revision: 0,
    text: "The sample times align",
    input_mode: "text",
  });
  assert.equal(limits[0], 20000);
  // Retrieval (12 s) plus question generation (30 s) exceeds the old 20 s deadline.
  assert.ok(limits[1] > 42000);
  assert.ok(limits[2] > 42000);
  assert.equal(requests[1].options.method, "POST");
  globalThis.fetch.mock.mockImplementation(async () => {
    throw new DOMException("Timed out", "TimeoutError");
  });
  await assert.rejects(
    actOnIncident("INC-test", { action: "analyze", revision: 0 }),
    /Reload saved state to check whether your answer or analysis was saved/,
  );
  globalThis.fetch.mock.mockImplementation(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(loadIncident("INC-test"), /could not be reached/);
});
