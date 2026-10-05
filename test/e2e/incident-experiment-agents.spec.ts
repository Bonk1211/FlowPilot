import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";
import type { Incident, IncidentExperiment } from "@flowpilot/contracts";
import type { Group, PerspectiveCamera, WebGLRenderer } from "three";
import { partAnnotations } from "../../apps/web/src/scene/shots";

type Act = (command: Record<string, unknown>) => Promise<void>;

async function incidentWith(request: APIRequestContext, answers: string[]) {
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `experiment-agents-${randomUUID()}` },
    })
  ).json();
  const act: Act = async (command) => {
    const response = await request.post(
      `/api/incidents/${incident.id}/actions`,
      { data: { revision: incident.revision, ...command } },
    );
    expect(response.ok()).toBeTruthy();
    incident = await response.json();
  };
  await act({ action: "analyze" });
  for (const choice of answers)
    await act({
      action: "answer_investigation",
      node_id: incident.investigation!.active_node_id,
      answer_id: `ANS-${randomUUID()}`,
      choice,
    });
  return { incident: () => incident, act };
}

const plans = async (request: APIRequestContext, id: string) =>
  (await (
    await request.get(`/api/incidents/${id}/experiments`)
  ).json()) as IncidentExperiment[];

const lab = (page: Page) =>
  page.getByRole("region", { name: "Experiments", exact: true });
const tracks = (page: Page) =>
  page.getByRole("list", { name: "Experiment tracks", exact: true });
const titles = [
  "Fluid-path restriction",
  "Unstable fluid delivery",
  "Material-condition change",
];
const progress = (page: Page, title: string) =>
  lab(page).getByRole("progressbar", {
    name: `${title} progress`,
    exact: true,
  });
const offer = (page: Page) =>
  page.getByRole("complementary", { name: "Suggested experiments" });

async function captureModel(scene: Locator, path?: string) {
  // The canvas fills the stage, so hide floating controls only for model comparisons.
  return scene.screenshot({
    path,
    style:
      ".guided-topbar, .guided-auxiliary, .guided-console, .assembly-camera-tools, .guided-shot, .guided-legend, .incident-feature-sidebar { visibility: hidden !important; }",
  });
}

async function frameDifference(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(
    async (images) => {
      const frames = await Promise.all(
        images.map(async (source) => {
          const image = new Image();
          image.src = source;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, canvas.width, canvas.height).data;
        }),
      );
      if (frames[0].length !== frames[1].length) return 255;
      return frames[0].reduce(
        (max, value, index) =>
          Math.max(max, Math.abs(value - frames[1][index])),
        0,
      );
    },
    [before, after].map(
      (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
    ),
  );
}

async function runFromInvestigation(page: Page, id: string) {
  await page.goto(`/incidents/${id}/investigation`);
  await offer(page)
    .getByRole("button", { name: "Run all three experiments" })
    .click();
}

async function finished(page: Page, which = titles) {
  for (const title of which)
    await expect(progress(page, title)).toHaveAttribute(
      "aria-valuetext",
      "Finished: 3 of 3 conditions simulated",
      { timeout: 20000 },
    );
}

async function chooseStep(playback: Locator, index: number) {
  const steps = playback.getByRole("list", { name: "Playback steps" });
  if (!(await steps.isVisible()))
    await playback
      .locator("summary")
      .filter({ hasText: /^All \d+ steps$/ })
      .click();
  await steps.getByRole("button").nth(index).click();
}

async function expectFloatingPanels(playback: Locator) {
  const viewport = playback.locator(".guided-viewport");
  // The renderer must retain the whole stage behind every console.
  await expect
    .poll(async () => {
      const stage = await viewport.boundingBox();
      const canvas = await viewport.locator("canvas").boundingBox();
      if (!stage || !canvas) return Infinity;
      return Math.max(
        ...(["x", "y", "width", "height"] as const).map((key) =>
          Math.abs(stage[key] - canvas[key]),
        ),
      );
    })
    .toBeLessThanOrEqual(1);
  const stage = (await viewport.boundingBox())!;
  for (const panel of await playback
    .locator(".guided-console, .guided-auxiliary")
    .all()) {
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(stage.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
  }
  expect(
    await viewport.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
}

test("the three experiments are offered only when the answers leave explanations open", async ({
  page,
  request,
}) => {
  const lead = await incidentWith(request, ["intermittent"]);
  await page.goto(`/incidents/${lead.incident().id}/investigation`);
  await expect(page.locator(".flowchart-node.is-active")).toHaveCount(1);
  await expect(offer(page)).toHaveCount(0);

  const ready = await incidentWith(request, ["intermittent", "unstable"]);
  await page.goto(`/incidents/${ready.incident().id}/investigation`);
  await expect(offer(page)).toBeVisible();
  const items = offer(page).getByRole("listitem");
  await expect(items).toHaveCount(3);
  for (const title of [
    "Fluid-path restriction",
    "Unstable fluid delivery",
    "Material-condition change",
  ])
    await expect(items.filter({ hasText: title })).toHaveCount(1);
  await expect(offer(page)).toContainText("Simulated · no machine test");
  await expect(offer(page)).toContainText("not recorded evidence");

  await ready.act({
    action: "escalate",
    notes: "Engineer review requested before any experiment.",
  });
  await page.reload();
  await expect(page.locator(".flowchart-node.is-active")).toHaveCount(1);
  await expect(offer(page)).toHaveCount(0);
});

test("each suggested experiment explains why it runs, what it tests, what the model predicts and how to read it", async ({
  page,
  request,
}) => {
  const ready = await incidentWith(request, ["intermittent", "unstable"]);
  await page.goto(`/incidents/${ready.incident().id}/investigation`);
  const row = offer(page).getByRole("button", {
    name: /Fluid-path restriction.*steady, straight decline/,
  });
  await expect(row).toHaveAttribute("aria-haspopup", "dialog");
  await row.focus();
  await page.keyboard.press("Enter");
  const body = page.getByRole("dialog", { name: "Fluid-path restriction" });
  await expect(body).toBeVisible();
  for (const heading of [
    "Why run it",
    "What it tests",
    "What we predict",
    "How to read the result",
  ])
    await expect(body.getByRole("term")).toContainText([heading]);
  await expect(body).toContainText(
    "Falling coverage fits all 3 open explanations",
  );
  await expect(body).toContainText(
    "Your confirmed answer says the defect is intermittent.",
  );
  await expect(body).toContainText(
    "Mass falls in a straight line along the sequence, from 1.00 to 0.48 at severity 0.80",
  );
  await expect(body).toContainText("Dimensionless; not a measurement.");
  await expect(
    body.getByRole("img", {
      name: /Predicted shape: a steady, straight decline/,
    }),
  ).toBeVisible();
  await expect(body).toContainText("Consistent with the records:");
  await expect(body).toContainText("Not distinguishable:");
  await expect(body).toContainText(
    "A simulation cannot confirm a cause or say which explanation is most likely.",
  );
  await expect(body).not.toContainText(/root cause is|confirmed cause/i);
  // Native modal focus stays inside the popup and returns to the entry on Escape.
  await body
    .getByRole("button", {
      name: "Run this experiment: Fluid-path restriction",
    })
    .focus();
  await page.keyboard.press("Tab");
  await expect(
    body.getByRole("button", { name: "Close experiment description" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    body.getByRole("button", {
      name: "Run this experiment: Fluid-path restriction",
    }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(body).toHaveCount(0);
  await expect(row).toBeFocused();

  const material = offer(page).getByRole("button", {
    name: /Material-condition change/,
  });
  await material.click();
  await expect(
    page
      .getByRole("dialog", { name: "Material-condition change" })
      .getByText(/Mass falls quickly at first and then more slowly/),
  ).toBeVisible();
});

test("the experiment popup fits a phone, keeps Run visible and closes from the backdrop", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await page.goto(`/incidents/${source.incident().id}/investigation`);
  const trigger = offer(page).getByRole("button", {
    name: /^Unstable fluid delivery/,
  });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Unstable fluid delivery" });
  await expect(popup).toBeVisible();
  const bounds = (await popup.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.y).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(382);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(836);
  expect(
    await popup.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const run = popup.getByRole("button", {
    name: "Run this experiment: Unstable fluid delivery",
  });
  await expect(run).toBeInViewport();
  await popup.locator(".experiment-brief-body").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(run).toBeInViewport();
  await popup.screenshot({
    path: testInfo.outputPath("experiment-popup-mobile.png"),
  });
  await page.mouse.click(2, 2);
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await plans(request, source.incident().id)).toHaveLength(0);
});

test("one press runs the three experiments at once, each as its own approved plan, and changes nothing recorded", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const before = source.incident();
  // Hold the run requests open so the in-flight state can be inspected.
  await page.route("**/experiments/*/run", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await runFromInvestigation(page, before.id);
  await expect(lab(page)).toBeVisible();
  // All three are in flight together, each at its own real stage.
  for (const title of titles)
    await expect(progress(page, title)).toHaveAttribute(
      "aria-valuetext",
      /Simulating: 0 of 3 conditions saved/,
      { timeout: 10000 },
    );
  await expect(lab(page).getByRole("status").first()).toContainText(
    "3 running · 0 of 3 finished",
  );
  for (const item of await tracks(page).locator(":scope > li").all())
    await expect(item).toContainText(/Simulating/);
  await expect(
    page.getByText(
      "Experiment playback becomes available when the first experiment finishes.",
    ),
  ).toBeVisible();
  await lab(page).screenshot({
    path: testInfo.outputPath("lab-running.png"),
  });

  await finished(page);
  await expect(page).toHaveURL(
    /\/simulation\?plan=DOE-[0-9a-f]+,DOE-[0-9a-f]+,DOE-[0-9a-f]+$/,
  );
  for (const title of titles)
    await expect(
      tracks(page).locator(":scope > li").filter({ hasText: title }),
    ).toContainText("Approved by demo:engineer");
  await expect(lab(page)).toContainText(
    "Simulated results cannot rank causes or become evidence",
  );
  await expect(
    lab(page).locator('.incident-status[data-status="observed"]'),
  ).toHaveCount(0);
  await lab(page).screenshot({
    path: testInfo.outputPath("lab-finished.png"),
  });

  // One plan per mechanism, each with its approval recorded; the investigation is untouched.
  const saved = await plans(request, before.id);
  expect(saved.map((plan) => plan.proposal.hypothesis_ids).sort()).toEqual([
    ["material_condition"],
    ["restriction"],
    ["unstable_delivery"],
  ]);
  for (const plan of saved) {
    expect(plan.status).toBe("completed");
    expect(plan.matrix).toHaveLength(3);
    expect(plan.approved_by).toBe("demo:engineer");
    expect(plan.history.map((event) => event.action)).toEqual([
      "propose",
      "approve",
      "start",
      "complete",
    ]);
  }
  const after: Incident = await (
    await request.get(`/api/incidents/${before.id}`)
  ).json();
  expect(after.observations ?? []).toHaveLength(
    (before.observations ?? []).length,
  );
  expect(after.evidence ?? []).toHaveLength((before.evidence ?? []).length);
  expect(
    after.assessment!.hypotheses.map((item) => [item.id, item.status]),
  ).toEqual(
    before.assessment!.hypotheses.map((item) => [item.id, item.status]),
  );
});

test("experiments can also run one at a time, from the investigation or the lab", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const id = source.incident().id;
  await page.goto(`/incidents/${id}/investigation`);
  await offer(page)
    .getByRole("button", { name: /Fluid-path restriction/ })
    .click();
  await page
    .getByRole("dialog", { name: "Fluid-path restriction" })
    .getByRole("button", {
      name: "Run this experiment: Fluid-path restriction",
    })
    .click();
  await expect(page).toHaveURL(/\/simulation\?(run=restriction|plan=DOE-)/);
  await finished(page, ["Fluid-path restriction"]);
  for (const title of titles.slice(1))
    await expect(progress(page, title)).toHaveAttribute(
      "aria-valuetext",
      "Not run yet",
    );
  expect(await plans(request, id)).toHaveLength(1);

  await tracks(page)
    .getByRole("button", { name: "Run: Material-condition change" })
    .click();
  await finished(page, ["Fluid-path restriction", "Material-condition change"]);
  await expect(progress(page, "Unstable fluid delivery")).toHaveAttribute(
    "aria-valuetext",
    "Not run yet",
  );
  expect(
    (await plans(request, id)).map((plan) => plan.proposal.hypothesis_ids[0]),
  ).toEqual(expect.arrayContaining(["restriction", "material_condition"]));
  await expect(page).toHaveURL(/plan=DOE-[0-9a-f]+,DOE-[0-9a-f]+$/);
  await page.reload();
  await finished(page, ["Fluid-path restriction", "Material-condition change"]);
  await lab(page)
    .getByRole("button", { name: "Run unstable fluid delivery" })
    .click();
  await finished(page);
  expect(await plans(request, id)).toHaveLength(3);
});

test("reloading or asking again never runs a second plan", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const id = source.incident().id;
  await runFromInvestigation(page, id);
  await finished(page);
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  await expect(playback.locator(".guided-counter")).toHaveText("Step 1 of 12");
  await page
    .getByRole("button", { name: "Experiment playback", exact: true })
    .click();
  await expect(playback.locator(".guided-counter")).toHaveText("Step 1 of 8");
  await page.reload();
  await finished(page);
  // Saved plan links always open the shared tour, including incidents created before it.
  await expect(playback).toHaveAttribute("data-reference", "true");
  await expect(playback.locator(".guided-counter")).toHaveText("Step 1 of 12");
  await chooseStep(playback, 5);
  await expect(
    playback.locator('.assembly-label[data-part-id="piston"]'),
  ).toHaveAttribute("data-shown", "true");
  await page
    .getByRole("button", { name: "Experiment playback", exact: true })
    .click();
  await expect(playback.locator(".guided-counter")).toHaveText("Step 1 of 8");
  await page
    .getByRole("button", { name: "Assembly tour", exact: true })
    .click();
  await expect(playback.locator(".guided-counter")).toHaveText("Step 1 of 12");
  expect(await plans(request, id)).toHaveLength(3);
  // Asking for the same runs again finds the same plans, not new ones.
  await page.goto(`/incidents/${id}/simulation?run=all`);
  await finished(page);
  expect(await plans(request, id)).toHaveLength(3);
  // Leaving and coming back keeps the finished plans on screen.
  await page.goto(`/incidents/${id}/experiments`);
  await page
    .getByRole("navigation", { name: "Incident features", exact: true })
    .getByRole("link", { name: "Simulation", exact: true })
    .click();
  await expect(lab(page)).toBeVisible();
  await finished(page);
  await expect(playback).toHaveAttribute("data-reference", "true");
  await expect(playback.locator(".guided-counter")).toHaveText("Step 1 of 12");
  expect(await plans(request, id)).toHaveLength(3);
});

test("the assembly guide opens directly without running an experiment", async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const id = source.incident().id;
  await page.goto(`/incidents/${id}/simulation`);
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  const scene = playback.locator(".assembly-canvas");
  const viewport = playback.locator(".guided-viewport");
  const counter = playback.locator(".guided-counter");
  await expect(scene).toHaveAttribute("data-model-loaded", "true");
  await expect(counter).toHaveText("Step 1 of 12");
  const settings = playback.locator(".guided-settings");
  await settings.locator(":scope > summary").click();
  const simulationControls = settings.locator(".incident-simulation-controls");
  await simulationControls.locator(":scope > summary").click();
  const severity = settings.getByRole("slider", {
    name: "Illustrative fault severity",
    exact: true,
  });
  await severity.press("Home");
  for (let increment = 0; increment < 45; increment++)
    await severity.press("ArrowRight");
  await expect(severity).toHaveValue("0.45");
  await settings
    .getByRole("combobox", { name: "Hypothetical mechanism", exact: true })
    .selectOption("unstable_delivery");
  await expect(settings).toHaveAttribute("open", "");
  await expect(simulationControls).toHaveAttribute("open", "");
  await expect(severity).toHaveValue("0.45");
  await settings.locator(":scope > summary").click();
  await expect(playback).toContainText("Explore the S932 assembly");
  await expect(
    playback
      .locator(".guided-console summary")
      .filter({ hasText: "Simulated response" }),
  ).toHaveCount(0);
  const qdLabel = scene.locator('.assembly-label[data-part-id="bfs_bottle"]');
  await expect(qdLabel).toHaveText("BFS flux bottle");
  await expect(qdLabel).toHaveAttribute("data-shown", "true");
  await expect(qdLabel).toHaveAttribute("data-anchor-mesh", /pressure-vessel/);
  const desktopScene = await scene.boundingBox();
  expect(desktopScene!.height).toBeGreaterThan(500);
  await expectFloatingPanels(playback);
  await viewport.screenshot({
    path: testInfo.outputPath("assembly-guide-desktop.png"),
  });

  const guide = playback.locator(".guided-console");
  const expandedGuide = (await guide.boundingBox())!;
  await guide.locator(":scope > summary").click();
  await expect(
    playback.getByRole("button", { name: "Next step" }),
  ).toBeHidden();
  expect((await guide.boundingBox())!.height).toBeLessThan(
    expandedGuide.height,
  );
  await expectFloatingPanels(playback);
  await guide.locator(":scope > summary").click();
  await expect(
    playback.getByRole("button", { name: "Next step" }),
  ).toBeVisible();
  await expect(counter).toHaveText("Step 1 of 12");

  await playback.getByRole("button", { name: "Next step" }).click();
  await expect(counter).toHaveText("Step 2 of 12");
  await expect(playback).toContainText("Reveal the dispensing assembly");
  await playback.getByRole("button", { name: "Previous step" }).click();
  await expect(counter).toHaveText("Step 1 of 12");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(qdLabel).toHaveAttribute("data-shown", "true");
  await expect(
    playback.getByRole("button", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    playback.getByRole("button", { name: "Isolate", exact: true }),
  ).toBeVisible();
  const mobileTools = await playback
    .locator(".assembly-camera-tools")
    .boundingBox();
  const mobileBadge = await playback.locator(".guided-shot").boundingBox();
  expect(mobileBadge!.y + mobileBadge!.height).toBeLessThanOrEqual(
    mobileTools!.y,
  );
  const mobileScene = await scene.boundingBox();
  expect(mobileScene!.width).toBeGreaterThan(300);
  expect(mobileScene!.height).toBeGreaterThan(250);
  await expectFloatingPanels(playback);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await viewport.screenshot({
    path: testInfo.outputPath("assembly-guide-mobile.png"),
  });
  expect(await plans(request, id)).toHaveLength(0);
});

for (const deviceScaleFactor of [0.67, 1, 2]) {
  test.describe(`labels at pixel ratio ${deviceScaleFactor}`, () => {
    test.use({ deviceScaleFactor });

    test("connector dots match the rendered meshes while zooming and resizing", async ({
      page,
      request,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1280, height: 900 });
      const source = await incidentWith(request, ["intermittent", "unstable"]);
      await page.goto(`/incidents/${source.incident().id}/simulation`);
      const playback = page.getByRole("region", {
        name: "Guided simulation playback",
        exact: true,
      });
      const scene = playback.locator(".assembly-canvas");
      await expect(scene).toHaveAttribute("data-model-loaded", "true");
      await expect(
        scene.locator('.assembly-label[data-part-id="bfs_bottle"]'),
      ).toHaveAttribute("data-shown", "true");
      for (const action of [
        "start",
        "Zoom in",
        "Zoom out",
        "Orbit left",
        "resize",
        "scale",
        "Enter full screen",
      ]) {
        if (action === "resize")
          await page.setViewportSize({ width: 980, height: 820 });
        else if (action === "scale")
          await page.evaluate(() => {
            document.body.style.zoom = "0.75";
          });
        else if (action !== "start")
          await playback
            .getByRole("button", { name: action, exact: true })
            .click();
        await expect
          .poll(async () =>
            scene.evaluate((element, annotations) => {
              const { state, renderer } = (
                window as unknown as {
                  __flowpilotScene: {
                    state: { parts: Group; camera: PerspectiveCamera };
                    renderer: WebGLRenderer;
                  };
                }
              ).__flowpilotScene;
              const canvas = renderer.domElement;
              const rect = canvas.getBoundingClientRect();
              const gl = renderer.getContext();
              const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
              const distances = [
                ...element.querySelectorAll<SVGCircleElement>(
                  "circle[data-part-id]",
                ),
              ]
                .filter((dot) => dot.style.opacity === "1")
                .map((dot) => {
                  const annotation =
                    annotations[dot.dataset.partId as keyof typeof annotations];
                  const mesh = state.parts.getObjectByName(annotation.mesh)!;
                  const projected = mesh
                    .localToWorld(
                      mesh.position.clone().fromArray(annotation.point),
                    )
                    .project(state.camera);
                  const expectedX =
                    rect.left +
                    ((viewport[0] + (projected.x * 0.5 + 0.5) * viewport[2]) /
                      canvas.width) *
                      rect.width;
                  const expectedY =
                    rect.top +
                    (1 -
                      (viewport[1] + (projected.y * 0.5 + 0.5) * viewport[3]) /
                        canvas.height) *
                      rect.height;
                  const actual = new DOMPoint(
                    Number(dot.getAttribute("cx")),
                    Number(dot.getAttribute("cy")),
                  ).matrixTransform(dot.getScreenCTM()!);
                  return Math.hypot(actual.x - expectedX, actual.y - expectedY);
                });
              return distances.length ? Math.max(...distances) : Infinity;
            }, partAnnotations),
          )
          .toBeLessThan(2);
      }
      expect(errors).toEqual([]);
      await scene.screenshot({
        path: testInfo.outputPath(
          `labels-pixel-ratio-${deviceScaleFactor}.png`,
        ),
      });
    });
  });
}

test("the assembly guide labels the supply, valve, transport, inspection and service components", async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await page.goto(`/incidents/${source.incident().id}/simulation`);
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  const scene = playback.locator(".assembly-canvas");
  await expect(scene).toHaveAttribute("data-model-loaded", "true");
  const views = [
    { id: "establish", parts: ["bfs_bottle", "dj2200_valve"] },
    { id: "reveal", parts: ["bfs_bottle", "dj2200_valve"] },
    { id: "follow", parts: ["bfs_lid", "bfs_sensors"] },
    { id: "head", parts: ["dj2200_valve", "valve_heater"] },
    { id: "apart", parts: ["needle_assembly", "valve_heater"] },
    { id: "core", parts: ["spring", "piston", "needle", "seat"] },
    { id: "valve", parts: ["bfs_air", "valve_air", "coaxial_air"] },
    { id: "nozzle", parts: ["air_cap", "nozzle_nut", "nozzle"] },
    { id: "motion", parts: ["motion_gantry", "conveyor", "carrier_sensors"] },
    {
      id: "vision",
      parts: [
        "vision_camera",
        "laser_height_sensor",
        "lookup_camera",
        "weigh_station",
      ],
    },
    { id: "service", parts: ["purge_station", "waste_bottle"] },
    { id: "assembled", parts: ["machine_enclosure"] },
  ];
  for (const [index, view] of views.entries()) {
    if (index > 0)
      await playback.getByRole("button", { name: "Next step" }).click();
    await expect(playback.locator(".guided-counter")).toHaveText(
      `Step ${index + 1} of 12`,
    );
    await expect(scene).toHaveAttribute("data-shot", view.id);
    for (const id of view.parts) {
      const label = scene.locator(`.assembly-label[data-part-id="${id}"]`);
      await expect(label).toHaveAttribute("data-shown", "true");
      await expect(label).toHaveAttribute("data-anchor-mesh", /\S+/);
      await expect(scene.locator(`line[data-part-id="${id}"]`)).toHaveCSS(
        "opacity",
        "1",
      );
      const labelBox = (await label.boundingBox())!;
      const caption = (await playback
        .locator(".guided-console")
        .boundingBox())!;
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(caption.y);
    }
    if (
      [
        "establish",
        "reveal",
        "head",
        "apart",
        "core",
        "nozzle",
        "motion",
        "vision",
        "service",
      ].includes(view.id)
    )
      await scene.screenshot({
        path: testInfo.outputPath(`assembly-${view.id}.png`),
      });
    if (view.id === "core") {
      const positions = () =>
        scene.evaluate((element) => {
          const origin = element.getBoundingClientRect();
          return [
            ...element.querySelectorAll<HTMLElement>(
              '.assembly-label[data-shown="true"][data-part-id]',
            ),
          ].map((label) => {
            const rect = label.getBoundingClientRect();
            const line = element.querySelector(
              `line[data-part-id="${label.dataset.partId}"]`,
            )!;
            return {
              id: label.dataset.partId,
              x: rect.x - origin.x + rect.width / 2,
              y: rect.y - origin.y + rect.height / 2,
              width: rect.width,
              height: rect.height,
              anchorX: Number(line.getAttribute("x1")),
              anchorY: Number(line.getAttribute("y1")),
              endX: Number(line.getAttribute("x2")),
              endY: Number(line.getAttribute("y2")),
            };
          });
        });
      let previous = await positions();
      for (const action of [
        "Zoom in",
        "Zoom in",
        "Zoom out",
        "Zoom out",
        "Orbit left",
        "Orbit right",
      ]) {
        await playback
          .getByRole("button", { name: action, exact: true })
          .click();
        await expect
          .poll(async () => (await positions())[0]?.anchorX)
          .not.toBe(previous[0].anchorX);
        const current = await positions();
        // Parts outside the visible frame lose their label as the camera closes in.
        expect(current.length).toBeGreaterThan(0);
        for (const label of current) {
          const before = previous.find((item) => item.id === label.id);
          if (before) {
            const movement = Math.hypot(label.x - before.x, label.y - before.y);
            const anchorMovement = Math.hypot(
              label.anchorX - before.anchorX,
              label.anchorY - before.anchorY,
            );
            expect(movement).toBeLessThan(anchorMovement + 24);
            expect(label.width).toBeCloseTo(before.width);
          }
          // The leader must end on the text box even when placement changes.
          expect(Math.abs(label.endX - label.x)).toBeLessThanOrEqual(
            label.width / 2 + 1,
          );
          expect(Math.abs(label.endY - label.y)).toBeLessThanOrEqual(
            label.height / 2 + 1,
          );
          for (const other of current.filter((item) => item.id !== label.id)) {
            expect(
              Math.abs(label.x - other.x) >=
                (label.width + other.width) / 2 - 1 ||
                Math.abs(label.y - other.y) >=
                  (label.height + other.height) / 2 - 1,
            ).toBe(true);
          }
        }
        previous = current;
      }
      await scene.screenshot({
        path: testInfo.outputPath("assembly-labels-after-zoom.png"),
      });
      await playback.getByRole("button", { name: "Previous step" }).click();
      await playback.getByRole("button", { name: "Next step" }).click();
      for (const size of [
        { width: 1280, height: 720 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(size);
        for (const id of view.parts) {
          const label = scene.locator(`.assembly-label[data-part-id="${id}"]`);
          await expect(label).toHaveAttribute("data-shown", "true");
          const labelBox = (await label.boundingBox())!;
          const caption = (await playback
            .locator(".guided-console")
            .boundingBox())!;
          expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(caption.y);
        }
        await scene.screenshot({
          path: testInfo.outputPath(`assembly-core-${size.width}.png`),
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
  await expect(
    playback.getByRole("button", { name: "Next step" }),
  ).toBeDisabled();
  expect(await plans(request, source.incident().id)).toHaveLength(0);
});

test("the playback follows the simulated values and changes what the model shows", async ({
  page,
  request,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const incident = source.incident();
  await runFromInvestigation(page, incident.id);
  await finished(page);
  await page
    .getByRole("button", { name: "Experiment playback", exact: true })
    .click();
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  const scene = playback.locator(".assembly-canvas");
  await expect(scene).toHaveAttribute("data-model-loaded", "true");
  const counter = playback.locator(".guided-counter");
  await expect(counter).toHaveText("Step 1 of 8");
  await expect(playback).toContainText("The machine and the question");
  await expect(playback).toContainText("Simulated · not measured");
  await expect(scene).toHaveAttribute("data-shot", "establish");
  const states = async () =>
    JSON.parse(
      (await scene.getAttribute("data-part-states")) ?? "{}",
    ) as Record<string, number>;
  const step = async (index: number) => {
    await chooseStep(playback, index);
    await expect(counter).toHaveText(`Step ${index + 1} of 8`);
    // Levels ease toward their target; reduced motion applies them at once.
    await page.waitForTimeout(600);
  };

  await step(2);
  await expect(scene).toHaveAttribute("data-shot", "apart");
  await expect(scene).toHaveAttribute("data-condition", "start");
  const qdLabel = scene.locator('.assembly-label[data-part-id="fluid_qd"]');
  await expect(qdLabel).toHaveText("Valve fluid QD");
  await expect(qdLabel).toHaveAttribute("data-shown", "true");
  await expect(qdLabel).toHaveAttribute(
    "data-anchor-mesh",
    /quick-disconnect-(body|collar)/,
  );
  const qdLeader = scene.locator('line[data-part-id="fluid_qd"]');
  await expect(qdLeader).toHaveCSS("opacity", "1");
  expect(
    await qdLeader.evaluate((line) =>
      ["x1", "y1", "x2", "y2"].every((attribute) =>
        Number.isFinite(Number(line.getAttribute(attribute))),
      ),
    ),
  ).toBe(true);
  const early = await states();
  const earlyShot = await captureModel(
    scene,
    testInfo.outputPath("playback-early.png"),
  );
  expect(early["visible-fluid-core"]).toBeCloseTo(1, 5);
  await step(6);
  await expect(scene).toHaveAttribute("data-shot", "substrate");
  await expect(scene).toHaveAttribute("data-condition", "tested");
  const late = await states();
  const lateShot = await captureModel(
    scene,
    testInfo.outputPath("playback-late.png"),
  );
  expect(late["visible-fluid-core"]).toBeLessThan(early["visible-fluid-core"]);
  expect(late["spray-cone"]).toBeLessThan(early["spray-cone"]);
  expect(Buffer.compare(earlyShot, lateShot)).not.toBe(0);
  // The same step draws the same picture, so the difference above is the data.
  await step(2);
  expect(
    await frameDifference(page, earlyShot, await captureModel(scene)),
  ).toBeLessThanOrEqual(1);

  // The response curves keep the simulation page's styling, not browser defaults.
  await playback
    .locator(".guided-console summary")
    .filter({ hasText: "Simulated response" })
    .click();
  await expect(playback.locator("polyline.fixture-mass")).toHaveCSS(
    "fill",
    "none",
  );
  await expect(playback.locator("polyline.fixture-mass")).not.toHaveCSS(
    "stroke",
    "rgb(0, 0, 0)",
  );
  await expect(
    playback
      .getByRole("list", { name: "Playback steps" })
      .getByRole("button")
      .first(),
  ).toHaveCSS("justify-content", "flex-start");
  // The curve marker, narration and numbers track the step.
  await step(6);
  await expect(playback.locator(".simulation-marker")).toHaveCount(1);
  await expect(playback.locator(".guided-narration")).toContainText(
    "Coverage changes from",
  );
  await playback.getByText("Step details", { exact: true }).click();
  await expect(
    playback.getByText(/one stripe per sequence position/),
  ).toBeVisible();
  await step(7);
  await expect(playback).toContainText("do not confirm a physical cause");
  await expect(
    playback.getByText(/No machine test or measurement/),
  ).not.toBeVisible();
  await playback.getByText("Step details", { exact: true }).click();
  await expect(
    playback.getByText(/No machine test or measurement/),
  ).toBeVisible();
  await expect(playback).toContainText("No machine test or measurement");

  // Another experiment opens its own playback and parts.
  const ids = (await plans(request, incident.id)).flatMap(
    (plan) => plan.proposal.hypothesis_ids as string[],
  );
  await tracks(page)
    .getByRole("button", { name: "Open playback of Unstable fluid delivery" })
    .click();
  await expect(playback).toContainText("Unstable fluid delivery");
  await expect(counter).toHaveText("Step 1 of 8");
  const components = incident.assessment!.hypotheses.find(
    (item) => item.id === "unstable_delivery",
  )!.component_ids;
  expect(ids).toContain("unstable_delivery");
  await chooseStep(playback, 2);
  await expect(scene).toHaveAttribute(
    "data-highlight-ids",
    components.join(","),
  );
});

test("each guide step plays, pauses and holds until the viewer advances", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await runFromInvestigation(page, source.incident().id);
  await finished(page);
  await page
    .getByRole("button", { name: "Experiment playback", exact: true })
    .click();
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  const scene = playback.locator(".assembly-canvas");
  await expect(scene).toHaveAttribute("data-model-loaded", "true");
  // Advance the scene's clock after loading, without delaying the run requests.
  await page.clock.install();
  const counter = playback.locator(".guided-counter");
  await playback.getByRole("button", { name: "Next step" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText("Step 2 of 8");
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveText("Step 1 of 8");
  await expect(
    playback.getByRole("button", { name: "Previous step" }),
  ).toBeDisabled();
  await page.clock.fastForward(3000);

  await playback
    .getByRole("button", { name: "Replay step", exact: true })
    .click();
  await expect(
    playback.getByRole("button", { name: "Pause step", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(400);
  await playback
    .getByRole("button", { name: "Pause step", exact: true })
    .click();
  await expect(
    playback.getByRole("button", { name: "Resume step", exact: true }),
  ).toBeVisible();
  const paused = await captureModel(scene);
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 1 of 8");
  // Native WebGL screenshots can round a handful of channels by 1/255.
  expect(
    await frameDifference(page, paused, await captureModel(scene)),
  ).toBeLessThanOrEqual(1);
  await playback
    .getByRole("button", { name: "Resume step", exact: true })
    .click();
  await page.clock.fastForward(3000);
  await expect(
    playback.getByRole("button", { name: "Replay step", exact: true }),
  ).toBeVisible();
  const completed = await captureModel(scene);
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 1 of 8");
  expect(
    await frameDifference(page, completed, await captureModel(scene)),
  ).toBeLessThanOrEqual(1);

  // Next moves smoothly through an intermediate frame, then holds without advancing.
  const beforeNext = await captureModel(scene);
  await playback.getByRole("button", { name: "Next step" }).click();
  await expect(counter).toHaveText("Step 2 of 8");
  await expect(
    playback.getByRole("button", { name: "Pause step", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(600);
  const duringNext = await captureModel(scene);
  expect(await frameDifference(page, beforeNext, duringNext)).toBeGreaterThan(
    1,
  );
  await page.clock.fastForward(3000);
  const afterNext = await captureModel(scene);
  expect(await frameDifference(page, duringNext, afterNext)).toBeGreaterThan(1);
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 2 of 8");
  expect(
    await frameDifference(page, afterNext, await captureModel(scene)),
  ).toBeLessThanOrEqual(1);
  // Moving the camera still stops playback.
  await playback
    .getByRole("button", { name: "Replay step", exact: true })
    .click();
  await playback.getByRole("button", { name: "Orbit left" }).click();
  await expect(
    playback.getByRole("button", { name: "Replay step", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 2 of 8");
  await playback
    .getByRole("button", { name: "Replay step", exact: true })
    .click();
  await playback.getByRole("button", { name: "Next step" }).click();
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 3 of 8");

  // The last step can replay without returning to the beginning.
  await chooseStep(playback, 7);
  await expect(counter).toHaveText("Step 8 of 8");
  await expect(
    playback.getByRole("button", { name: "Next step" }),
  ).toBeDisabled();
  await page.clock.fastForward(3000);
  await playback
    .getByRole("button", { name: "Replay step", exact: true })
    .click();
  await page.clock.fastForward(3000);
  await playback
    .getByRole("button", { name: "Replay step", exact: true })
    .click();
  await page.clock.fastForward(3000);
  await expect(counter).toHaveText("Step 8 of 8");

  await playback.getByRole("button", { name: "Enter full screen" }).click();
  await expect
    .poll(() =>
      scene.evaluate(
        (element) => document.fullscreenElement?.contains(element) ?? false,
      ),
    )
    .toBe(true);
  await expectFloatingPanels(playback);
  await expect(tracks(page)).toBeVisible();
  expect(
    await tracks(page).evaluate(
      (element) => document.fullscreenElement?.contains(element) ?? false,
    ),
  ).toBe(true);
  await tracks(page)
    .getByRole("button", { name: "Open playback of Unstable fluid delivery" })
    .click();
  await expect(counter).toHaveText("Step 1 of 8");
  await expect(scene).toHaveAttribute("data-shot", "establish");
  expect(
    await scene.evaluate(
      (element) => document.fullscreenElement?.contains(element) ?? false,
    ),
  ).toBe(true);
  await playback.getByRole("button", { name: "Exit full screen" }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
});

test("reduced motion disables step animation and the progress shimmer", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await page.route("**/experiments/*/run", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await runFromInvestigation(page, source.incident().id);
  await expect(
    progress(page, "Fluid-path restriction").locator("span"),
  ).toHaveCSS("animation-name", "none");
  await expect(
    progress(page, "Fluid-path restriction").locator("span"),
  ).toHaveCSS("transition-duration", "0s");
  await finished(page);
  await expect(
    page
      .getByRole("region", { name: "Guided simulation playback", exact: true })
      .getByRole("button", { name: "Play step", exact: true }),
  ).toBeDisabled();
});

test("without WebGL the schematic, steps and numbers still work", async ({
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
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const components = source
    .incident()
    .assessment!.hypotheses.find(
      (item) => item.id === "restriction",
    )!.component_ids;
  await runFromInvestigation(page, source.incident().id);
  await finished(page);
  await page
    .getByRole("button", { name: "Experiment playback", exact: true })
    .click();
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  await expect(
    playback.getByRole("status").filter({ hasText: "3D unavailable" }),
  ).toBeVisible();
  await chooseStep(playback, 3);
  await expect(
    playback.locator('.prototype-diagram [data-highlighted="true"]'),
  ).toHaveCount(components.length);
  await expect(playback).toContainText("Where fluid-path restriction acts");
  await playback
    .locator(".guided-console summary")
    .filter({ hasText: "Simulated response" })
    .click();
  await expect(playback.locator("svg.incident-simulation-chart")).toBeVisible();
});

test("failures are explained and can be retried, and an unknown plan is reported", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const id = source.incident().id;
  let fail = true;
  await page.route("**/experiments", async (route) => {
    if (fail && route.request().method() === "POST")
      return route.fulfill({
        status: 422,
        json: {
          detail: "Mock experiments require an S932 synthetic incident.",
        },
      });
    return route.continue();
  });
  await runFromInvestigation(page, id);
  await expect(tracks(page).getByRole("alert")).toHaveCount(3);
  await expect(tracks(page).getByRole("alert").first()).toContainText(
    "Mock experiments require an S932 synthetic incident.",
  );
  for (const title of titles)
    await expect(progress(page, title)).toHaveAttribute(
      "aria-valuetext",
      "Stopped after 0 of 3 conditions",
    );
  expect(await plans(request, id)).toHaveLength(0);
  fail = false;
  await tracks(page)
    .getByRole("button", { name: "Try again: Fluid-path restriction" })
    .click();
  await finished(page, ["Fluid-path restriction"]);
  expect(await plans(request, id)).toHaveLength(1);
  await lab(page).getByRole("button", { name: "Run the other two" }).click();
  await finished(page);
  expect(await plans(request, id)).toHaveLength(3);

  await page.goto(`/incidents/${id}/simulation?plan=DOE-missing`);
  await expect(page.getByRole("alert")).toContainText(
    "These experiment plans were not found",
  );
});

test("the experiment sidebar keeps names readable at desktop and phone widths", async ({
  page,
  request,
}, testInfo) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await page.goto(
    `/incidents/${source.incident().id}/simulation?run=unstable_delivery`,
  );
  await finished(page, ["Unstable fluid delivery"]);
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  await expect(playback.locator(".assembly-canvas")).toHaveAttribute(
    "data-model-loaded",
    "true",
  );
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await expectFloatingPanels(playback);
    await expect(tracks(page)).toBeVisible();
    await expect(playback.locator(".lab-console > summary")).toContainText(
      "1 of 3 finished",
    );
    const sidebar = playback.locator(".guided-auxiliary");
    const sidebarBox = (await sidebar.boundingBox())!;
    const captionBox = (await playback
      .locator(".guided-console")
      .boundingBox())!;
    expect(sidebarBox.y + sidebarBox.height).toBeLessThan(captionBox.y);
    for (const heading of await tracks(page)
      .locator(".lab-agent-head strong")
      .all()) {
      const dimensions = await heading.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        lines:
          element.getBoundingClientRect().height /
          parseFloat(getComputedStyle(element).lineHeight),
        fits: element.scrollWidth <= element.clientWidth,
      }));
      expect(dimensions.width).toBeGreaterThan(180);
      expect(dimensions.lines).toBeLessThanOrEqual(3);
      expect(dimensions.fits).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (size.width <= 700) {
      await sidebar.evaluate((element) => {
        const card = element.querySelector(".lab-agent")!;
        element.scrollTop +=
          card.getBoundingClientRect().top -
          element.getBoundingClientRect().top;
      });
    }
    await lab(page).screenshot({
      path: testInfo.outputPath(`lab-sidebar-${size.width}.png`),
    });
  }
});

test("the offer and the lab give every control an accessible name and a unique id", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const check = () =>
    page.evaluate(() => {
      const issues: string[] = [];
      for (const control of document.querySelectorAll(
        "main button, main a[href], main input, main select",
      )) {
        if (
          !control.checkVisibility({
            contentVisibilityAuto: true,
            visibilityProperty: true,
          })
        )
          continue;
        const name =
          control.getAttribute("aria-label") ||
          control.getAttribute("aria-labelledby") ||
          control.textContent?.trim() ||
          control.getAttribute("title");
        if (!name) issues.push(control.outerHTML.slice(0, 120));
      }
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
      for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i)))
        issues.push(`duplicate id ${id}`);
      return issues;
    });
  await page.goto(`/incidents/${source.incident().id}/investigation`);
  await expect(offer(page)).toBeVisible();
  expect(await check()).toEqual([]);
  await offer(page)
    .getByRole("button", { name: "Run all three experiments" })
    .click();
  await finished(page);
  expect(await check()).toEqual([]);
});

test("a finding consistent with the records goes back to the investigation as a simulated suggestion, never as evidence", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const before = source.incident();
  await runFromInvestigation(page, before.id);
  await finished(page);
  const track = (title: string) =>
    tracks(page).locator(":scope > li").filter({ hasText: title });
  // An intermittent defect matches the oscillating response, not the two falls.
  await expect(track("Unstable fluid delivery")).toContainText(
    "Simulated · consistent with the records",
  );
  for (const title of ["Fluid-path restriction", "Material-condition change"]) {
    await expect(track(title)).toContainText(
      "Simulated · conflicts with the records",
    );
    await expect(
      track(title).getByRole("button", { name: /Return to investigation/ }),
    ).toHaveCount(0);
  }
  await track("Unstable fluid delivery")
    .getByRole("button", { name: "Return to investigation with this finding" })
    .click();
  await expect(page).toHaveURL(/\/investigation\?finding=unstable_delivery$/);
  const panel = page.getByRole("dialog", { name: "Unstable fluid delivery" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Simulated · not evidence");
  await expect(panel).toContainText(
    "This does not confirm unstable fluid delivery",
  );
  await expect(panel).toContainText(
    "Met: The simulated shape matches a recorded or confirmed fact",
  );
  await expect(panel).toContainText("Suggested next manual check");
  await expect(panel).toContainText("Compare recorded delivery evidence");
  await expect(panel).toContainText("Physical execution blocked");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  const node = page.getByRole("button", {
    name: /Simulated finding · simulated: Simulated finding, not evidence/,
  });
  await expect(node).toHaveCount(1);

  // Stateful: a reload keeps it; nothing became evidence or an observation.
  await page.goto(`/incidents/${before.id}/investigation`);
  await expect(node).toHaveCount(1);
  const after: Incident = await (
    await request.get(`/api/incidents/${before.id}`)
  ).json();
  expect(after.evidence).toEqual(before.evidence);
  expect(after.observations).toEqual(before.observations);
  expect(after.assessment!.hypotheses.map((item) => item.status)).toEqual(
    before.assessment!.hypotheses.map((item) => item.status),
  );
  const saved = await plans(request, before.id);
  const returned = saved.find((plan) => plan.handbacks?.length);
  expect(returned!.handbacks!.map((item) => item.decision)).toEqual(["return"]);

  // Setting it aside removes it from the investigation (opened by keyboard).
  await node.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("dialog", { name: "Unstable fluid delivery" })
    .getByRole("button", { name: "Set this finding aside" })
    .click();
  await expect(node).toHaveCount(0);
});

test("a returned finding is marked outdated once the evidence changes", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const id = source.incident().id;
  await runFromInvestigation(page, id);
  await finished(page);
  await tracks(page)
    .locator(":scope > li")
    .filter({ hasText: "Unstable fluid delivery" })
    .getByRole("button", { name: "Return to investigation with this finding" })
    .click();
  await expect(page).toHaveURL(/finding=unstable_delivery/);
  await source.act({
    action: "add_evidence",
    evidence: {
      id: "late-context",
      kind: "context",
      role: "context",
      label: "Late context",
      source_ref: "test:late",
      synthetic: true,
      values: { material: "flux" },
    },
  });
  await page.goto(`/incidents/${id}/investigation`);
  await expect(
    page.getByRole("button", { name: /Simulated finding · outdated/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: /Simulated finding · outdated/ })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Unstable fluid delivery" }),
  ).toContainText("Outdated: the evidence changed after this simulation.");
});
