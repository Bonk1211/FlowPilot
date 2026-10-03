import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Incident } from "@flowpilot/contracts";

test("response map shows converging faults, readable test branches and a printable handoff", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `doe-map-${randomUUID()}` },
    })
  ).json();
  const act = async (command: Record<string, unknown>) => {
    const response = await request.post(
      `/api/incidents/${incident.id}/actions`,
      { data: { revision: incident.revision, ...command } },
    );
    expect(response.ok()).toBeTruthy();
    incident = await response.json();
  };
  await act({ action: "analyze" });
  for (let i = 0; i < 4; i++) {
    const node = incident.investigation!.nodes!.find(
      (node) => node.id === incident.investigation!.active_node_id,
    )!;
    await act({
      action: "answer_investigation",
      node_id: node.id,
      answer_id: `ANS-${randomUUID()}`,
      choice: node.choices![0].value,
    });
  }
  await page.goto(`/incidents/${incident.id}/investigation`);
  await page
    .getByRole("button", { name: "Response flow & mini DOE", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-card-id="shared-area"]')).toContainText(
    "Shared investigation area",
  );
  await expect(dialog.locator('[data-card-id^="test-"]')).toHaveCount(3);
  await expect(dialog.locator('[data-card-id^="test-"]').first()).toContainText(
    "SUGGESTED / NOT RUN",
  );
  const overflow = await dialog
    .locator(".troubleshooting-svg g[data-card-id]")
    .evaluateAll((cards) =>
      cards.flatMap((card) => {
        const rect = card.querySelector("rect")!.getBBox();
        return [...card.querySelectorAll("text")]
          .filter((text) => {
            const box = text.getBBox();
            return (
              box.x < rect.x ||
              box.x + box.width > rect.x + rect.width ||
              box.y + box.height > rect.y + rect.height
            );
          })
          .map(
            (text) =>
              `${card.getAttribute("data-card-id")}: ${text.textContent}`,
          );
      }),
    );
  expect(overflow).toEqual([]);
  await dialog.getByRole("button", { name: "Fit width", exact: true }).click();
  await dialog.screenshot({ path: testInfo.outputPath("response-map.png") });
  await dialog.locator(".troubleshooting-viewport").evaluate((element) => {
    const card = element.querySelector('[data-card-id^="test-"]')!;
    element.scrollTop +=
      card.getBoundingClientRect().top -
      element.getBoundingClientRect().top -
      25;
  });
  await dialog.screenshot({
    path: testInfo.outputPath("mini-doe-branches.png"),
  });
  const svgDownload = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export SVG", exact: true }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toContain(`r${incident.revision}-flow.svg`);
  const htmlDownload = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Export handoff", exact: true })
    .click();
  const html = await htmlDownload;
  const handoffPath = testInfo.outputPath("handoff.html");
  await html.saveAs(handoffPath);
  await expect(dialog.locator('p[role="status"]')).toContainText(
    "Open the HTML file",
  );
  await page.setViewportSize({ width: 375, height: 844 });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBeTruthy();
  await expect(
    dialog.getByRole("button", { name: "Export handoff", exact: true }),
  ).toBeInViewport();
  await dialog.screenshot({ path: testInfo.outputPath("map-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Response flow & mini DOE", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("about:blank");
  await page.setContent(await readFile(handoffPath, "utf8"));
  await expect(
    page.getByRole("button", { name: "Print / save as PDF" }),
  ).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({ has: page.locator("h1", { hasText: "T1 ·" }) }),
  ).toContainText("Repeat / uncertainty");
  await page
    .locator("section")
    .filter({ has: page.locator("h1", { hasText: "T1 ·" }) })
    .screenshot({ path: testInfo.outputPath("handoff-test-page.png") });
  await page.pdf({
    path: testInfo.outputPath("handoff.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
});
