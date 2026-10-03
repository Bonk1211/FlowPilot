import { expect, test } from "@playwright/test";
import type { Case } from "@flowpilot/contracts";

test("references and experience share topics with exact excerpts and layer filters", async ({
  page,
  request,
}, testInfo) => {
  const prefix = `Mixed reference ${Date.now()}`;
  const created = await request.post("/api/investigations", {
    data: { report: `${prefix} case`, sample_id: "incomplete" },
  });
  let value: Case = await created.json();
  for (const answer of ["continuous", "yes", "no", "unknown", "unknown"]) {
    const response = await request.post(
      `/api/investigations/${value.investigation.id}/actions`,
      {
        data: {
          action: "answer",
          revision: value.revision,
          question_id: value.next_question!.id,
          value: answer,
        },
      },
    );
    expect(response.ok()).toBeTruthy();
    value = await response.json();
  }
  const diagnosed = await request.post(
    `/api/investigations/${value.investigation.id}/actions`,
    {
      data: { action: "diagnose", revision: value.revision },
    },
  );
  value = await diagnosed.json();
  const source = await request.post("/api/incident-knowledge", {
    data: {
      document_id: `MIXED-REFERENCE-${Date.now()}`,
      document_revision: "test-r1",
      title: `${prefix} reference`,
      authority: "secondary_summary",
      configurations: [value.investigation.process],
      original_ref: "test-fixture:reference",
      passages: [
        {
          id: "nozzle",
          section: "2.1 Nozzle observations",
          text: "Existing nozzle records can describe poor coverage or restriction.",
        },
      ],
    },
  });
  expect(source.ok(), await source.text()).toBeTruthy();
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto("/knowledge");
  await page.getByLabel("Search database", { exact: true }).fill(prefix);
  await expect(
    page.getByRole("region", { name: "Reference documents" }),
  ).toContainText(`${prefix} reference`);
  await expect(
    page.getByRole("status").filter({ hasText: "1 matching record groups" }),
  ).toBeVisible();
  const browser = page.getByText(
    "Browse nodes and relationships with keyboard",
    { exact: true },
  );
  await browser.click();
  const component = page.getByRole("button", {
    name: "Component: DJ-2200 nozzle",
    exact: true,
  });
  const size = await component.getAttribute("data-node-size");
  const connections = Number(await component.getAttribute("data-connections"));
  expect(connections).toBeGreaterThan(1);
  const sizes = await page
    .locator(".graph-accessible [data-node-size]")
    .evaluateAll((items) =>
      items.map((item) => ({
        connections: Number(item.getAttribute("data-connections")),
        size: Number(item.getAttribute("data-node-size")),
      })),
    );
  const ordered = sizes.sort((a, b) => a.connections - b.connections);
  expect(ordered.at(-1)!.size).toBeGreaterThan(ordered[0].size);
  for (let index = 1; index < ordered.length; index++)
    expect(ordered[index].size).toBeGreaterThanOrEqual(ordered[index - 1].size);
  await component.click();
  const inspector = page.getByRole("complementary", {
    name: "Selected record",
  });
  await expect(
    inspector.getByRole("region", { name: "Reference evidence" }),
  ).toBeVisible();
  await expect(inspector).toContainText("Related investigations");
  await expect(inspector.getByLabel("Node connections")).toContainText(
    `${connections} unique connections`,
  );
  await inspector.getByText("2.1 Nozzle observations", { exact: true }).click();
  await expect(inspector.locator("blockquote")).toHaveText(
    "Existing nozzle records can describe poor coverage or restriction.",
  );
  await expect(inspector).toContainText("unverified");
  await expect(inspector).toContainText("secondary summary");
  await browser.click();
  await page.screenshot({
    path: testInfo.outputPath("mixed-knowledge-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("Knowledge layers").selectOption("reference");
  await expect(page.locator(".learning-case-list button")).toHaveCount(0);
  await browser.click();
  await expect(component).toHaveAttribute("data-node-size", size!);
  await expect(
    page.getByRole("button", { name: /Reference section: 2/ }),
  ).toBeVisible();
  await browser.click();
  await page.getByLabel("Knowledge layers").selectOption("experience");
  await expect(
    page.getByRole("region", { name: "Reference documents" }),
  ).toHaveCount(0);
  await expect(page.locator(".learning-case-list button")).not.toHaveCount(0);
  await page.getByLabel("Knowledge layers").selectOption("all");
  await page.setViewportSize({ width: 375, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("Knowledge layers")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mixed-knowledge-mobile.png"),
    fullPage: true,
  });
});
