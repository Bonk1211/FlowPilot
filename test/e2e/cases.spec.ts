import { openDisclosure } from "../helpers/disclosures";
import { start, discovery, inspect } from "../helpers/caseJourney";
import { expect, test } from "@playwright/test";
import unitExamples from "../../fixtures/v1/evidence-units.json" with { type: "json" };
import { candidateValue } from "../../apps/web/src/presentation";
import legacy from "../../fixtures/v1/golden-scenario.json" with { type: "json" };

test("evidence values preserve scalar, compound and missing units", () => {
  for (const example of unitExamples) {
    expect(candidateValue(example)).toBe(example.display);
  }
});

test("case navigator and grounded guidance keep the case read-only", async ({
  page,
  request,
}) => {
  await start(page);
  await discovery(page);
  const caseId = new URL(page.url()).searchParams.get("case");
  expect(caseId).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Investigations" }),
  ).toBeVisible();
  await openDisclosure(page.locator(".saved-cases-disclosure > summary"));
  await expect(
    page.getByRole("navigation", { name: "Recent cases" }),
  ).toContainText(caseId!);

  const before = await (
    await request.get(`/api/investigations/${caseId}`)
  ).json();
  await page.locator(".guidance-toggle").click();
  // The empty chat offers its suggestions directly: one click fills the ask.
  await page
    .getByRole("button", { name: "Why is this the leading cause?" })
    .click();
  await expect(page.locator(".composer-input textarea")).toHaveValue(
    "Why is this the leading cause?",
  );
  await page.getByRole("button", { name: "Ask FlowPilot" }).click();
  await expect(
    page.getByText("FlowPilot guidance", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Guidance only — this did not change the case."),
  ).toBeVisible();
  const after = await (
    await request.get(`/api/investigations/${caseId}`)
  ).json();
  expect(after.investigation.revision).toBe(before.investigation.revision);
  expect(after.timeline).toEqual(before.timeline);
});

test("desktop workspace prioritizes the next action and collapses supporting detail", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page);
  await discovery(page);
  await expect(
    page.getByRole("button", { name: "Start illustrative inspection" }),
  ).toBeInViewport();
  await expect(page.locator(".guidance-toggle")).toBeInViewport();
  await expect(
    page.getByRole("dialog", { name: "FlowPilot assistant" }),
  ).not.toBeVisible();
  await expect(page.locator(".diagnosis-disclosure")).not.toHaveAttribute(
    "open",
    "",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("task-lane.png") });
});

test("recovery requires complete checks and two calibration failures block retries", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await start(page);
  await discovery(page);
  await inspect(page, true);
  await page
    .getByLabel("I confirm the simulated corrective action is complete.")
    .check();
  await page.getByRole("button", { name: "Record action complete" }).click();
  const verify = page.getByRole("button", {
    name: "Measure verification sample",
  });
  await expect(verify).toBeDisabled();
  await page
    .getByLabel("I confirm these simulated recovery observations.")
    .check();
  await verify.click();
  await expect(
    page.getByText("Verification failed. The case remains open.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resolve case", exact: true }),
  ).toHaveCount(0);
  await openDisclosure(page.getByText("Demo shortcut", { exact: true }));
  await page
    .getByRole("button", { name: "Use simulated passing check results" })
    .click();
  await page
    .getByRole("combobox", {
      name: "Auto Flux Weight Calibration",
      exact: true,
    })
    .selectOption("fail");
  await page
    .getByLabel("I confirm these simulated recovery observations.")
    .check();
  await verify.click();
  await expect(
    page.getByText("Calibration attempts: 1; failures: 1.", { exact: true }),
  ).toBeVisible();
  await expect(verify).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("combobox", {
      name: "Auto Flux Weight Calibration",
      exact: true,
    }),
  ).toHaveValue("fail");
  await expect(
    page.getByRole("combobox", { name: "Prompted Setup", exact: true }),
  ).toHaveValue("pass");
  await expect(page.getByLabel("Limits reference")).not.toHaveValue("");
  await expect(verify).toBeDisabled();
  await page
    .getByText("Last submitted recovery checks", { exact: true })
    .click();
  await expect(
    page.locator("details").filter({
      has: page.locator("summary", {
        hasText: "Last submitted recovery checks",
      }),
    }),
  ).toContainText("calibration");
  await page
    .getByLabel("I confirm these simulated recovery observations.")
    .check();
  await verify.click();
  await expect(page.getByRole("alert")).toContainText(
    "Two calibration failures",
  );
  await expect(verify).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Two calibration failures",
  );
  await page.screenshot({
    path: testInfo.outputPath("flux-recovery-escalation.png"),
    fullPage: true,
  });
});

test("legacy case view retains original evidence and has no mutation controls", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/investigations", {
    data: { report: "Archive view fixture" },
  });
  const saved = await response.json();
  const original = legacy.images[0];
  await page.route(`**/api/investigations/${saved.investigation.id}`, (route) =>
    route.fulfill({
      json: {
        ...saved,
        scenario_version: "1.0",
        rules_version: "1.0",
        investigation: { ...legacy.investigation, id: saved.investigation.id },
        measurement: { ...original, sample_id: "undersized", passed: false },
        summary: legacy.summary,
      },
    }),
  );
  await page.goto(`/?case=${saved.investigation.id}`);
  await expect(
    page.getByRole("heading", { name: "Archived epoxy investigation" }),
  ).toBeVisible();
  await expect(
    page.getByText("Read-only legacy case.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Archived epoxy dot measurements" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start a new flux investigation" }),
  ).toHaveAttribute("href", "/legacy");
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("complete persisted journey with sample log, failed verification and refresh", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await start(page);
  await openDisclosure(
    page.getByText("Reported sample & optional machine log", { exact: true }),
  );
  await page.getByRole("button", { name: "Use sample machine log" }).click();
  await expect(
    page.getByRole("heading", { name: "Log preview", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Attach previewed log" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Attached demo-industry-machine.log/ }),
  ).toBeVisible();
  await discovery(page);
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  const operator = page.locator(".prototype-ledger-row").filter({
    has: page.getByRole("heading", { name: "operator report", exact: true }),
  });
  await operator.getByText("Correct this evidence", { exact: true }).click();
  await operator.getByLabel("Correction type").selectOption("edit");
  await operator
    .getByLabel("Replacement value")
    .fill("Corrected coverage report for audit");
  await operator
    .getByLabel("Correction reason")
    .fill("Clarify the reported symptom");
  await operator.getByRole("checkbox").check();
  await operator.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("heading", { name: "Review the diagnosis" }),
  ).toBeVisible();
  const rawLog = page.locator("details").filter({
    has: page.locator("summary", {
      hasText: "Retained machine events and raw log",
    }),
  });
  await rawLog.locator(":scope > summary").click();
  await expect(
    rawLog.getByRole("heading", { name: "Raw machine events" }),
  ).toBeVisible();
  await rawLog.getByRole("button", { name: "Back to preview" }).first().click();
  await expect(rawLog).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("heading", { name: "1. Fluid-path restriction" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ranked causes" }),
  ).toBeVisible();
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  const correction = page.locator(".prototype-ledger-row").filter({
    has: page.getByRole("heading", {
      name: "frame location correction",
      exact: true,
    }),
  });
  await expect(correction).toContainText(
    "x: 0.012 inch · y: -0.014 inch · rotation: -0.01 deg",
  );
  await inspect(page, true);
  await page
    .getByLabel("I confirm the simulated corrective action is complete.")
    .check();
  await page.getByRole("button", { name: "Record action complete" }).click();
  await openDisclosure(page.getByText("Demo shortcut", { exact: true }));
  await page
    .getByRole("button", { name: "Use simulated passing check results" })
    .click();
  await page
    .getByLabel("I confirm these simulated recovery observations.")
    .check();
  await page
    .getByLabel("Verification sample", { exact: true })
    .selectOption("coarse");
  await page
    .getByRole("button", { name: "Measure verification sample" })
    .click();
  await expect(
    page.getByText("Verification failed. The case remains open.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resolve case", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByLabel("Verification sample", { exact: true }),
  ).toHaveValue("coarse");
  await expect(
    page.getByLabel("I confirm these simulated recovery observations."),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Measure verification sample" }),
  ).toBeDisabled();
  await page
    .getByLabel("Verification sample", { exact: true })
    .selectOption("normal");
  await page
    .getByLabel("I confirm these simulated recovery observations.")
    .check();
  await page
    .getByRole("button", { name: "Measure verification sample" })
    .click();
  await page
    .getByLabel("I confirm this simulated case is ready to resolve.")
    .check();
  await page
    .getByLabel("Completion notes (optional)")
    .fill("Audit follow-up: both lanes accepted.");
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect(
    page.getByText("Resolved · saved to this case", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Review the completed case" }),
  ).toBeVisible();
  const summary = page.locator(".prototype-summary");
  await expect(summary).toContainText("Audit follow-up: both lanes accepted.");
  const current = summary
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Current evidence/ }) });
  await current.locator("summary").click();
  await expect(current).toContainText("Corrected coverage report for audit");
  await expect(current).not.toContainText(
    "The latest inspected tray has declining flux spray coverage.",
  );
  await expect(current).toContainText("verification passed: true");
  await expect(current).not.toContainText("verification passed: false");
  const earlier = summary
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /^Earlier recovery/ }) });
  await earlier.locator("summary").click();
  await expect(earlier).toContainText("verification passed: false");
  const rejected = summary.locator("details").filter({
    has: page.locator("summary", { hasText: /^Rejected or superseded/ }),
  });
  await rejected.locator("summary").click();
  await expect(rejected).toContainText(
    "The latest inspected tray has declining flux spray coverage.",
  );
  await expect(rejected).toContainText("rejected");
  await expect(rejected.locator("time")).toHaveCount(1);
  await openDisclosure(
    page.getByText("Diagnostic history · previous decisions", { exact: true }),
  );
  const history = page.getByRole("region", { name: "Diagnostic history" });
  await expect(history.locator(":scope > details")).toHaveCount(3);
  const initial = history.locator(":scope > details").first();
  await initial.locator(":scope > summary").click();
  await expect(initial).toContainText("Fluid-path restriction: 40 points");
  const final = history.locator(":scope > details").last();
  await final.locator(":scope > summary").click();
  await expect(final).toContainText("Fluid-path restriction: 80 points");
  await page
    .getByText("Case timeline · saved history", { exact: true })
    .click();
  await page
    .getByRole("link", { name: /View diagnostic snapshot at revision/ })
    .first()
    .click();
  await expect(initial).toBeFocused();
  await current.locator("summary").click();
  await initial.locator(":scope > summary").click();
  await final.locator(":scope > summary").click();
  await page
    .getByText("Case timeline · saved history", { exact: true })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("audit-summary-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("audit-summary-mobile.png"),
    fullPage: true,
  });
});

test("negative observation requires confirmation and retains ordered case history", async ({
  page,
}) => {
  await start(page);
  await discovery(page);
  await inspect(page, false);
  await expect(
    page.getByRole("heading", { name: "1. Fluid-pressure / BFS supply fault" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Maintenance handoff needed" }),
  ).toBeVisible();
  await openDisclosure(
    page.getByText("Inspection rationale and procedure details", {
      exact: true,
    }),
  );
  await expect(page.getByText(/Case remains open/)).toBeVisible();
  await page
    .getByText("Case timeline · saved history", { exact: true })
    .click();
  const entries = page.locator(".prototype-timeline li");
  const count = await entries.count();
  await expect(entries.nth(count - 2)).toContainText(
    "inspection completed — Inspection completed: no obstruction found",
  );
  await expect(entries.nth(count - 1)).toContainText(
    "diagnosing — No nozzle obstruction; review air cap and pressure supply next.",
  );
  await expect(
    page.getByRole("button", { name: "Record action complete" }),
  ).toHaveCount(0);
});

test("uploaded log preserves unknowns and missing timezone; intermittent branch changes ranking", async ({
  page,
}) => {
  await start(page);
  await openDisclosure(
    page.getByText("Reported sample & optional machine log", { exact: true }),
  );
  await page.getByLabel("Upload controlled .log or .txt").setInputFiles({
    name: "slice.log",
    mimeType: "text/plain",
    buffer: Buffer.from("2026-09-13,01:20:00.000,Unknown event,payload"),
  });
  await expect(
    page.getByRole("heading", { name: "Log preview", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Attach previewed log" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Attached slice.log/ }),
  ).toBeVisible();
  await discovery(page, true);
  await expect(
    page.getByRole("heading", { name: "1. Coaxial-air / atomization fault" }),
  ).toBeVisible();
  await page.reload();
  const air = page.locator(".prototype-cause").filter({
    has: page.getByRole("heading", {
      name: "1. Coaxial-air / atomization fault",
    }),
  });
  await expect(air).toContainText(
    "Missing: Air-cap and coaxial-air inspection",
  );
  await expect(air).not.toContainText("Weight versus pattern");
  await openDisclosure(
    page.getByText("How this diagnosis was generated", { exact: true }),
  );
  const finding = page.locator(".reasoning-disclosure > details").filter({
    has: page.locator("summary", {
      hasText: "fluid path specialist · atomization fault",
    }),
  });
  await finding.locator("summary").click();
  await expect(finding).toContainText(
    "Missing: Air-cap and coaxial-air inspection",
  );
});

test("failed mutation preserves case and stale revisions can recover", async ({
  page,
  request,
}) => {
  await start(page);
  const id = new URL(page.url()).searchParams.get("case")!;
  await page.route("**/api/investigations/*/actions", (route) => route.abort());
  await page
    .getByRole("button", { name: "Incomplete coverage", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("service is unavailable");
  await expect(
    page.getByRole("heading", {
      name: "Which spray symptom was observed?",
    }),
  ).toBeVisible();
  await page.unroute("**/api/investigations/*/actions");
  await expect(
    page.getByRole("button", { name: "Incomplete coverage", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reload saved case / retry connection" })
    .click();
  await expect(
    page.getByRole("button", { name: "Incomplete coverage", exact: true }),
  ).toBeEnabled();
  const updated = await request.post(`/api/investigations/${id}/actions`, {
    data: {
      action: "answer",
      revision: 0,
      question_id: "frequency",
      value: "continuous",
    },
  });
  expect(updated.ok()).toBeTruthy();
  await page
    .getByRole("button", { name: "Incomplete coverage", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Case changed");
  await page
    .getByRole("button", { name: "Reload saved case / retry connection" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Has measured flux weight been falling?",
    }),
  ).toBeVisible();
});

test("sample measurements and keyboard journey reflow at 375px", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?samples=raster");
  await page.getByLabel("Controlled image sample").selectOption("overspray");
  await expect(
    page.getByRole("img", { name: "Overspray: 100% coverage" }),
  ).toBeVisible();
  await page.getByLabel("Controlled image sample").selectOption("incomplete");
  await page
    .getByRole("button", { name: "Start investigation", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await discovery(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("m1-mobile-diagnosis.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(page.getByText("Current part:", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("m1-mobile-inspection.png"),
    fullPage: true,
  });
});

test("task-first disclosures preserve guidance drafts and reveal cited evidence", async ({
  page,
}) => {
  await start(page);
  await expect(
    page.getByRole("button", { name: "Incomplete coverage", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use sample machine log" }),
  ).not.toBeVisible();
  await discovery(page);
  await expect(page.locator(".prototype-cause > details[open]")).toHaveCount(0);
  await expect(page.getByLabel("Evidence source")).not.toBeVisible();
  await page.locator(".guidance-toggle").click();
  const question = page.getByRole("textbox", {
    name: "Question about the current case",
  });
  await question.fill("Why is this the leading cause?");
  await page.locator(".guidance-toggle").click();
  await page.locator(".guidance-toggle").click();
  await expect(question).toHaveValue("Why is this the leading cause?");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open FlowPilot chat" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open FlowPilot chat" }).click();
  await expect(question).toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole("dialog", { name: "FlowPilot assistant" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Ask FlowPilot", exact: true })
    .click();
  const citation = page.locator(".guidance-citations a").first();
  await expect(citation).toBeVisible();
  const href = await citation.getAttribute("href");
  await citation.click();
  await expect(page.locator(href!)).toBeFocused();
  await expect(page.getByLabel("Evidence source")).toBeVisible();
});
