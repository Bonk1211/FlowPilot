import { openPartialReplay } from "./partialReplay";
import { expect, test, type Locator } from "@playwright/test";
import type { Incident } from "@flowpilot/contracts";
import { randomUUID } from "node:crypto";

async function fillObservation(editor: Locator, text: string) {
  await editor.getByLabel("Talk through what you're seeing").fill(text);
}

test("expanded branches keep their parent relationships and share clear elbow junctions", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `branch-layout-${randomUUID()}` },
    })
  ).json();
  const act = async (command: Record<string, unknown>) => {
    const response = await request.post(
      `/api/incidents/${incident.id}/actions`,
      {
        data: { revision: incident.revision, ...command },
      },
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
  await answer("intermittent");
  const sibling = incident.investigation!.nodes.find(
    (node) => node.target_fact === "comparability",
  )!;
  await answer("unstable");
  // Reproduce saved history where a technician also followed an earlier sibling.
  await act({ action: "select_investigation", node_id: sibling.id });
  await answer("unknown");
  await page.goto(`/incidents/${incident.id}/investigation`);
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  await expect(graph.locator(".flowchart-node.is-active")).toHaveCount(1);
  await graph.getByRole("button", { name: "Fit chart" }).click();
  const byParent = new Map<string, string[]>();
  for (const node of incident.investigation!.nodes) {
    if (node.status === "superseded") continue;
    const parent = node.parent_answer_id
      ? `response-${node.parent_answer_id}`
      : (node.parent_id ?? "flow-start");
    const paths = byParent.get(parent) ?? [];
    const path = await graph
      .locator(
        `[data-testid="rf__edge-edge-${node.id}"] .react-flow__edge-path`,
      )
      .getAttribute("d");
    expect(path).toMatch(/^M [-\d.]+ [-\d.]+ V [-\d.]+ H [-\d.]+ V [-\d.]+$/);
    paths.push(path!);
    byParent.set(parent, paths);
  }
  expect(
    [...byParent.values()].filter((paths) => paths.length > 1).length,
  ).toBeGreaterThanOrEqual(3);
  for (const paths of byParent.values())
    expect(
      new Set(paths.map((path) => path.split(" V ")[1].split(" H ")[0])).size,
    ).toBe(1);
  await graph.screenshot({
    path: testInfo.outputPath("branch-relationships.png"),
  });
  await expect(graph.locator(".flowchart-node.stage-statement")).toHaveCount(3);
  await page.setViewportSize({ width: 375, height: 844 });
  await graph.getByRole("button", { name: "Focus current question" }).click();
  await expect(
    graph.locator(".flowchart-node.is-active button"),
  ).toBeInViewport();
});

for (const manualChoice of [false, true]) {
  test(`answered branch greys out its alternatives${manualChoice ? " after a technician selection" : ""}`, async ({
    page,
    request,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPartialReplay(page);
    await page
      .getByRole("button", { name: "Analyze available evidence" })
      .click();
    const graph = page.getByRole("region", {
      name: "Adaptive investigation",
      exact: true,
    });
    const response = graph.locator(".investigation-conversation");
    const answer = async (value: string) => {
      await response.locator(`input[type="radio"][value="${value}"]`).check();
      await response.locator('input[type="radio"]:checked + span').click();
    };
    await answer("intermittent");
    await expect(graph.locator(".flowchart-node.is-proposed")).toHaveCount(2);
    if (manualChoice) {
      await graph
        .locator('.flowchart-node[data-question-type="verification"] button')
        .click();
      await graph.getByRole("button", { name: "Follow this branch" }).click();
      await expect(graph.locator(".flowchart-node.is-active")).toHaveAttribute(
        "data-question-type",
        "verification",
      );
    }
    const followed = graph.locator(
      ".react-flow__node:has(.flowchart-node.is-active)",
    );
    const followedId = await followed.getAttribute("data-id");
    await answer(manualChoice ? "unknown" : "unstable");
    const deferred = graph.locator(".flowchart-node.is-deferred");
    await expect(deferred).toHaveCount(2);
    await expect(deferred.locator(".flowchart-node-status")).toHaveText([
      "Set aside",
      "Set aside",
    ]);
    await expect(graph.locator(".flowchart-edge-deferred")).toHaveCount(2);
    await expect(
      graph.locator(".flowchart-edge-deferred .react-flow__edge-text"),
    ).toHaveCount(0);
    expect(
      await deferred.first().evaluate((node) => {
        const style = getComputedStyle(node);
        return (
          style.getPropertyValue("--shape-stroke") ===
          style.getPropertyValue("--slate-300")
        );
      }),
    ).toBeTruthy();
    const recorded = graph.locator(
      `.react-flow__node[data-id="${followedId}"]`,
    );
    await expect(recorded.locator(".flowchart-node")).toHaveClass(
      /is-answered/,
    );
    expect(await recorded.evaluate((node) => node.style.transform)).toMatch(
      /translate\(0px,/,
    );
    await expect(graph.locator(".flowchart-node.is-active")).toHaveCount(1);
    const statements = graph.locator(".flowchart-node.stage-statement");
    await expect(statements).toHaveCount(2);
    await expect(statements).toContainText([
      "The defect occurs intermittently.",
      manualChoice
        ? "Comparability remains unknown."
        : "Pressure records show variation.",
    ]);
    const id = page.url().match(/\/incidents\/(INC-[^/]+)/)![1];
    const incident: Incident = await (
      await request.get(`/api/incidents/${id}`)
    ).json();
    const saved = incident.investigation!.answers.find(
      (answer) => answer.node_id === followedId,
    )!;
    const statementNode = graph.locator(
      `.react-flow__node[data-id="response-${saved.id}"]`,
    );
    const sentencePosition = await statementNode.evaluate(
      (node) => node.style.transform,
    );
    const questionPosition = await recorded.evaluate(
      (node) => node.style.transform,
    );
    expect(sentencePosition).toMatch(/translate\(0px,/);
    expect(parseFloat(sentencePosition.split(",")[1])).toBeGreaterThan(
      parseFloat(questionPosition.split(",")[1]),
    );
    await statementNode.getByRole("button").click();
    await expect(graph.locator(".investigation-answer-panel")).toContainText(
      saved.choice!,
    );
    await graph
      .getByRole("button", { name: "Close explanation panel" })
      .click();
    await page.reload();
    await expect(deferred).toHaveCount(2);
    await expect(statements).toHaveCount(2);
    await graph.getByRole("button", { name: "Fit chart" }).click();
    await graph.screenshot({ path: testInfo.outputPath("answered-path.png") });
    await deferred.first().getByRole("button").click();
    await expect(response).toContainText("Set aside · the flow continues");
    await expect(
      graph.getByRole("button", { name: "Follow this branch" }),
    ).toHaveCount(0);
    await graph.getByRole("button", { name: "Ordered text view" }).click();
    await expect(graph.locator(".investigation-node.is-deferred")).toHaveCount(
      2,
    );
    const root = graph.locator(".investigation-node.is-answered").first();
    await root.getByRole("button", { name: "Correct this answer" }).click();
    await root.locator('input[type="radio"][value="sudden"]').check();
    await root.locator('input[type="radio"]:checked + span').click();
    await expect(graph.locator(".investigation-node.is-deferred")).toHaveCount(
      0,
    );
    await expect(graph.locator(".investigation-statement")).toHaveCount(1);
    await expect(graph.locator(".investigation-statement")).toContainText(
      "The defect appeared suddenly.",
    );
  });
}

test("side panel edge resizes both panels without losing drafts or covering the question", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPartialReplay(page);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const panel = graph.locator(".investigation-answer-panel");
  const edge = graph.getByRole("separator", { name: "Resize side panel" });
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  const editor = graph.locator(".investigation-conversation");
  const notes = editor.getByLabel("Talk through what you're seeing");
  await fillObservation(editor, "Keep this draft while resizing");
  const initial = (await panel.boundingBox())!;
  const drag = async (delta: number) => {
    const bounds = (await edge.boundingBox())!;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - delta, y, { steps: 10 });
    await page.mouse.up();
  };
  await drag(200);
  await expect
    .poll(async () => (await panel.boundingBox())!.width)
    .toBe(initial.width + 200);
  const wider = (await panel.boundingBox())!;
  expect(wider.x + wider.width).toBe(initial.x + initial.width);
  await expect
    .poll(async () => {
      const question = (await graph
        .locator(".flowchart-node.is-active button")
        .boundingBox())!;
      return question.x + question.width < wider.x;
    })
    .toBeTruthy();
  await drag(-150);
  await expect
    .poll(async () => (await panel.boundingBox())!.width)
    .toBe(initial.width + 50);
  await drag(1000);
  await expect(panel).toHaveCSS("width", "720px");
  await graph.getByRole("button", { name: "5 Whys", exact: true }).click();
  await expect(panel).toHaveCSS("width", "720px");
  await drag(-1000);
  await expect(panel).toHaveCSS("width", "320px");
  await edge.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(panel).toHaveCSS("width", "340px");
  await page.keyboard.press("End");
  await expect(panel).toHaveCSS("width", "720px");
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect
    .poll(async () => (await panel.boundingBox())!.width <= 1024 * 0.6)
    .toBeTruthy();
  await graph.getByRole("button", { name: "Close reasoning panel" }).click();
  await graph.getByRole("button", { name: "Show reasoning panel" }).click();
  await panel.getByRole("button", { name: "Back to question" }).click();
  await expect(notes).toHaveValue("Keep this draft while resizing");
  await graph.screenshot({
    path: testInfo.outputPath("resized-side-panel.png"),
  });
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(edge).toBeHidden();
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBeTruthy();
});

test("question details group shared meanings and disclose full source records", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await openPartialReplay(page);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const active = graph.locator(
    ".investigation-conversation:has(.investigation-response.is-active), .investigation-ordered .investigation-node.is-active",
  );
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  await active.locator('input[type="radio"][value="sudden"]').check();
  await active.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", /material records/);
  await graph
    .locator('.flowchart-node[data-question-type="which"] button')
    .click();
  const detail = graph.locator(".investigation-question-detail");
  await expect(
    detail.getByRole("heading", { name: "Why this matters" }),
  ).toBeVisible();
  await expect(detail.locator(".investigation-choice-meanings li")).toHaveCount(
    2,
  );
  await expect(detail.getByText("Flux / Other", { exact: true })).toBeVisible();
  await expect(
    detail.getByText(
      "Material identity limits which explanations are applicable; batch may remain unknown.",
      { exact: false },
    ),
  ).toHaveCount(1);
  const sources = detail.locator(".investigation-detail-source");
  await expect(sources).toHaveCount(3);
  await expect(sources.locator("summary small")).toHaveText([
    "unverified",
    "unverified",
    "unverified",
  ]);
  await expect(sources.locator("blockquote").first()).toBeHidden();
  await sources.first().locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(sources.first().locator("blockquote")).toBeVisible();
  await expect(sources.first()).toContainText("Limitations:");
  await expect(
    sources.first().locator(".investigation-detail-meta"),
  ).toContainText("1.0 (2026-09-30); unverified");
  await page.keyboard.press("Enter");
  await expect(sources.first().locator("blockquote")).toBeHidden();
  const metadata = detail.locator(".investigation-detail-metadata");
  await expect(metadata.getByText(/Incident revision/)).toBeHidden();
  await metadata.locator("summary").click();
  await expect(metadata.getByText(/Incident revision/)).toBeVisible();
  await metadata.locator("summary").click();
  await detail.scrollIntoViewIfNeeded();
  await detail.screenshot({
    path: testInfo.outputPath("question-details-desktop.png"),
  });
  await page.setViewportSize({ width: 375, height: 844 });
  await detail.scrollIntoViewIfNeeded();
  expect(
    await detail.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await graph.getByRole("button", { name: "Ordered text view" }).click();
  await detail.scrollIntoViewIfNeeded();
  await detail.screenshot({
    path: testInfo.outputPath("question-details-mobile.png"),
  });
});

test("question colors distinguish 5W2H purpose from causal analysis and preserve drafts", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPartialReplay(page);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const active = graph.locator(
    ".investigation-conversation:has(.investigation-response.is-active), .investigation-ordered .investigation-node.is-active",
  );
  await expect(graph.locator(".flowchart-node.is-active")).toHaveAttribute(
    "data-question-type",
    "when",
  );
  await active.locator('input[type="radio"][value="intermittent"]').check();
  await active.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", /pressure records/);
  await expect(graph.locator(".flowchart-node.is-active")).toHaveAttribute(
    "data-question-type",
    "what",
  );
  const categoryColors = () =>
    graph.locator(".flowchart-node[data-question-type]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        type: node.getAttribute("data-question-type"),
        color: getComputedStyle(node.querySelector(".flowchart-shape > svg")!)
          .stroke,
      })),
    );
  const colors = await categoryColors();
  expect(colors.map((item) => item.type).sort()).toEqual([
    "verification",
    "what",
    "when",
    "which",
  ]);
  expect(new Set(colors.map((item) => item.color)).size).toBe(4);
  await graph.getByRole("button", { name: "Fit chart" }).click();
  await page.screenshot({
    path: testInfo.outputPath("question-types-desktop.png"),
  });
  const legend = graph.locator(".investigation-color-key");
  await legend.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(legend).toHaveAttribute("open", "");
  await expect(legend).toContainText("5W2H defines the problem");
  await expect(legend.locator(".question-color-item")).toHaveCount(10);
  await page.screenshot({
    path: testInfo.outputPath("question-types-legend.png"),
  });
  await legend.locator("summary").click();
  await active.locator('input[type="radio"][value="unstable"]').check();
  await fillObservation(active, "Keep this draft while tracing the cause");
  const id = page.url().match(/\/incidents\/(INC-[^/]+)/)![1];
  const before: Incident = await (
    await request.get(`/api/incidents/${id}`)
  ).json();
  const delivery = before.assessment!.hypotheses.find(
    (item) => item.id === "unstable_delivery",
  )!;
  const toggle = graph.getByRole("button", {
    name: "5 Whys",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const panel = graph.getByRole("complementary", {
    name: "5 Whys causal analysis",
    exact: true,
  });
  await panel.getByLabel("Explanation to trace").selectOption(delivery.id);
  await expect(
    panel.getByRole("group", { name: "Five Why levels" }).getByRole("button"),
  ).toHaveCount(5);
  await expect(
    panel
      .getByRole("group", { name: "Mechanism and verification" })
      .getByRole("button"),
  ).toHaveCount(2);
  await expect(panel).toContainText(
    "The physical mechanism is not yet supported",
  );
  const detail = panel.locator(".why-how-detail");
  await expect(detail).toContainText(delivery.why_chain[0].question);
  await expect(detail).toContainText(delivery.why_chain[0].explanation);
  await expect(detail).toContainText(delivery.why_chain[0].status);
  expect(await categoryColors()).toEqual(colors);
  await panel.getByRole("button", { name: "Why 3", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(detail).toContainText("Not yet established");
  await expect(detail).toContainText(
    "No causal step is recorded at this level",
  );
  await panel.getByRole("button", { name: "Mechanism", exact: true }).click();
  await expect(detail).toContainText(delivery.how_mechanism);
  await panel
    .getByRole("button", { name: "Verification", exact: true })
    .click();
  await expect(detail).toContainText(delivery.how_to_test);
  await panel.getByLabel("Explanation to trace").selectOption("restriction");
  expect(await categoryColors()).toEqual(colors);
  await expect(
    panel.getByRole("button", { name: "Why 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await panel.getByLabel("Explanation to trace").selectOption(delivery.id);
  await graph.getByRole("button", { name: "Fit chart" }).click();
  await page.screenshot({ path: testInfo.outputPath("five-whys-desktop.png") });
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(toggle).toBeInViewport();
  await panel
    .getByRole("button", { name: "Verification", exact: true })
    .click();
  await detail.scrollIntoViewIfNeeded();
  await expect(detail.getByRole("heading")).toBeInViewport();
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("five-whys-mobile.png") });
  await panel.getByRole("button", { name: "Close reasoning panel" }).click();
  await expect(panel).toBeHidden();
  await graph.getByRole("button", { name: "Show reasoning panel" }).click();
  await panel.getByRole("button", { name: "Back to question" }).click();
  await expect(
    active.getByLabel("Talk through what you're seeing"),
  ).toHaveValue("Keep this draft while tracing the cause");
  await expect(
    active.locator('input[type="radio"][value="unstable"]'),
  ).toBeChecked();
  expect(await categoryColors()).toEqual(colors);
  await page.screenshot({
    path: testInfo.outputPath("question-types-mobile.png"),
  });
  await legend.locator("summary").click();
  await expect(
    legend.getByText("How · detected", { exact: true }),
  ).toBeInViewport();
  const legendBounds = await legend
    .locator(".investigation-color-popover")
    .boundingBox();
  expect(legendBounds!.x).toBeGreaterThanOrEqual(0);
  expect(legendBounds!.x + legendBounds!.width).toBeLessThanOrEqual(375);
  await legend.locator("summary").click();
  await toggle.click();
  await graph.getByRole("button", { name: "Ordered text view" }).click();
  await expect(
    graph.locator(".investigation-node[data-question-type]"),
  ).toHaveCount(4);
  await graph.getByRole("button", { name: "Why 5", exact: true }).click();
  await expect(graph.locator(".why-how-detail")).toContainText(
    "Not yet established",
  );
  const after: Incident = await (
    await request.get(`/api/incidents/${id}`)
  ).json();
  expect(after.revision).toBe(before.revision);
  expect(after.investigation).toEqual(before.investigation);
  await page.reload();
  await expect.poll(categoryColors).toEqual(colors);
  await page.setViewportSize({ width: 844, height: 390 });
  await legend.locator("summary").click();
  const landscapeKey = await legend
    .locator(".investigation-color-popover")
    .boundingBox();
  expect(landscapeKey!.y + landscapeKey!.height).toBeLessThanOrEqual(390);
  await legend
    .getByText("Unclassified", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    legend.getByText("Unclassified", { exact: true }),
  ).toBeInViewport();
});

test("saved graph answers, alternatives, drafts, correction and text interaction", async ({
  page,
}, testInfo) => {
  await openPartialReplay(page);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  await expect(graph.locator(".react-flow__node")).toHaveCount(2);
  await expect(graph.locator(".flowchart-node.stage-start")).toHaveCount(1);
  await expect(
    graph.locator(".flowchart-node.stage-decision svg polygon"),
  ).toHaveCount(1);
  await expect(graph.getByRole("button", { name: "Fit chart" })).toBeEnabled();
  await expect(graph).toHaveClass(/is-expanded/);
  const canvas = graph.locator(".investigation-canvas");
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  const panel = graph.getByRole("complementary", {
    name: "Question explanation",
  });
  expect(
    await canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const header = document
        .querySelector(".command-bar")!
        .getBoundingClientRect();
      return (
        bounds.left === 0 &&
        bounds.right <=
          document
            .querySelector(".investigation-live-timeline")!
            .getBoundingClientRect().left &&
        Math.abs(bounds.bottom - innerHeight) < 1 &&
        Math.abs(bounds.top - header.bottom) < 1
      );
    }),
  ).toBeTruthy();
  await expect(panel).toHaveCSS("position", "absolute");
  const viewport = graph.locator(".react-flow__viewport");
  const initialViewport = await viewport.getAttribute("style");
  const root = graph.locator(".react-flow__node:has(.stage-decision)").first();
  const rootPosition = await root.getAttribute("style");
  const active = graph.locator(
    ".investigation-conversation:has(.investigation-response.is-active), .investigation-ordered .investigation-node.is-active",
  );
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", /progressive, intermittent/);
  await active.locator('input[type="radio"][value="intermittent"]').check();
  await active.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", /pressure records/);
  await expect(graph.locator(".react-flow__node")).toHaveCount(6);
  await expect(root).toHaveAttribute("style", rootPosition!);
  await expect(viewport).not.toHaveAttribute("style", initialViewport!);
  await expect(
    graph.locator(".flowchart-node.stage-evidence svg polygon"),
  ).toHaveCount(1);
  await expect(
    graph.locator(".react-flow__edge-text").filter({ hasText: "intermittent" }),
  ).toHaveCount(1);
  await expect(
    graph.locator(".react-flow__edge-text").filter({ hasText: "Alternative" }),
  ).toHaveCount(2);
  await expect(
    graph.locator(".flowchart-edge-current .react-flow__edge-path"),
  ).toHaveAttribute("marker-end", /url/);
  await graph.getByRole("button", { name: "Focus current question" }).click();
  await expect
    .poll(async () => {
      const question = await graph
        .locator(".flowchart-node.is-active button")
        .boundingBox();
      const sidebar = await panel.boundingBox();
      return !!question && !!sidebar && question.x + question.width < sidebar.x;
    })
    .toBeTruthy();
  await fillObservation(active, "Keep this note while inspecting evidence");
  await graph.getByRole("button", { name: "Close explanation panel" }).click();
  await expect(panel).toBeHidden();
  await expect(
    graph.getByRole("button", { name: "Show explanation panel" }),
  ).toBeFocused();
  await graph.getByRole("button", { name: "Show explanation panel" }).click();
  await expect(
    active.getByLabel("Talk through what you're seeing"),
  ).toHaveValue("Keep this note while inspecting evidence");
  await graph.getByRole("button", { name: "Exit full screen" }).focus();
  await page.keyboard.press("Escape");
  await expect(graph).not.toHaveClass(/is-expanded/);
  await expect(
    graph.getByRole("button", { name: "Full screen", exact: true }),
  ).toBeFocused();
  await graph.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(graph).toHaveClass(/is-expanded/);
  await page.getByRole("link", { name: "Evidence", exact: true }).click();
  await page.getByRole("link", { name: "Investigation", exact: true }).click();
  await expect(
    active.getByLabel("Talk through what you're seeing"),
  ).toHaveValue("Keep this note while inspecting evidence");
  const sources = graph.locator(".investigation-graph-context");
  await sources.locator(":scope > summary").click();
  await active
    .getByRole("button", { name: "Evidence & why this question" })
    .click();
  await expect(sources).toHaveAttribute("open", "");
  await expect(sources.locator(":scope > summary")).toBeFocused();
  await fillObservation(active, "");
  const shape = graph.locator(".flowchart-node.is-proposed button").first();
  const shapePrompt = await shape.getAttribute("title");
  await shape.focus();
  await page.keyboard.press("Enter");
  await expect(
    graph.getByRole("complementary", { name: "Question explanation" }),
  ).toContainText(shapePrompt!);
  await expect(
    graph.locator(".flowchart-node.is-active button"),
  ).toHaveAttribute("title", /pressure records/);
  await graph.getByRole("button", { name: "Back to current" }).click();
  await graph.getByRole("button", { name: "Ordered text view" }).click();
  const alternative = graph.locator(".investigation-node.is-proposed").first();
  const prompt = await alternative.getByRole("heading").textContent();
  await alternative.getByRole("button", { name: "Follow this branch" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", `Respond to ${prompt}`);
  await page.reload();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", `Respond to ${prompt}`);
  await graph.getByRole("button", { name: "Ordered text view" }).click();
  const answered = graph.locator(".investigation-node.is-answered").first();
  await answered.getByRole("button", { name: "Correct this answer" }).click();
  await answered.locator('input[type="radio"][value="sudden"]').check();
  await answered.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", /material records/);
  await graph.getByLabel("Earlier paths", { exact: true }).check();
  await expect(graph.locator(".investigation-node.is-superseded")).toHaveCount(
    3,
  );
  await page.screenshot({
    path: testInfo.outputPath("graph-text.png"),
    fullPage: true,
  });
  await graph.getByLabel("Earlier paths", { exact: true }).uncheck();
  await graph.getByRole("button", { name: "Show chart" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await graph.getByRole("button", { name: "Fit chart" }).click();
  await expect(graph.locator(".flowchart-node.is-active")).toHaveCSS(
    "animation-name",
    "none",
  );
  await graph.getByRole("button", { name: "Show explanation panel" }).click();
  await graph.locator(".investigation-graph-context > summary").click();
  await graph.locator(".investigation-panel-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: testInfo.outputPath("graph-desktop.png"),
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect
    .poll(async () => {
      const question = await graph
        .locator(".flowchart-node.is-active button")
        .boundingBox();
      const sidebar = await panel.boundingBox();
      return !!question && !!sidebar && question.x + question.width < sidebar.x;
    })
    .toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("graph-tablet.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await graph.getByRole("button", { name: "Focus current question" }).click();
  await page.screenshot({
    path: testInfo.outputPath("graph-mobile-chart.png"),
  });
  await graph.getByRole("button", { name: "Close explanation panel" }).click();
  await expect(panel).toBeHidden();
  await expect(canvas).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("graph-mobile-collapsed.png"),
  });
  await graph.getByRole("button", { name: "Show explanation panel" }).click();
  const mobileCanvas = await canvas.boundingBox();
  await active.locator('input[type="radio"][value="unknown"]').check();
  await active.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).not.toHaveAttribute("aria-label", /material records identify/);
  await expect(graph).toHaveClass(/is-expanded/);
  expect(await canvas.boundingBox()).toEqual(mobileCanvas);
  await graph.getByRole("button", { name: "Ordered text view" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("graph-mobile.png"),
    fullPage: true,
  });
});

test("ambiguous answers create a clarification shape and retain the original words", async ({
  page,
}, testInfo) => {
  await openPartialReplay(page);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const active = graph.locator(
    ".investigation-conversation:has(.investigation-response.is-active), .investigation-ordered .investigation-node.is-active",
  );
  await active.locator('input[type="radio"][value="__text"]').check();
  await active
    .getByLabel("Answer in your own words")
    .fill("It seems odd, maybe sometimes");
  await active.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".flowchart-node.stage-clarify.is-active"),
  ).toHaveCount(1);
  await expect(
    graph.locator(".flowchart-node.stage-statement.is-clarification"),
  ).toContainText("The response needs clarification.");
  await expect(
    graph.locator(".flowchart-node.stage-clarify svg polygon"),
  ).toHaveAttribute("points", /28,2 252,2/);
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).toHaveAttribute("aria-label", /Clarify the saved answer/);
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  await graph.getByText("Original answer history · 1", { exact: true }).click();
  await expect(graph).toContainText("It seems odd, maybe sometimes");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await graph.getByRole("button", { name: "Fit chart" }).click();
  await graph.screenshot({
    path: testInfo.outputPath("graph-clarification.png"),
    style: ".command-bar, .skip-link { visibility: hidden !important; }",
  });
  await active.locator('input[type="radio"][value="unknown"]').check();
  await active.locator('input[type="radio"]:checked + span').click();
  await expect(
    graph.locator(".investigation-response.is-active"),
  ).not.toHaveAttribute("aria-label", /Clarify the saved answer/);
  await expect(
    graph.locator(".flowchart-node.stage-statement.is-clarified"),
  ).toContainText("The original response was clarified.");
  await expect(
    graph.locator(".flowchart-node.stage-statement.is-unknown"),
  ).toContainText("Frequency remains unknown.");
});
