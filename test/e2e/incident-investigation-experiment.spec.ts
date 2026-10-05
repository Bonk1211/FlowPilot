import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Incident, IncidentExperiment } from "@flowpilot/contracts";

async function replayed(request: APIRequestContext) {
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `inline-experiment-${randomUUID()}` },
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
  const answer = (choice: string) =>
    act({
      action: "answer_investigation",
      node_id: incident.investigation!.active_node_id,
      answer_id: `ANS-${randomUUID()}`,
      choice,
    });
  await act({ action: "analyze" });
  return { incident: () => incident, answer };
}

const plans = async (request: APIRequestContext, id: string) =>
  (await (
    await request.get(`/api/incidents/${id}/experiments`)
  ).json()) as IncidentExperiment[];

test("the experiment node previews three DOE branches and each opens its popup without running anything", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const source = await replayed(request);
  await source.answer("intermittent");
  const id = source.incident().id;
  await page.goto(`/incidents/${id}/investigation`);
  await expect(page.locator(".flowchart-node.is-active")).toHaveCount(1);
  await expect(page.locator(".stage-experiment.flowchart-node")).toHaveCount(0);
  await source.answer("unstable");
  await page.reload();
  const branch = page.locator(".stage-experiment.flowchart-node");
  await expect(branch).toContainText("Preview DOE branches");
  await page
    .getByRole("button", { name: "Focus current question", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Adaptive investigation", exact: true })
    .screenshot({ path: testInfo.outputPath("inline-experiment.png") });

  const offer = page.getByRole("complementary", {
    name: "Suggested experiments",
  });
  const offerToggle = offer.getByRole("button", {
    name: "3 experiments ready",
  });
  await offerToggle.click();
  await expect(offerToggle).toHaveAttribute("aria-expanded", "false");
  const root = branch.getByRole("button");
  await expect(root).toHaveAttribute("aria-expanded", "false");
  await root.focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveAttribute("aria-expanded", "true");
  const previews = page.locator(".stage-doe.flowchart-node");
  await expect(previews).toHaveCount(3);
  await expect(page.locator(".flowchart-edge-doe")).toHaveCount(3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(previews.first().locator(".flowchart-shape")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(
    page.locator(".flowchart-edge-doe path.react-flow__edge-path").first(),
  ).toHaveCSS("animation-name", "none");
  const trigger = previews.getByRole("button", {
    name: /Open DOE preview: Unstable fluid delivery/,
  });
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const expanded = await graph.evaluate((element) =>
    element.classList.contains("is-expanded"),
  );
  await trigger.focus();
  await page.keyboard.press("Enter");
  const popup = page.getByRole("dialog", { name: "Unstable fluid delivery" });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("What we predict");
  await expect(
    popup.getByRole("heading", { name: "Unstable fluid delivery" }),
  ).toBeFocused();
  await expect(offerToggle).toHaveAttribute("aria-expanded", "false");
  await expect(offer.locator(".experiment-brief-body")).toHaveCount(0);
  await expect(page).toHaveURL(`/incidents/${id}/investigation`);
  await popup.screenshot({ path: testInfo.outputPath("experiment-popup.png") });
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(
    await graph.evaluate((element) =>
      element.classList.contains("is-expanded"),
    ),
  ).toBe(expanded);

  // Closing does not prevent the same DOE branch from opening its popup again.
  await trigger.click();
  await expect(popup).toBeVisible();
  await popup
    .getByRole("button", { name: "Close experiment description" })
    .click();
  await expect(trigger).toBeFocused();

  // The answer panel's link opens the same popup.
  await root.click();
  await expect(previews).toHaveCount(0);
  await page.getByRole("button", { name: "Open the experiment" }).click();
  await expect(popup).toBeVisible();
  await expect(offerToggle).toHaveAttribute("aria-expanded", "false");
  expect(await plans(request, id)).toHaveLength(0);
});

test("DOE preview nodes fan out with their connectors, collapse cleanly and run only the selected experiment", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const source = await replayed(request);
  await source.answer("intermittent");
  await source.answer("unstable");
  const id = source.incident().id;
  const before = source.incident();
  await page.goto(`/incidents/${id}/investigation`);
  const root = page.locator(".stage-experiment").getByRole("button");
  const previews = page.locator(".stage-doe.flowchart-node");
  await expect(previews).toHaveCount(0);
  await root.click();
  await expect(previews).toHaveCount(3);
  await expect(page.locator(".flowchart-edge-doe")).toHaveCount(3);
  for (const title of [
    "Fluid-path restriction",
    "Unstable fluid delivery",
    "Material-condition change",
  ]) {
    const node = previews.filter({ hasText: title });
    await expect(node).toContainText("Preview · simulated");
    await expect(node).toContainText("Severity 0.20 / 0.80 · control 0.70");
    await expect(node.locator(".signature-spark")).toHaveCount(1);
  }
  // Inspect the real animation at its start, midpoint and end.
  const frames = await previews
    .nth(1)
    .locator(".flowchart-shape")
    .evaluate((element) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      const timing = animation.effect!.getTiming();
      const duration = Number(timing.duration);
      const sample = (time: number) => {
        animation.currentTime = time;
        const box = element.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          opacity: Number(getComputedStyle(element).opacity),
        };
      };
      const result = [
        sample(timing.delay),
        sample(timing.delay + duration / 2),
        sample(timing.delay + duration),
      ];
      animation.play();
      return result;
    });
  expect(frames[0].opacity).toBe(0);
  expect(frames[1].opacity).toBeGreaterThan(0);
  expect(frames[1].opacity).toBeLessThan(1);
  expect(Math.abs(frames[0].x - frames[2].x)).toBeGreaterThan(25);
  expect(frames[2].opacity).toBe(1);
  await expect
    .poll(async () =>
      previews
        .locator(".flowchart-shape")
        .evaluateAll((elements) =>
          elements.every((element) =>
            element
              .getAnimations()
              .every((animation) => animation.playState === "finished"),
          ),
        ),
    )
    .toBe(true);
  for (const node of await previews.all()) await expect(node).toBeInViewport();
  await expect
    .poll(async () =>
      page
        .locator(".flowchart-edge-doe path.react-flow__edge-path")
        .evaluateAll((paths) =>
          paths.every((path) =>
            path
              .getAnimations()
              .every((animation) => animation.playState === "finished"),
          ),
        ),
    )
    .toBe(true);
  // Each animated connector must finish on its actual DOE target, not the parent.
  const endpointErrors = await page
    .locator(".flowchart-edge-doe path.react-flow__edge-path")
    .evaluateAll((paths) =>
      paths.map((element) => {
        const path = element as SVGPathElement;
        const target = document.querySelector(
          `[data-id="${path.id.replace(/^edge-/, "")}"] .react-flow__handle-top`,
        )!;
        const bounds = target.getBoundingClientRect();
        const endpoint = path
          .getPointAtLength(path.getTotalLength())
          .matrixTransform(path.getScreenCTM()!);
        return Math.hypot(
          endpoint.x - bounds.x - bounds.width / 2,
          endpoint.y - bounds.y - bounds.height / 2,
        );
      }),
    );
  for (const error of endpointErrors) expect(error).toBeLessThan(2);
  await page
    .getByRole("region", { name: "Adaptive investigation", exact: true })
    .screenshot({ path: testInfo.outputPath("doe-tree-preview.png") });
  expect(await plans(request, id)).toHaveLength(0);
  const after: Incident = await (
    await request.get(`/api/incidents/${id}`)
  ).json();
  expect(after.revision).toBe(before.revision);
  expect(after.investigation).toEqual(before.investigation);
  await root.click();
  await expect(previews).toHaveCount(0);
  await expect(page.locator(".flowchart-edge-doe")).toHaveCount(0);
  await expect(root).toHaveAttribute("aria-expanded", "false");
  await root.click();
  await expect(previews).toHaveCount(3);
  await previews
    .getByRole("button", { name: /Open DOE preview: Fluid-path restriction/ })
    .click();
  const popup = page.getByRole("dialog", { name: "Fluid-path restriction" });
  await expect(popup).toBeVisible();
  await popup
    .getByRole("button", {
      name: "Run this experiment: Fluid-path restriction",
    })
    .click();
  await expect(page).toHaveURL(/\/simulation\?(run=restriction|plan=DOE-)/);
  await expect(
    page.getByRole("progressbar", { name: "Fluid-path restriction progress" }),
  ).toHaveAttribute("aria-valuetext", "Finished: 3 of 3 conditions simulated", {
    timeout: 20000,
  });
  expect(
    (await plans(request, id)).map((plan) => plan.proposal.hypothesis_ids),
  ).toEqual([["restriction"]]);
});

test("DOE branches remain inspectable on a phone", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const source = await replayed(request);
  await source.answer("intermittent");
  await source.answer("unstable");
  const id = source.incident().id;
  await page.goto(`/incidents/${id}/investigation`);
  const root = page.locator(".stage-experiment").getByRole("button");
  await root.focus();
  await page.keyboard.press("Enter");
  const previews = page.locator(".stage-doe.flowchart-node");
  await expect(previews).toHaveCount(3);
  for (const node of await previews.all()) await expect(node).toBeInViewport();
  await page
    .getByRole("region", { name: "Adaptive investigation", exact: true })
    .screenshot({ path: testInfo.outputPath("doe-tree-preview-mobile.png") });
  const trigger = previews.getByRole("button", {
    name: /Open DOE preview: Material-condition change/,
  });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Material-condition change" });
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(previews).toHaveCount(3);
  await expect(trigger).toBeFocused();
  expect(await plans(request, id)).toHaveLength(0);
});

test("an older single-experiment link opens the lab running just that experiment", async ({
  page,
  request,
}) => {
  const source = await replayed(request);
  await source.answer("intermittent");
  await source.answer("unstable");
  const id = source.incident().id;
  await page.goto(
    `/incidents/${id}/simulation?check=delivery_review&from=ANS-old-link`,
  );
  const lab = page.getByRole("region", { name: "Experiments", exact: true });
  await expect(
    lab.getByRole("progressbar", { name: "Unstable fluid delivery progress" }),
  ).toHaveAttribute("aria-valuetext", "Finished: 3 of 3 conditions simulated", {
    timeout: 20000,
  });
  await expect(page).toHaveURL(/\/simulation\?plan=DOE-[0-9a-f]+$/);
  await expect(
    lab.getByRole("progressbar", { name: "Fluid-path restriction progress" }),
  ).toHaveAttribute("aria-valuetext", "Not run yet");
  const saved = await plans(request, id);
  expect(saved.map((plan) => plan.proposal.hypothesis_ids)).toEqual([
    ["unstable_delivery"],
  ]);

  // An unknown check just opens Simulation; nothing runs.
  await page.goto(`/incidents/${id}/simulation?check=invented&from=x`);
  await expect(page).toHaveURL(`/incidents/${id}/simulation`);
  await page.getByText("Simulation settings", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Simulation sandbox" }),
  ).toBeVisible();
  expect(await plans(request, id)).toHaveLength(1);
});
