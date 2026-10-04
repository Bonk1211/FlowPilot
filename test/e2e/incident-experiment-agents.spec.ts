import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type { Incident, IncidentExperiment } from "@flowpilot/contracts";

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
const progress = (page: Page) =>
  page.getByRole("progressbar", {
    name: "Experiment run progress",
    exact: true,
  });
const offer = (page: Page) =>
  page.getByRole("complementary", { name: "Suggested experiments" });

async function runFromInvestigation(page: Page, id: string) {
  await page.goto(`/incidents/${id}/investigation`);
  await offer(page)
    .getByRole("button", { name: "Run all three experiments" })
    .click();
}

async function finished(page: Page) {
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /Finished: 9 of 9 conditions simulated/,
    { timeout: 20000 },
  );
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
  await expect(offer(page)).toContainText("not recorded as evidence");

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
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(row).toHaveAttribute("aria-expanded", "true");
  const body = offer(page).locator(
    `#${await row.getAttribute("aria-controls")}`,
  );
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

  const material = offer(page).getByRole("button", {
    name: /Material-condition change/,
  });
  await material.click();
  await expect(
    offer(page).getByText(/Mass falls quickly at first and then more slowly/),
  ).toBeVisible();
});

test("one press runs a saved plan through real stages, shows three tracks and changes nothing recorded", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const before = source.incident();
  // Hold the run request open so the in-flight state can be inspected.
  await page.route("**/experiments/*/run", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await runFromInvestigation(page, before.id);
  await expect(page).toHaveURL(/\/simulation\?run=all$/);
  await expect(lab(page)).toBeVisible();
  await expect(progress(page)).toHaveAttribute("aria-valuemax", "3");
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    /Stage 3 of 3: Simulating the planned conditions/,
    { timeout: 10000 },
  );
  await expect(
    page.getByRole("list", { name: "Run stages", exact: true }),
  ).toContainText("Saving the experiment plan");
  for (const state of await tracks(page).getByRole("listitem").all())
    await expect(state).toContainText("Running");
  await expect(
    page.getByText("The 3D playback opens here when the simulations finish."),
  ).toBeVisible();
  await lab(page).screenshot({
    path: testInfo.outputPath("lab-running.png"),
  });

  await finished(page);
  await expect(page).toHaveURL(/\/simulation\?plan=DOE-[0-9a-f]+$/);
  for (const item of await tracks(page).getByRole("listitem").all())
    await expect(item).toContainText("Done");
  await expect(lab(page)).toContainText(
    "Approved by demo:engineer for simulation only",
  );
  await expect(lab(page)).toContainText(
    "Simulated responses cannot say which cause is most likely",
  );
  await expect(
    lab(page).locator('.incident-status[data-status="observed"]'),
  ).toHaveCount(0);
  await lab(page).screenshot({
    path: testInfo.outputPath("lab-finished.png"),
  });

  // One plan, with its approval recorded, and the investigation untouched.
  const saved = await plans(request, before.id);
  expect(saved).toHaveLength(1);
  expect(saved[0].status).toBe("completed");
  expect(saved[0].matrix).toHaveLength(9);
  expect(saved[0].history.map((event) => event.action)).toEqual([
    "propose",
    "approve",
    "start",
    "complete",
  ]);
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

test("reloading or asking again never runs a second plan", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  const id = source.incident().id;
  await runFromInvestigation(page, id);
  await finished(page);
  await page.reload();
  await finished(page);
  expect(await plans(request, id)).toHaveLength(1);
  // Asking for the same run again is the same plan, not a new one.
  await page.goto(`/incidents/${id}/simulation?run=all`);
  await finished(page);
  expect(await plans(request, id)).toHaveLength(1);
  // Leaving and coming back keeps the finished plan on screen.
  await page.goto(`/incidents/${id}/experiments`);
  await page
    .getByRole("navigation", { name: "Incident features", exact: true })
    .getByRole("link", { name: "Simulation", exact: true })
    .click();
  await expect(lab(page)).toBeVisible();
  expect(await plans(request, id)).toHaveLength(1);
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
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  const scene = playback.locator(".assembly-canvas");
  await expect(scene).toHaveAttribute("data-model-loaded", "true");
  const counter = playback.locator(".guided-counter");
  await expect(counter).toHaveText("Step 1 of 8");
  await expect(playback).toContainText("The control condition");
  await expect(playback).toContainText("Simulated · not measured");
  const states = async () =>
    JSON.parse(
      (await scene.getAttribute("data-part-states")) ?? "{}",
    ) as Record<string, number>;
  const step = async (index: number) => {
    await playback
      .getByRole("list", { name: "Playback steps" })
      .getByRole("button")
      .nth(index)
      .click();
    await expect(counter).toHaveText(`Step ${index + 1} of 8`);
    // Levels ease toward their target; reduced motion applies them at once.
    await page.waitForTimeout(600);
  };

  await step(2);
  const early = await states();
  const earlyShot = await scene.screenshot({
    path: testInfo.outputPath("playback-early.png"),
  });
  expect(early["visible-fluid-core"]).toBeCloseTo(1, 5);
  await step(6);
  const late = await states();
  const lateShot = await scene.screenshot();
  expect(late["visible-fluid-core"]).toBeLessThan(early["visible-fluid-core"]);
  expect(late["spray-cone"]).toBeLessThan(early["spray-cone"]);
  expect(Buffer.compare(earlyShot, lateShot)).not.toBe(0);
  await scene.screenshot({ path: testInfo.outputPath("playback-late.png") });
  // The same step draws the same picture, so the difference above is the data.
  await step(2);
  expect(Buffer.compare(earlyShot, await scene.screenshot())).toBe(0);

  // The response curves keep the simulation page's styling, not browser defaults.
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
  await expect(
    playback.getByText(/Sequence position 1\.00/).first(),
  ).toBeVisible();
  await step(7);
  await expect(playback).toContainText("do not confirm a physical cause");
  await expect(playback).toContainText("No machine test or measurement");

  // Another experiment opens its own playback and parts.
  const ids = (await plans(request, incident.id))[0].proposal
    .hypothesis_ids as string[];
  await tracks(page)
    .getByRole("button", { name: "Open playback of Unstable fluid delivery" })
    .click();
  await expect(playback).toContainText("Unstable fluid delivery");
  await expect(counter).toHaveText("Step 1 of 8");
  const components = incident.assessment!.hypotheses.find(
    (item) => item.id === "unstable_delivery",
  )!.component_ids;
  expect(ids).toContain("unstable_delivery");
  await page
    .getByRole("list", { name: "Playback steps" })
    .getByRole("button")
    .nth(1)
    .click();
  await expect(scene).toHaveAttribute(
    "data-highlight-ids",
    components.join(","),
  );
});

test("playback can be stepped by keyboard and played, and stops on any interaction", async ({
  page,
  request,
}) => {
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await runFromInvestigation(page, source.incident().id);
  await finished(page);
  // Fake time only after the run, so the stages are not held back. A jump
  // fires each due timer once and skips the thousands of animation frames
  // a stepped clock would draw.
  await page.clock.install();
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  const counter = playback.locator(".guided-counter");
  await playback.getByRole("button", { name: "Next step" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(counter).toHaveText("Step 2 of 8");
  await page.keyboard.press("ArrowLeft");
  await expect(counter).toHaveText("Step 1 of 8");
  await expect(
    playback.getByRole("button", { name: "Previous step" }),
  ).toBeDisabled();

  await playback.getByRole("button", { name: "Play guide" }).click();
  await expect(
    playback.getByRole("button", { name: "Pause guide" }),
  ).toBeVisible();
  await page.clock.fastForward(5100);
  await expect(counter).toHaveText("Step 2 of 8");
  await page.clock.fastForward(5100);
  await expect(counter).toHaveText("Step 3 of 8");
  await playback.getByRole("button", { name: "Pause guide" }).click();
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 3 of 8");
  // Choosing a step by hand stops a running guide.
  await playback.getByRole("button", { name: "Play guide" }).click();
  await playback.getByRole("button", { name: "Next step" }).click();
  await page.clock.fastForward(12000);
  await expect(counter).toHaveText("Step 4 of 8");
  // Reaching the end stops the guide; Play then starts again from the first step.
  await playback
    .getByRole("list", { name: "Playback steps" })
    .getByRole("button")
    .last()
    .click();
  await expect(counter).toHaveText("Step 8 of 8");
  await playback.getByRole("button", { name: "Play guide" }).click();
  await expect(counter).toHaveText("Step 1 of 8");
});

test("reduced motion disables auto-play and the progress shimmer", async ({
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
  await expect(progress(page).locator('span[data-state="active"]')).toHaveCSS(
    "animation-name",
    "none",
  );
  await finished(page);
  await expect(
    page
      .getByRole("region", { name: "Guided simulation playback", exact: true })
      .getByRole("button", { name: "Play guide" }),
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
  const playback = page.getByRole("region", {
    name: "Guided simulation playback",
    exact: true,
  });
  await expect(
    playback.getByRole("status").filter({ hasText: "3D unavailable" }),
  ).toBeVisible();
  await playback
    .getByRole("list", { name: "Playback steps" })
    .getByRole("button")
    .nth(1)
    .click();
  await expect(
    playback.locator('.prototype-diagram [data-highlighted="true"]'),
  ).toHaveCount(components.length);
  await expect(playback).toContainText("Where fluid-path restriction acts");
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
  await expect(page.getByRole("alert")).toContainText(
    "Mock experiments require an S932 synthetic incident.",
  );
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "The run stopped",
  );
  for (const item of await tracks(page).getByRole("listitem").all())
    await expect(item).toContainText("Not run");
  expect(await plans(request, id)).toHaveLength(0);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await finished(page);
  expect(await plans(request, id)).toHaveLength(1);

  await page.goto(`/incidents/${id}/simulation?plan=DOE-missing`);
  await expect(page.getByRole("alert")).toContainText(
    "This experiment plan was not found",
  );
});

test("the lab is usable at phone width with the tracks before the playback", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const source = await incidentWith(request, ["intermittent", "unstable"]);
  await runFromInvestigation(page, source.incident().id);
  await finished(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const track = await tracks(page).boundingBox();
  const playback = await page
    .getByRole("region", { name: "Guided simulation playback", exact: true })
    .boundingBox();
  expect(track!.y).toBeLessThan(playback!.y);
  await lab(page).screenshot({ path: testInfo.outputPath("lab-mobile.png") });
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
