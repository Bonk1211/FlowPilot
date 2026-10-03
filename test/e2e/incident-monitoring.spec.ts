import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Incident } from "@flowpilot/contracts";

test("monitoring demo triggers alarms, prepares a package and analyzes the saved evidence", async ({
  page,
  request,
}, testInfo) => {
  const response = await request.post("/api/incidents/replay", {
    data: { trigger_id: `monitoring-${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const incident: Incident = await response.json();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/incidents/${incident.id}/investigation`);
  const dashboard = page.getByRole("region", { name: "Equipment monitoring" });
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByRole("img")).toHaveCount(6);
  expect(
    (await dashboard.getByRole("img").first().boundingBox())!.height,
  ).toBeGreaterThan(100);
  await expect(
    dashboard.locator(".monitor-state", { hasText: "Normal" }),
  ).toHaveCount(6);
  await expect(
    page.getByRole("heading", { name: "Evidence and mechanism" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ready to investigate" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("monitoring-normal-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("monitoring-normal-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dashboard
    .getByRole("button", { name: "Demo critical incident" })
    .click();
  await expect(dashboard.getByRole("status")).toContainText("ALARM TRIGGERED");
  await expect(dashboard.locator(".monitor-parameter.is-abnormal")).toHaveCount(
    4,
  );
  await expect(dashboard.locator(".monitor-alarms li")).toHaveCount(4);
  await page.screenshot({
    path: testInfo.outputPath("monitoring-critical-desktop.png"),
    fullPage: true,
  });
  const dialog = page.getByRole("dialog", { name: "Data retrieval pipeline" });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(
    dialog.getByRole("button", { name: "Analyze existing evidence" }),
  ).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog.locator(".is-running svg")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(dialog.locator(".monitor-pipeline .is-complete")).toHaveCount(
    4,
    { timeout: 10000 },
  );
  await expect(dialog.getByRole("status")).toContainText(
    "Existing evidence ready for analysis",
  );
  await expect(
    dialog.getByRole("button", { name: "Analyze existing evidence" }),
  ).toBeEnabled();
  // Demo telemetry must never overwrite or add to the saved incident evidence.
  const saved: Incident = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  expect(saved.revision).toBe(incident.revision);
  expect(saved.evidence).toEqual(incident.evidence);
  await page.screenshot({ path: testInfo.outputPath("retrieval-desktop.png") });
  await page.setViewportSize({ width: 375, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("retrieval-mobile.png") });
  await dialog
    .getByRole("button", { name: "Close data retrieval" })
    .press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    dashboard.getByRole("button", { name: "View data retrieval" }),
  ).toBeFocused();
  await dashboard.getByRole("button", { name: "Reset demo" }).click();
  await expect(
    dashboard.locator(".monitor-state", { hasText: "Normal" }),
  ).toHaveCount(6);
  await expect(dashboard.locator(".monitor-alarms li")).toHaveCount(0);
  // Closing an early retrieval and resetting must also cancel pending demo timers.
  await dashboard
    .getByRole("button", { name: "Demo critical incident" })
    .click();
  await dashboard.getByRole("button", { name: "View data retrieval" }).click();
  await dialog.getByRole("button", { name: "Back to monitoring" }).click();
  await dashboard.getByRole("button", { name: "Reset demo" }).click();
  await dashboard
    .getByRole("button", { name: "Demo critical incident" })
    .click();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(
    dialog.getByRole("button", { name: "Analyze existing evidence" }),
  ).toBeEnabled({ timeout: 10000 });
  await dialog
    .getByRole("button", { name: "Analyze existing evidence" })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Adaptive investigation", exact: true }),
  ).toBeVisible();
  await expect(dashboard).toBeHidden();
  const analyzed: Incident = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  expect(analyzed.assessment).toBeTruthy();
  expect(analyzed.evidence).toEqual(incident.evidence);
});
