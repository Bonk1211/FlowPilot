import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

test("handoff exports a complete report and attached email draft, preserving work status and unsaved edits", async ({
  page,
  request,
}, testInfo) => {
  const incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `handoff-${randomUUID()}` },
    })
  ).json();
  const analyzed = await (
    await request.post(`/api/incidents/${incident.id}/actions`, {
      data: { action: "analyze", revision: incident.revision },
    })
  ).json();
  const base = `/api/incidents/${incident.id}/experiments`;
  const proposal = {
    incident_revision: analyzed.revision,
    check_id: "delivery_review",
    hypothesis_ids: ["unstable_delivery", "restriction"],
    factors: [{ name: "delivery_ratio", levels: [0.9, 1.1] }],
    repetitions: 1,
  };
  const plan = await (await request.post(base, { data: proposal })).json();
  expect(plan.id).toBeTruthy();
  const approved = await (
    await request.post(`${base}/${plan.id}/approve`, {
      data: { revision: plan.revision },
      headers: { "X-Incident-Role": "engineer" },
    })
  ).json();
  const started = await request.post(`${base}/${plan.id}/run`, {
    data: { revision: approved.revision },
  });
  // A run starts in the background (202) and saves each condition as it finishes.
  expect(started.status()).toBe(202);
  let completed = await started.json();
  await expect
    .poll(async () => {
      const plans = await (await request.get(base)).json();
      completed = plans.find((item: { id: string }) => item.id === plan.id);
      return completed.status;
    })
    .toBe("completed");
  const pending = await (
    await request.post(base, {
      data: { ...proposal, response: "coverage_fraction" },
    })
  ).json();
  expect(pending.status).toBe("proposed");
  await page.goto(`/incidents/${incident.id}/handoff`);
  await expect(
    page.getByRole("heading", { name: "Drafted email", exact: true }),
  ).toBeVisible();
  const frame = page.frameLocator(
    'iframe[title="Technical assessment report preview"]',
  );
  await expect(
    frame.getByRole("heading", {
      name: "Technical assessment report",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("#incident-overview")).toBeHidden();
  const emailBounds = await page.locator(".handoff-email").boundingBox();
  const reportBounds = await page.locator(".handoff-report").boundingBox();
  expect(emailBounds!.y).toBeLessThan(260);
  expect(reportBounds!.y).toBe(emailBounds!.y);
  expect(emailBounds!.x + emailBounds!.width).toBeLessThanOrEqual(
    reportBounds!.x,
  );
  await page
    .getByRole("button", { name: "Incident details", exact: true })
    .click();
  await expect(page.locator("#incident-overview")).toBeVisible();
  await expect(
    page.locator("#incident-overview .incident-jobs summary"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close incident details", exact: true })
    .click();
  await expect(page.locator("#incident-overview")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("compact-handoff.png") });
  await expect(
    frame.locator(`[data-card-id="experiment-${plan.id}"]`),
  ).toContainText("6/6 runs recorded");
  await expect(
    frame.locator(`[data-card-id="experiment-${pending.id}"]`),
  ).toContainText("not run");
  await expect(frame.locator(".hypothesis-card").first()).toContainText(
    "Evidence informs this hypothesis",
  );
  const resultChart = frame.locator(`[data-experiment-chart="${plan.id}"]`);
  await expect(resultChart.locator(".contrast-row")).toHaveCount(6);
  await expect(resultChart.locator("[data-contrast]")).toHaveCount(6);
  await expect(
    frame.locator(`[data-experiment-chart="${pending.id}"] .contrast-unrun`),
  ).toHaveCount(6);
  await expect(frame.locator(".execution-timeline").first()).toContainText(
    "complete",
  );
  await page.locator(".handoff-workspace").screenshot({
    path: testInfo.outputPath("handoff-side-by-side.png"),
  });
  const htmlDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download HTML report", exact: true })
    .click();
  const htmlFile = await htmlDownload;
  const html = await readFile((await htmlFile.path())!, "utf8");
  expect(htmlFile.suggestedFilename()).toMatch(/-handoff.html$/);
  expect(html).toContain("Mean response");
  expect(html).toContain(completed.results[0].response_mean.toFixed(6));
  expect(html).toContain("Complete assessment response record");
  expect(html).not.toContain("Drafted email");
  expect(html).not.toContain(analyzed.handoff.body);
  expect(html).not.toContain("Communication status");
  expect(html).not.toContain("Application audit");
  const markdown = await request.get(`/api/incidents/${incident.id}/report.md`);
  expect(markdown.ok()).toBeTruthy();
  const markdownText = await markdown.text();
  expect(markdownText).not.toContain(analyzed.handoff.body);
  expect(markdownText).not.toContain("Handoff (draft only)");
  expect(markdownText).toContain("Assessment history");
  const emlDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download email draft (.eml)", exact: true })
    .click();
  const emlFile = await emlDownload;
  const eml = await readFile((await emlFile.path())!, "utf8");
  expect(emlFile.suggestedFilename()).toMatch(/-handoff.eml$/);
  expect(eml).toContain("X-Unsent: 1");
  expect(eml).toContain("Content-Disposition: attachment;");
  await page
    .getByRole("textbox", { name: "Handoff message", exact: true })
    .fill("Unsaved handoff note");
  await expect(
    page.getByRole("button", { name: "Download HTML report", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", {
      name: "Download email draft (.eml)",
      exact: true,
    }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator(".handoff-report")
    .screenshot({ path: testInfo.outputPath("handoff-package-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("about:blank");
  await page.setContent(html);
  await expect(page.locator("body > section").nth(1)).toHaveClass(
    "investigation-overview",
  );
  const overview = page.locator(".investigation-overview").first();
  await expect(overview).toContainText("Full investigation flowchart");
  await expect(
    overview.getByLabel("Flowchart symbols").locator("li"),
  ).toHaveCount(6);
  await expect(
    overview.locator(
      '[data-overview-card="comparison-gate"] [data-node-shape="decision"]',
    ),
  ).toHaveCount(1);
  await expect(
    overview.locator(
      `[data-overview-card="experiment-${plan.id}"] [data-node-shape="document"]`,
    ),
  ).toHaveCount(1);
  await expect(
    overview.locator(
      '[data-overview-card="investigation-start"] [data-node-shape="terminal"]',
    ),
  ).toHaveCount(1);
  await overview.screenshot({
    path: testInfo.outputPath("full-investigation-flow.png"),
  });
  const flowOverflow = await page
    .locator("[data-overview-card]")
    .evaluateAll((cards) =>
      cards.flatMap((card) => {
        const shape =
          card.querySelector<SVGGeometryElement>("[data-node-shape]")!;
        return [...card.querySelectorAll("text")]
          .filter((text) => {
            const bounds = text.getBBox();
            return [
              [bounds.x, bounds.y],
              [bounds.x + bounds.width, bounds.y],
              [bounds.x, bounds.y + bounds.height],
              [bounds.x + bounds.width, bounds.y + bounds.height],
            ].some(([x, y]) => !shape.isPointInFill(new DOMPoint(x, y)));
          })
          .map((text) => text.textContent);
      }),
    );
  expect(flowOverflow).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("heading", { name: "Technical assessment report", exact: true })
    .screenshot({ path: testInfo.outputPath("handoff-heading.png") });
  await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Current assessment",
        exact: true,
      }),
    })
    .screenshot({ path: testInfo.outputPath("assessment-findings.png") });
  await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: `Experiment ${plan.id}`,
        exact: true,
      }),
    })
    .screenshot({ path: testInfo.outputPath("handoff-experiment.png") });
  await page.pdf({
    path: testInfo.outputPath("handoff.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test("failed experiment history fetch blocks report export and supports retry", async ({
  page,
  request,
}) => {
  const incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `handoff-failure-${randomUUID()}` },
    })
  ).json();
  let fail = true;
  await page.route(`**/api/incidents/${incident.id}/experiments`, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Experiment records unavailable" }),
        })
      : route.continue(),
  );
  await page.goto(`/incidents/${incident.id}/handoff`);
  await page
    .getByRole("button", { name: "Preview saved report", exact: true })
    .click();
  await expect(page.locator(".handoff-report").getByRole("alert")).toHaveText(
    "Experiment records unavailable",
  );
  await expect(page.locator(".handoff-report iframe")).toHaveCount(0);
  fail = false;
  await page
    .getByRole("button", { name: "Preview saved report", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[title="Technical assessment report preview"]')
      .getByRole("heading", {
        name: "Technical assessment report",
        exact: true,
      }),
  ).toBeVisible();
});
