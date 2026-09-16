import { expect, test, type Page } from "@playwright/test";
import unitExamples from "../../fixtures/v1/evidence-units.json" with { type: "json" };
import { candidateValue } from "../../apps/web/src/presentation";

test("evidence values preserve scalar, compound and missing units", () => {
  for (const example of unitExamples) {
    expect(candidateValue(example)).toBe(example.display);
  }
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
      name: intermittent ? "Intermittent" : "Continuous",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: intermittent
        ? "Do normal dots return between affected runs?"
        : "Has the undersizing persisted across trays?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "No known change" }).click();
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
  await expect(
    page.getByRole("heading", { name: "1. Cartridge / nozzle restriction" }),
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
    .getByLabel("Verification sample", { exact: true })
    .selectOption("missing");
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
  await page
    .getByLabel("Verification sample", { exact: true })
    .selectOption("normal");
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
    page.getByRole("heading", { name: "1. Material viscosity change" }),
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
    "diagnosing — No obstruction; review material conditions next.",
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
    page.getByRole("heading", { name: "1. Trapped air bubble" }),
  ).toBeVisible();
  await page.reload();
  const air = page.locator(".prototype-cause").filter({
    has: page.getByRole("heading", { name: "1. Trapped air bubble" }),
  });
  await expect(air).toContainText("Missing: None listed");
  await expect(air).not.toContainText("Intermittent recovery");
  const finding = page.locator("details").filter({
    has: page.locator("summary", {
      hasText: "fluid path specialist · trapped air bubble",
    }),
  });
  await finding.locator("summary").click();
  await expect(finding).toContainText("Missing: None listed");
});

test("failed mutation preserves case and stale revisions can recover", async ({
  page,
  request,
}) => {
  await start(page);
  const id = new URL(page.url()).searchParams.get("case")!;
  await page.route("**/api/investigations/*/actions", (route) => route.abort());
  await page.getByRole("button", { name: "Continuous", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("service is unavailable");
  await expect(
    page.getByRole("heading", {
      name: "Is the undersizing continuous or intermittent?",
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
  await page.getByRole("button", { name: "Continuous", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Case changed");
  await page
    .getByRole("button", { name: "Reload saved case / retry connection" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Has the undersizing persisted across trays?",
    }),
  ).toBeVisible();
});

test("sample measurements and keyboard journey reflow at 375px", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("Controlled image sample").selectOption("oversized");
  await expect(
    page.getByRole("img", { name: "Oversized dots: 12 abnormal locations" }),
  ).toBeVisible();
  await page.getByLabel("Controlled image sample").selectOption("undersized");
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
