import { expect, test, type Page } from "@playwright/test";
import unitExamples from "../../fixtures/v1/evidence-units.json" with { type: "json" };
import { candidateValue } from "../../apps/web/src/presentation";
import legacy from "../../fixtures/v1/golden-scenario.json" with { type: "json" };

test("evidence values preserve scalar, compound and missing units", () => {
  for (const example of unitExamples) {
    expect(candidateValue(example)).toBe(example.display);
  }
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
    page
      .locator("details")
      .filter({
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
  ).toHaveAttribute("href", "/");
  await expect(page.getByRole("button")).toHaveCount(0);
});

async function start(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start investigation", exact: true })
    .click();
  await expect(page).toHaveURL(/\?case=CASE-/);
}

async function discovery(page: Page, intermittent = false) {
  await page
    .getByRole("button", {
      name: intermittent ? "Blobs or line-end droplets" : "Incomplete coverage",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: intermittent
        ? "Does flux weight pass despite blobs or droplets?"
        : "Has measured flux weight been falling?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Stable / no known change" }).click();
  await page.getByRole("button", { name: "Not recorded", exact: true }).click();
  await page.getByRole("button", { name: "Not recorded", exact: true }).click();
  await page.getByRole("button", { name: "Diagnose case" }).click();
  await expect(
    page.getByRole("heading", { name: "Ranked causes" }),
  ).toBeVisible();
}

async function inspect(page: Page, positive: boolean) {
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  const next = page.getByRole("button", { name: "Next step", exact: true });
  while (await next.isEnabled()) await next.click();
  await page
    .getByRole("button", {
      name: positive ? "Obstruction found" : "No obstruction found",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm observation" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm observation" }).click();
}

test("complete persisted journey with sample log, failed verification and refresh", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await start(page);
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
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect(
    page.getByText("Resolved · saved to this case", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Review the completed case" }),
  ).toBeVisible();
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
  const finding = page.locator("details").filter({
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
  await page.goto("/");
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
