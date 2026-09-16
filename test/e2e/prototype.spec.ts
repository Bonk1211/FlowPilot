import { expect, test, type Page } from "@playwright/test";
import golden from "../../fixtures/v1/golden-scenario.json" with { type: "json" };
import { cameraPresets, modelNodes } from "../../apps/web/src/prototype/model";

async function reachDiagnosis(page: Page, intermittent = false) {
  await page.goto("/prototype");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
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
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

async function inspect(page: Page) {
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(
    page.getByRole("button", { name: "Obstruction found", exact: true }),
  ).toBeDisabled();
  for (const [index, step] of golden.procedure_steps.entries()) {
    if (index)
      await page
        .getByRole("button", { name: "Next step", exact: true })
        .click();
    await expect(page.locator('g[data-highlighted="true"]')).toHaveAttribute(
      "data-node-id",
      step.model_node_id,
    );
    await expect(
      page.getByRole("heading", { name: step.title, exact: true }),
    ).toBeVisible();
  }
}

test("semantic assembly and camera contracts cover every procedure step", () => {
  expect(Object.keys(modelNodes)).toHaveLength(7);
  for (const step of golden.procedure_steps) {
    expect(modelNodes).toHaveProperty(step.model_node_id);
    expect(cameraPresets).toHaveProperty(step.camera_preset);
  }
});

test("positive journey preserves confirmation, action, verification and reset gates", async ({
  page,
}) => {
  await reachDiagnosis(page);
  await inspect(page);
  await page
    .getByRole("button", { name: "Obstruction found", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm demo observation" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm demo observation" }).click();
  await expect(
    page.getByRole("button", { name: "Record simulated action complete" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Record simulated action complete" })
    .click();
  await page
    .getByRole("button", { name: "Run simulated verification" })
    .click();
  await expect(
    page.getByText("Verification passed · case ready to resolve"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resolve demo case" }).click();
  await expect(
    page.getByRole("heading", { name: "Review the completed case" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart prototype" }).click();
  await expect(
    page.getByRole("heading", { name: "Review the reported defect" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toBeDisabled();
});

test("negative branch stays open and changes the recommendation", async ({
  page,
}) => {
  await reachDiagnosis(page, true);
  await inspect(page);
  await page
    .getByRole("button", { name: "No obstruction found", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "1. Material viscosity change" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Review material temperature and viscosity",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Case remains open/)).toBeVisible();
  await page.getByText("Snapshot timeline · precomputed", { exact: true }).click();
  const timelineEntries = page.locator(".prototype-timeline li");
  const count = await timelineEntries.count();
  await expect(timelineEntries.nth(count - 2)).toContainText(
    "Inspection completed; no obstruction found.",
  );
  await expect(timelineEntries.nth(count - 2)).toBeVisible();
  await expect(timelineEntries.nth(count - 1)).toContainText(
    "diagnosing — A clear path changes the next check",
  );
  await expect(timelineEntries.nth(count - 1)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resolve demo case" }),
  ).toHaveCount(0);
});

test("an unavailable model node retains accessible procedure instructions", async ({
  page,
}) => {
  await page.route("**/api/demo/golden-scenario", async (route) => {
    const fixture = structuredClone(golden);
    fixture.procedure_steps[0].model_node_id = "unavailable_part";
    await route.fulfill({ json: fixture });
  });
  await reachDiagnosis(page);
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(
    page.getByText(/Diagram unavailable for this part/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Locate the dispensing assembly" }),
  ).toBeVisible();
  await expect(page.locator('g[data-highlighted="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.locator('g[data-highlighted="true"]')).toHaveAttribute(
    "data-node-id",
    "service_cartridge",
  );
});

for (const width of [1440, 1280, 375]) {
  test(`offline prototype and diagram remain usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 720 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/demo/golden-scenario", (route) => route.abort());
    await reachDiagnosis(page);
    await expect(page.getByText(/Offline mode/)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("diagnosis.png"),
      fullPage: true,
    });
    await inspect(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("inspection.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Previous step", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('g[data-highlighted="true"]')).toHaveAttribute(
      "data-node-id",
      "service_cartridge",
    );
  });
}
