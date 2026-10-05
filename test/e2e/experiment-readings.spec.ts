import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import type { Incident } from "@flowpilot/contracts";
import type { Group, PerspectiveCamera } from "three";

test("technician readings survive reload, require all steps and return to the investigation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `readings-${randomUUID()}` },
    })
  ).json();
  incident = await (
    await request.post(`/api/incidents/${incident.id}/actions`, {
      data: { action: "analyze", revision: incident.revision },
    })
  ).json();
  await page.goto(`/incidents/${incident.id}/simulation?run=restriction`);
  await expect(
    page.getByRole("progressbar", {
      name: "Fluid-path restriction progress",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuetext", "Finished: 3 of 3 conditions simulated", {
    timeout: 20000,
  });
  await page
    .getByRole("button", { name: "Open playback of Fluid-path restriction" })
    .click();
  const guide = page.getByRole("group", { name: "Step-by-step guide" });
  const annotation = page.locator(".model-reading-annotation");
  const notebook = page.getByRole("region", {
    name: "Technician experiment record",
  });
  await expect(notebook).toContainText("0 of 8 recorded");
  await expect(guide.getByRole("textbox")).toHaveCount(0);
  await expect(annotation).toHaveAttribute(
    "data-anchor-mesh",
    "pressure-regulator",
  );
  // A zero is a measured value. It becomes complete only with quantity and unit.
  await notebook.getByLabel("Measured quantity").fill("Supply pressure");
  await notebook.getByLabel("Measured value", { exact: true }).fill("0");
  await expect(notebook).toContainText("0 of 8 recorded");
  await notebook.getByLabel("Unit", { exact: true }).fill("bar");
  await expect(notebook).toContainText("1 of 8 recorded");
  await page.reload();
  await page
    .getByRole("button", { name: "Open playback of Fluid-path restriction" })
    .click();
  await expect(
    notebook.getByLabel("Measured value", { exact: true }),
  ).toHaveValue("0");
  await expect(notebook.getByLabel("Unit", { exact: true })).toHaveValue("bar");
  // Jump to the end; completion takes the technician to the first missing step.
  await guide.locator(":scope > summary").click();
  await guide.locator("summary").filter({ hasText: "All 8 steps" }).click();
  await guide
    .getByRole("list", { name: "Playback steps" })
    .getByRole("button")
    .last()
    .click();
  await guide.locator(":scope > summary").click();
  await notebook
    .getByRole("button", { name: "Finish experiment & return" })
    .click();
  await expect(guide).toContainText("Step 2 of 8");
  await expect(notebook.getByRole("alert")).toContainText("Step 2");
  await notebook
    .getByLabel("Observations / notes")
    .fill("Bubbles visible in the feed tube.");
  await annotation
    .getByRole("button", { name: "Next step", exact: true })
    .click();
  await expect(annotation).toHaveAttribute("data-anchor-mesh", "qd-seal");
  await expect(annotation).toHaveAttribute("data-located", "true");
  await notebook.getByLabel("Part / O-ring condition").selectOption("damaged");
  await notebook
    .getByLabel("Observations / notes")
    .fill("O-ring split on one side; fluid visible around the seal.");
  await notebook.getByLabel("Observations / notes").press("ArrowLeft");
  await expect(guide).toContainText("Step 3 of 8");
  const anchorError = () =>
    page.evaluate(() => {
      const { state } = (
        window as unknown as {
          __flowpilotScene: {
            state: { parts: Group; camera: PerspectiveCamera };
          };
        }
      ).__flowpilotScene;
      const mesh = state.parts.getObjectByName("qd-seal")!;
      const point = mesh
        .localToWorld(state.camera.position.clone().set(0.126, 0, 0))
        .project(state.camera);
      const layer = document.querySelector<HTMLElement>(
        ".model-reading-annotation",
      )!;
      const dot = layer.querySelector("circle")!;
      return Math.hypot(
        Number(dot.getAttribute("cx")) -
          (point.x * 0.5 + 0.5) * layer.clientWidth,
        Number(dot.getAttribute("cy")) -
          (-point.y * 0.5 + 0.5) * layer.clientHeight,
      );
    });
  await expect.poll(anchorError).toBeLessThan(1);
  const beforeOrbit = await annotation.locator("circle").getAttribute("cx");
  await page.getByRole("button", { name: "Orbit right", exact: true }).click();
  await expect
    .poll(() => annotation.locator("circle").getAttribute("cx"))
    .not.toBe(beforeOrbit);
  await expect.poll(anchorError).toBeLessThan(1);
  await expect(notebook.getByLabel("Observations / notes")).toHaveValue(
    "O-ring split on one side; fluid visible around the seal.",
  );
  await notebook.getByLabel("Part / O-ring condition").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("experiment-o-ring-desktop.png"),
  });
  // The same record remains usable on a narrow screen.
  await page.setViewportSize({ width: 375, height: 812 });
  await notebook.getByLabel("Observations / notes").scrollIntoViewIfNeeded();
  await expect(notebook.getByLabel("Observations / notes")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("experiment-o-ring-mobile.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (let i = 3; i < 8; i++) {
    await annotation
      .getByRole("button", { name: "Next step", exact: true })
      .click();
    await notebook
      .getByLabel("Observations / notes")
      .fill(
        `Step ${i + 1}: technician observation, no additional measurement available.`,
      );
  }
  await expect(notebook).toContainText("8 of 8 recorded");
  await expect(notebook.getByLabel("Record source")).toHaveValue("observed");
  // A failed save must keep every entry and allow a retry.
  await page.route(
    `**/api/incidents/${incident.id}/actions`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Storage temporarily unavailable." }),
      }),
    { times: 1 },
  );
  await notebook
    .getByRole("button", { name: "Finish experiment & return" })
    .click();
  await expect(notebook.getByRole("alert")).toHaveText(
    "Storage temporarily unavailable.",
  );
  await expect(notebook).toContainText("8 of 8 recorded");
  await notebook
    .getByRole("button", { name: "Finish experiment & return" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/incidents/${incident.id}/investigation\\?finding=OBS-`),
  );
  const discovery = page.getByRole("region", { name: "New experiment branch" });
  await expect(discovery).toHaveAttribute("data-phase", "complete");
  await expect(discovery).toContainText(
    "8 steps recorded · technician observations",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(
      '.stage-measurement[data-discovery="complete"] .flowchart-shape',
    ),
  ).toHaveCSS("animation-name", "none");
  await discovery.getByRole("button", { name: "Review result" }).click();
  const record = page.getByRole("dialog", { name: "Fluid-path restriction" });
  await expect(record).toContainText("Supply pressure: 0 bar");
  await expect(record).toContainText("Damaged / broken");
  await expect(record).toContainText("O-ring split on one side");
  await expect(record).toContainText("Observed / measured on equipment");
  await expect(record.getByRole("listitem")).toHaveCount(8);
  await record.screenshot({
    path: testInfo.outputPath("experiment-record.png"),
  });
  await record.getByRole("button", { name: "Continue investigation" }).click();
  const node = page.locator(".stage-measurement.flowchart-node");
  await expect(node).toHaveCount(1);
  await node.getByRole("button").click();
  await expect(record).toBeVisible();
  await page.reload();
  await expect(record).toContainText("Supply pressure: 0 bar");
  const saved: Incident = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  const observations =
    saved.observations?.filter((item) => item.experiment) ?? [];
  expect(observations).toHaveLength(1);
  expect(observations[0].synthetic).toBe(false);
  expect(observations[0].experiment?.steps).toHaveLength(8);
});

for (const [mechanism, title] of [
  ["unstable_delivery", "Unstable fluid delivery"],
  ["material_condition", "Material-condition change"],
]) {
  test(`demo fill and undo at model annotations: ${mechanism}`, async ({
    page,
    request,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({
      reducedMotion:
        mechanism === "material_condition" ? "no-preference" : "reduce",
    });
    const incident: Incident = await (
      await request.post("/api/incidents/replay", {
        data: { trigger_id: `demo-fill-${randomUUID()}` },
      })
    ).json();
    await request.post(`/api/incidents/${incident.id}/actions`, {
      data: { action: "analyze", revision: incident.revision },
    });
    await page.goto(`/incidents/${incident.id}/simulation?run=${mechanism}`);
    await page
      .getByRole("button", { name: `Open playback of ${title}` })
      .click();
    const annotation = page.locator(".model-reading-annotation");
    const notebook = page.getByRole("region", {
      name: "Technician experiment record",
    });
    await notebook
      .getByLabel("Observations / notes")
      .fill("Keep my original note.");
    await notebook.getByRole("button", { name: "Fill demo values" }).click();
    await expect(notebook).toContainText("8 of 8 recorded");
    await expect(
      notebook.getByLabel("Measured value", { exact: true }),
    ).toHaveValue("2.4");
    await notebook.getByRole("button", { name: "Undo demo fill" }).click();
    await expect(notebook).toContainText("1 of 8 recorded");
    await expect(notebook.getByLabel("Observations / notes")).toHaveValue(
      "Keep my original note.",
    );
    await expect(
      notebook.getByLabel("Measured value", { exact: true }),
    ).toHaveValue("");
    await notebook.getByRole("button", { name: "Fill demo values" }).click();
    await page.reload();
    await page
      .getByRole("button", { name: `Open playback of ${title}` })
      .click();
    await expect(notebook).toContainText("Demo presets loaded for all 8 steps");
    for (let i = 1; i < 8; i++) {
      await annotation
        .getByRole("button", { name: "Next step", exact: true })
        .click();
      if (i === 2) {
        await expect(annotation).toHaveAttribute(
          "data-anchor-mesh",
          "lid-o-ring",
        );
        await expect(annotation).toHaveAttribute("data-located", "true");
        await notebook
          .getByRole("button", { name: "Fill demo values" })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath("demo-annotation.png"),
        });
      }
      if (i === 3) {
        await expect(
          notebook.getByLabel("Measured value", { exact: true }),
        ).toHaveValue(mechanism === "material_condition" ? "27.5" : "1.8");
        await page
          .getByRole("button", { name: "2D schematic", exact: true })
          .click();
        await expect(
          notebook.getByLabel("Measured value", { exact: true }),
        ).toHaveValue(mechanism === "material_condition" ? "27.5" : "1.8");
        await page
          .getByRole("button", { name: "3D assembly", exact: true })
          .click();
      }
    }
    // Filling from the final step must populate its visible fields as well.
    await notebook.getByLabel("Observations / notes").fill("");
    await notebook.getByLabel("Measured quantity").fill("");
    await notebook.getByLabel("Measured value", { exact: true }).fill("");
    await notebook.getByLabel("Unit", { exact: true }).fill("");
    await notebook.getByLabel("Observed condition").selectOption("");
    await expect(notebook).toContainText("7 of 8 recorded");
    await notebook.getByRole("button", { name: "Fill demo values" }).click();
    await expect(notebook.getByLabel("Measured quantity")).toHaveValue(
      "Final deposit mass",
    );
    await expect(
      notebook.getByLabel("Measured value", { exact: true }),
    ).toHaveValue("0.42");
    await expect(notebook.getByLabel("Unit", { exact: true })).toHaveValue("g");
    await expect(notebook.getByLabel("Observed condition")).toHaveValue(
      "abnormal",
    );
    await expect(notebook.getByLabel("Observations / notes")).toHaveValue(
      /Demo: reduced flow and an uneven deposit/,
    );
    await expect(notebook).toContainText("8 of 8 recorded");
    await expect(notebook.getByLabel("Record source")).toHaveValue("practice");
    await expect(notebook.getByLabel("Record source")).toBeDisabled();
    await notebook
      .getByRole("button", { name: "Finish experiment & return" })
      .click();
    const discovery = page.getByRole("region", {
      name: "New experiment branch",
    });
    if (mechanism === "material_condition") {
      await expect(discovery).toHaveAttribute("data-phase", "revealing");
      await expect(
        page.locator(".stage-measurement[data-discovery] .flowchart-shape"),
      ).toHaveCSS("animation-name", "experiment-result-arrive");
    }
    await expect(discovery).toHaveAttribute("data-phase", "complete");
    await expect(discovery).toContainText(
      "8 steps recorded · practice entries",
    );
    await discovery.getByRole("button", { name: "Review result" }).click();
    const record = page.getByRole("dialog", { name: title });
    await expect(record).toContainText("Practice / synthetic entries");
    await expect(record).toContainText("Deposit mass: 0.42 g");
    await expect(record).toContainText("Final deposit mass: 0.42 g");
    const saved: Incident = await (
      await request.get(`/api/incidents/${incident.id}`)
    ).json();
    const observations =
      saved.observations?.filter((item) => item.experiment) ?? [];
    expect(observations).toHaveLength(1);
    expect(observations[0].synthetic).toBe(true);
    expect(observations[0].experiment?.steps).toHaveLength(8);
  });
}
