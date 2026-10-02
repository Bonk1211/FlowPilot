import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { expect, test, type Page } from "@playwright/test";

const ITERATIONS = Number(process.env.TIMING_ITERATIONS ?? 10);

type Ready = "workspace" | "draft" | "analysis";

// Times one click to the first DOM state that satisfies `ready`, entirely inside the page,
// so Playwright's retry polling does not quantize the result.
async function timed(page: Page, ready: Ready, click: () => Promise<void>) {
  await page.evaluate((kind) => {
    const timing = { start: 0, end: 0 };
    Object.assign(window, { __incidentTiming: timing });
    // Feature pages stay mounted while hidden, so readiness requires visibility.
    const visible = (selector: string, text: string) =>
      [...document.querySelectorAll(selector)].some(
        (item) => item.textContent?.includes(text) && item.checkVisibility(),
      );
    const done = {
      workspace: () =>
        /^\/incidents\/INC-/.test(location.pathname) &&
        visible("h1, h2, h3", "Progressively insufficient flux coverage"),
      draft: () =>
        visible("#handoff-title", "Engineer handoff") &&
        visible("span, p, strong", "Draft · not sent"),
      // Background analysis may already show a result, so require this click's saved status.
      analysis: () =>
        [...document.querySelectorAll("[aria-live='polite']")].some((item) =>
          item.textContent?.includes("analyze complete."),
        ) && visible("h1, h2, h3", "Investigate competing causes"),
    }[kind];
    document.addEventListener(
      "click",
      () => {
        timing.start = performance.now();
      },
      { capture: true, once: true },
    );
    const observer = new MutationObserver(() => {
      if (timing.start && done()) {
        timing.end = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  }, ready);
  await click();
  await page.waitForFunction(
    () =>
      (window as unknown as { __incidentTiming: { end: number } })
        .__incidentTiming.end > 0,
    undefined,
    { timeout: 20_000 },
  );
  return page.evaluate(() => {
    const timing = (
      window as unknown as { __incidentTiming: { start: number; end: number } }
    ).__incidentTiming;
    return timing.end - timing.start;
  });
}

async function openFeature(page: Page, name: string) {
  const navigation = page.getByRole("navigation", {
    name: "Incident features",
    exact: true,
  });
  if (!(await navigation.isVisible()))
    await page
      .getByRole("button", { name: "Expand navigation", exact: true })
      .click();
  return navigation.getByRole("link", { name, exact: true });
}

async function measure(page: Page) {
  await page.goto("/");
  const created = page.waitForResponse(
    (item) =>
      item.url().endsWith("/api/incidents/replay") &&
      item.request().method() === "POST",
  );
  const acknowledgement_ms = await timed(page, "workspace", () =>
    page.getByRole("button", { name: "Start S932 replay" }).click(),
  );
  // The creation response must already carry the saved template draft.
  const incident = await (await created).json();
  expect(incident.handoff.body).toContain("Diagnosis is pending");
  const handoff = await openFeature(page, "Handoff");
  const handoff_render_ms = await timed(page, "draft", () => handoff.click());
  await (await openFeature(page, "Evidence")).click();
  await page.getByRole("button", { name: "Collect next evidence" }).click();
  await expect(
    page.getByRole("button", { name: "Collect next evidence" }),
  ).toHaveCount(0);
  await (await openFeature(page, "Investigation")).click();
  const analysis_ms = await timed(page, "analysis", () =>
    page.getByRole("button", { name: "Analyze available evidence" }).click(),
  );
  return { acknowledgement_ms, handoff_render_ms, analysis_ms };
}

function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    minimum_ms: round(sorted[0]),
    p50_ms: round(pick(0.5)),
    p95_ms: round(pick(0.95)),
    maximum_ms: round(sorted[sorted.length - 1]),
  };
}

test("incident replay browser timing", async ({ page }, testInfo) => {
  test.setTimeout(ITERATIONS * 30_000 + 60_000);
  const warmup = await measure(page);
  const runs = [];
  for (let index = 0; index < ITERATIONS; index++)
    runs.push(await measure(page));
  const result = {
    conditions:
      "Local Chromium via Playwright against the Vite dev server and a local FastAPI/SQLite API " +
      "with dev:mock settings (auto-process on, external reasoning and Jev off). Synthetic replay; " +
      "no network, real equipment collection or real LLM. Each value runs from the triggering " +
      "click to the first DOM state showing the result, measured inside the page (analysis waits " +
      "for that click's saved status, not an earlier background result). The replay " +
      "creation response already contains the saved template draft. One excluded warm-up run.",
    iterations: ITERATIONS,
    warmup,
    acknowledgement: summary(runs.map((run) => run.acknowledgement_ms)),
    handoff_render: summary(runs.map((run) => run.handoff_render_ms)),
    analysis: summary(runs.map((run) => run.analysis_ms)),
    runs,
  };
  const body = JSON.stringify(result, null, 2);
  await testInfo.attach("incident-timing.json", {
    body,
    contentType: "application/json",
  });
  await writeFile(testInfo.outputPath("incident-timing.json"), body);
  console.log(body);
});
