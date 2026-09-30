import { openDisclosure } from "../helpers/disclosures";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

async function diagnosed(request: APIRequestContext, page: Page) {
  const created = await request.post("/api/investigations", {
    data: { report: "Synthetic viewer regression", sample_id: "incomplete" },
  });
  let value = await created.json();
  const url = `/api/investigations/${value.investigation.id}`;
  for (const answer of ["continuous", "yes", "no", "unknown", "unknown"]) {
    const response = await request.post(`${url}/actions`, {
      data: {
        action: "answer",
        revision: value.revision,
        question_id: value.next_question.id,
        value: answer,
      },
    });
    expect(response.ok()).toBeTruthy();
    value = await response.json();
  }
  const response = await request.post(`${url}/actions`, {
    data: { action: "diagnose", revision: value.revision },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto(`/?case=${value.investigation.id}`);
  await expect(
    page.getByRole("heading", { name: "Ranked causes" }),
  ).toBeVisible();
  return url;
}

test("rejected image evidence has its own recovery state after reload", async ({
  page,
  request,
}) => {
  const url = await diagnosed(request, page);
  const row = page.locator(".prototype-ledger-row").filter({
    has: page.getByRole("heading", {
      name: "incomplete coverage",
      exact: true,
    }),
  });
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  await row.getByText("Correct this evidence", { exact: true }).click();
  await row.getByLabel("Correction reason").fill("Invalid image evidence");
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("heading", { name: "Image evidence rejected" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Image evidence rejected" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Start a new case with a valid image sample",
    }),
  ).toHaveAttribute("href", "/legacy");
  await expect(
    page.getByRole("heading", { name: "Inspection recorded" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Material review is the next handoff", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start illustrative inspection" }),
  ).toHaveCount(0);
  const saved = await (await request.get(url)).json();
  expect(saved.recommendation).toBe(null);
  expect(
    saved.investigation.evidence.some(
      (e: { key: string }) => e.key === "inspection",
    ),
  ).toBe(false);
});

test("ranking and specialist citations reveal and focus evidence through both filters", async ({
  page,
  request,
}) => {
  const url = await diagnosed(request, page);
  const saved = await (await request.get(url)).json();
  const evidenceId = (key: string) =>
    saved.investigation.evidence.find((e: { key: string }) => e.key === key).id;
  const imageId = evidenceId("incomplete_coverage");
  const answerId = evidenceId("continuous");
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  await openDisclosure(page.locator(".prototype-cause summary").first());
  await page.getByLabel("Evidence source").selectOption("technician_input");
  await page.getByLabel("Evidence status").selectOption("verified");
  await page.locator(`.prototype-cause a[href="#${imageId}"]`).first().click();
  await expect(page.locator(`[id="${imageId}"]`)).toBeFocused();
  await expect(page.getByLabel("Evidence source")).toHaveValue("all");
  await expect(page.getByLabel("Evidence status")).toHaveValue("all");
  await openDisclosure(
    page.getByText("How this diagnosis was generated", { exact: true }),
  );
  const finding = page.locator(".reasoning-disclosure > details").filter({
    has: page.locator("summary", {
      hasText: "fluid path specialist · fluid supply fault",
    }),
  });
  await finding.locator(":scope > summary").click();
  for (const [id, source, status] of [
    [imageId, "technician_input", "verified"],
    [answerId, "synthetic_image_measurement", "provisional"],
  ]) {
    await page.getByLabel("Evidence source").selectOption(source);
    await page.getByLabel("Evidence status").selectOption(status);
    await finding.locator(`a[href="#${id}"]`).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(`[id="${id}"]`)).toBeFocused();
    await expect(page.getByLabel("Evidence source")).toHaveValue("all");
    await expect(page.getByLabel("Evidence status")).toHaveValue("all");
  }
});

test("editing evidence invalidates the old branch and filters retained history", async ({
  page,
  request,
}) => {
  await diagnosed(request, page);
  const row = page.locator(".prototype-ledger-row").filter({
    has: page.getByRole("heading", { name: "frequency", exact: true }),
  });
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  await row.getByText("Correct this evidence", { exact: true }).click();
  await row.getByLabel("Correction type").selectOption("edit");
  await row.getByLabel("Replacement value").selectOption("intermittent");
  await row
    .getByLabel("Correction reason")
    .fill("Normal dots return between trays");
  await expect(
    row.getByRole("button", { name: "Save correction" }),
  ).toBeDisabled();
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Does flux weight pass despite blobs or droplets?",
    }),
  ).toBeVisible();
  for (const answer of [
    "Yes",
    "Stable / no known change",
    "Not recorded",
    "Not recorded",
  ]) {
    await page.getByRole("button", { name: answer, exact: true }).click();
  }
  await page.getByRole("button", { name: "Diagnose case" }).click();
  await expect(
    page.getByRole("heading", { name: "1. Coaxial-air / atomization fault" }),
  ).toBeVisible();
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  await page.getByLabel("Evidence status").selectOption("rejected");
  await expect(page.locator(".prototype-ledger-row")).toHaveCount(5);
  await expect(
    page.getByText("Correct this evidence", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "1. Coaxial-air / atomization fault" }),
  ).toBeVisible();
  await page.getByText("Case timeline · saved history").click();
  await expect(page.locator(".prototype-timeline")).toContainText(
    "Normal dots return between trays",
  );
});

test("3D highlights, camera controls, playback and final confirmation stay synchronized", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  await diagnosed(request, page);
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  const canvas = page.locator(".assembly-canvas");
  await expect(canvas.locator("canvas")).toBeVisible();
  await expect(canvas).toHaveAttribute("data-node-id", "substrate_tray");
  await expect(
    page.getByRole("button", { name: "Obstruction found", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Play guide" }).click();
  await expect(page.getByRole("button", { name: "Pause guide" })).toBeVisible();
  await page.getByRole("button", { name: "Orbit left" }).click();
  await expect(page.getByRole("button", { name: "Play guide" })).toBeVisible();
  for (const control of [
    "Pan up",
    "Pan down",
    "Zoom in",
    "Zoom out",
    "Orbit right",
    "Reset view",
  ]) {
    await page.getByRole("button", { name: control, exact: true }).click();
  }
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-node-id", "bfs_bottle");
  await expect(canvas).toHaveAttribute(
    "data-camera-preset",
    "assembly_overview",
  );
  await page.screenshot({
    path: testInfo.outputPath("m2-desktop-3d.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Play guide" }).click();
  await expect(canvas).toHaveAttribute("data-node-id", "dj2200_valve", {
    timeout: 18000,
  });
  await expect(page.getByRole("button", { name: "Play guide" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Confirm observation" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Previous step", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-node-id", "nozzle");
  await page.getByRole("button", { name: "Use 2D view" }).click();
  await expect(
    page.getByRole("img", {
      name: "Dispensing assembly. Highlighted part: Nozzle",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use 3D view" }).click();
  await expect(canvas.locator("canvas")).toBeVisible();
});

test("reduced motion and mobile keep keyboard and 2D alternatives", async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await diagnosed(request, page);
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(page.locator(".assembly-canvas")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  await expect(page.getByRole("button", { name: "Play guide" })).toBeDisabled();
  await page.getByRole("button", { name: "Next step", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".assembly-canvas")).toHaveAttribute(
    "data-node-id",
    "bfs_bottle",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("m2-mobile-3d.png"),
    fullPage: true,
  });
});

test("WebGL context loss preserves step and observation gates", async ({
  page,
  request,
}) => {
  await diagnosed(request, page);
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(page.locator(".assembly-canvas canvas")).toBeVisible();
  await page.locator(".assembly-canvas canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  await expect(
    page.getByRole("status").filter({ hasText: "3D unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Dispensing assembly. Highlighted part: Substrate tray",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Obstruction found", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.locator('svg [data-node-id="bfs_bottle"]')).toHaveAttribute(
    "data-highlighted",
    "true",
  );
});

test("unavailable WebGL and unknown semantic mappings use the fallback", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  const url = await diagnosed(request, page);
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "3D unavailable" }),
  ).toBeVisible();
  await page.route(`**${url}`, async (route) => {
    const response = await route.fetch();
    const value = await response.json();
    value.procedure[0].model_node_id = "unknown_node";
    await route.fulfill({ json: value });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  await expect(
    page.getByText("Diagram unavailable for this part", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Text alternative", { exact: true }),
  ).toBeVisible();
});

test("negative confirmation locks correction controls after reload", async ({
  page,
  request,
}) => {
  const url = await diagnosed(request, page);
  let value = await (await request.get(url)).json();
  value = await (
    await request.post(`${url}/actions`, {
      data: {
        action: "inspect",
        revision: value.revision,
        outcome: "no_obstruction_found",
      },
    })
  ).json();
  const response = await request.post(`${url}/actions`, {
    data: {
      action: "confirm_observation",
      revision: value.revision,
      confirmed: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.reload();
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  await openDisclosure(
    page.getByText("Inspection rationale and procedure details", {
      exact: true,
    }),
  );
  await expect(
    page.getByText("Evidence is locked after confirmed inspection", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Correct this evidence", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Air-cap and pressure-supply checks",
    }),
  ).toBeVisible();
});

test("correction before confirmation cancels the pending observation", async ({
  page,
  request,
}) => {
  await diagnosed(request, page);
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  while (
    await page
      .getByRole("button", { name: "Next step", exact: true })
      .isEnabled()
  ) {
    await page.getByRole("button", { name: "Next step", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Obstruction found", exact: true })
    .click();
  await page
    .getByText("Review or correct evidence before confirming", { exact: true })
    .click();
  const row = page.locator(".prototype-ledger-row").filter({
    has: page.getByRole("heading", { name: "operator report", exact: true }),
  });
  await openDisclosure(page.locator(".diagnosis-disclosure > summary"));
  await row.getByText("Correct this evidence", { exact: true }).click();
  await row.getByLabel("Correction type").selectOption("edit");
  await row
    .getByLabel("Replacement value")
    .fill("Revised synthetic operator report");
  await row
    .getByLabel("Correction reason")
    .fill("Clarified the report before confirmation");
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("button", { name: "Start illustrative inspection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm observation" }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".prototype-ledger-row")
      .filter({ hasText: "Revised synthetic operator report" }),
  ).toHaveCount(1);
});
