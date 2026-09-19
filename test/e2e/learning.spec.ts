import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type { Case, KnowledgeEntry } from "@flowpilot/contracts";

async function act(
  api: APIRequestContext,
  value: Case,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<Case> {
  const response = await api.post(
    `/api/investigations/${value.investigation.id}/actions`,
    { data: { revision: value.revision, action, ...extra } },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function diagnosed(api: APIRequestContext, title: string): Promise<Case> {
  const response = await api.post("/api/investigations", {
    data: { report: title, sample_id: "incomplete" },
  });
  expect(response.ok()).toBeTruthy();
  let value: Case = await response.json();
  for (const answer of ["continuous", "yes", "no", "unknown", "unknown"])
    value = await act(api, value, "answer", {
      question_id: value.next_question!.id,
      value: answer,
    });
  return act(api, value, "diagnose");
}
async function completed(api: APIRequestContext, title: string): Promise<Case> {
  let value = await diagnosed(api, title);
  value = await act(api, value, "inspect", { outcome: "obstruction_found" });
  value = await act(api, value, "confirm_observation", { confirmed: true });
  value = await act(api, value, "complete_action", {
    confirmed: true,
    corrective_action: "nozzle_cleaning",
  });
  const golden = await (await api.get("/api/demo/golden-scenario")).json();
  value = await act(api, value, "verify", {
    sample_id: "normal",
    checks: golden.recovery_checks,
  });
  return act(api, value, "resolve", { confirmed: true });
}
async function review(page: Page, reason: string) {
  await page
    .getByLabel("Reviewer name", { exact: true })
    .fill("Technician Lee");
  await page
    .getByLabel("Review / correction reason", { exact: true })
    .fill(reason);
  await page
    .getByLabel("I reviewed the source evidence and confirm this change.")
    .check();
}

test("learning database publishes, retrieves, corrects and preserves previous citations", async ({
  page,
  request,
}, testInfo) => {
  const prefix = `Learning loop ${Date.now()}`;
  const source = await completed(request, `${prefix} / source`);
  const caseB = await diagnosed(request, `${prefix} / B`);
  const original: KnowledgeEntry = await (
    await request.get(`/api/knowledge/by-source/${source.investigation.id}`)
  ).json();
  expect(original.status).toBe("draft");
  expect(
    caseB.past_experience.matches?.some((m) => m.knowledge_id === original.id),
  ).toBeFalsy();
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(`/knowledge?source=${source.investigation.id}`);
  await expect(
    page.getByRole("heading", { name: "Learning Database", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Experience review" }),
  ).toBeVisible();
  await page.getByLabel("Search database", { exact: true }).fill(prefix);
  await expect(
    page.locator(".learning-graph-stage canvas").first(),
  ).toBeVisible();
  await page
    .getByText("Browse nodes and relationships with keyboard", { exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Finding: Obstruction found/ }),
  ).toBeVisible();
  await page
    .getByText("Browse nodes and relationships with keyboard", { exact: true })
    .click();
  const sourceRecord = page.locator(".learning-case-list button").filter({
    hasText: `${prefix} / source`,
  });
  for (let repeat = 0; repeat < 2; repeat++) {
    await sourceRecord.click();
    await expect(
      page.getByRole("region", { name: "Experience review" }),
    ).toBeVisible();
  }
  await review(page, "Confirmed the action and full recovery evidence.");
  await page
    .getByRole("button", { name: "Confirm & publish", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "New diagnoses can now use" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /matching record groups/ }),
  ).not.toContainText("Updating");
  await expect(
    page.getByLabel("Database totals", { exact: true }),
  ).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath("learning-database-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/?case=${caseB.investigation.id}`);
  await page
    .getByRole("button", { name: "Refresh past experience", exact: true })
    .click();
  const past = page.getByRole("region", { name: "Past experience" });
  await expect(
    past.getByRole("link", { name: original.versions.at(-1)!.content.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Current assessment" }),
  ).toBeInViewport();
  await expect(
    past.getByRole("heading", { name: "Past experience", exact: true }),
  ).toBeInViewport();
  await expect(
    past.getByRole("link", { name: original.versions.at(-1)!.content.title }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Start illustrative inspection" }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("diagnosis-learning-desktop.png"),
  });
  const retained: Case = await (
    await request.get(`/api/investigations/${caseB.investigation.id}`)
  ).json();
  const cited = retained.past_experience.matches!.find(
    (m) => m.knowledge_id === original.id,
  )!;
  expect(cited).toBeTruthy();
  await page.goto(`/knowledge?entry=${original.id}&version=${cited.version}`);
  await review(page, "Interpretation disputed pending material review.");
  await page
    .getByRole("button", { name: "Mark disputed", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Experience review" })
      .getByText("Disputed", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit as new version", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Reusable lesson", exact: true })
    .fill(
      "The historical restriction does not establish the next case's cause. Review material and idle-purge history.",
    );
  await page
    .getByRole("combobox", { name: "Inspection interpretation", exact: true })
    .selectOption("uncertain");
  await page
    .getByRole("combobox", { name: "Check focus", exact: true })
    .selectOption("material_review");
  await review(
    page,
    "Retracted the stronger interpretation; material history is still missing.",
  );
  await page
    .getByRole("button", { name: "Save corrected draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm & publish", exact: true }),
  ).toBeVisible();
  await review(page, "Reviewed the corrected, limited interpretation.");
  await page
    .getByRole("button", { name: "Confirm & publish", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "New diagnoses can now use" }),
  ).toBeVisible();
  const caseC = await diagnosed(request, `${prefix} / C`);
  expect(
    caseC.past_experience.matches!.find((m) => m.knowledge_id === original.id)
      ?.version,
  ).toBe(cited.version + 1);
  expect(caseC.past_experience.suggested_check).toContain("material condition");
  expect(
    await (
      await request.get(`/api/investigations/${caseB.investigation.id}`)
    ).json(),
  ).toEqual(retained);
  await page.goto(`/?case=${caseB.investigation.id}`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Referenced knowledge has changed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh past experience", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Referenced knowledge has changed" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Past experience" }),
  ).toContainText(
    "Earlier diagnostic snapshots retain references that have since changed.",
  );
  await page.goto(`/knowledge?source=${source.investigation.id}`);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole("region", { name: "Experience review" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
  await expect(
    page.getByRole("status").filter({ hasText: /matching record groups/ }),
  ).not.toContainText("Updating");
  await expect(
    page.getByLabel("Database totals", { exact: true }),
  ).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: testInfo.outputPath("learning-database-mobile.png"),
    fullPage: true,
  });
});

test("graph relations can be selected with keyboard and filtering shows a real empty state", async ({
  page,
  request,
}) => {
  const title = `Graph navigation ${Date.now()}`;
  await completed(request, title);
  await page.goto("/knowledge");
  await page.getByLabel("Search database", { exact: true }).fill(title);
  await expect(
    page.getByRole("status").filter({ hasText: "1 matching record groups" }),
  ).toBeVisible();
  await page
    .getByText("Browse nodes and relationships with keyboard", { exact: true })
    .click();
  await page
    .getByRole("button", { name: `Case: ${title}`, exact: true })
    .click();
  // Compare the actual canvas pixels with its legend, including selected-neighborhood styling.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const colors = [...document.querySelectorAll(".node-swatch")].map(
          (element) =>
            getComputedStyle(element)
              .backgroundColor.match(/\d+/g)!
              .slice(0, 3)
              .join(","),
        );
        const unique = new Set(colors);
        const rendered = new Set<string>();
        for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
          ".learning-graph-stage canvas",
        )) {
          const context = canvas.getContext("2d");
          if (!context || !canvas.width || !canvas.height) continue;
          const pixels = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 250) continue;
            const color = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
            if (unique.has(color)) rendered.add(color);
          }
        }
        return { legend: unique.size, rendered: rendered.size };
      }),
    )
    .toEqual({ legend: 7, rendered: 7 });
  const node = page.getByRole("button", {
    name: "Component: DJ-2200 nozzle",
    exact: true,
  });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "DJ-2200 nozzle", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Related investigations", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Search database", { exact: true })
    .fill("definitely nonexistent record");
  await expect(
    page.getByRole("heading", { name: "No records match these filters" }),
  ).toBeVisible();
});
