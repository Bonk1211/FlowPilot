import { expect, test } from "@playwright/test";

test("demo save adds an open investigation finding to the overall graph with an arrival animation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(45000);
  // Give the shared library an existing case, symptom and component to connect to.
  const legacy = await request.post("/api/investigations", {
    data: {
      report: "Earlier S932 incomplete coverage investigation",
      sample_id: "incomplete",
    },
  });
  expect(legacy.ok()).toBeTruthy();
  let previousCase = await legacy.json();
  for (const answer of ["continuous", "yes", "no", "unknown", "unknown"]) {
    const response = await request.post(
      `/api/investigations/${previousCase.investigation.id}/actions`,
      {
        data: {
          revision: previousCase.revision,
          action: "answer",
          question_id: previousCase.next_question.id,
          value: answer,
        },
      },
    );
    expect(response.ok()).toBeTruthy();
    previousCase = await response.json();
  }
  const reference = await request.post("/api/incident-knowledge", {
    data: {
      document_id: "S932-CONSOLIDATED-RAG",
      document_revision: "test-r1",
      title: "S-932 troubleshooting reference",
      authority: "secondary_summary",
      configurations: ["S932"],
      original_ref: "test-fixture:knowledge-animation",
      passages: [
        "Equipment configuration",
        "Material and idle history",
        "Nozzle inspection",
        "Coverage observations",
        "Recovery cases",
        "Production verification",
        "Maintenance records",
        "Repair and calibration",
        "Material identification",
        "Acceptance criteria",
        "Source evidence",
        "Diagnostic comparisons",
      ].map((section, index) => ({
        id: `section-${index + 1}`,
        section: `${index + 1}. ${section}`,
        text: "Illustrative nozzle records describe incomplete coverage. Preserve the source context; this is not a machine procedure.",
      })),
    },
  });
  expect(reference.ok()).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const earlier = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `earlier-knowledge-${Date.now()}` },
    })
  ).json();
  const previousSave = await request.post(
    `/api/incidents/${earlier.id}/actions`,
    {
      data: {
        action: "capture_knowledge",
        revision: earlier.revision,
        knowledge_id: "KN-previous-demo",
        title: "Earlier coverage finding",
        summary: "An earlier investigation retained a coverage comparison.",
        evidence_ids: earlier.evidence
          .filter((item: { status: string }) => item.status === "collected")
          .map((item: { id: string }) => item.id),
      },
    },
  );
  expect(previousSave.ok()).toBeTruthy();
  await page.setViewportSize({ width: 1512, height: 1100 });
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-/);
  const id = new URL(page.url()).pathname.split("/")[2];
  const before = await (await request.get(`/api/incidents/${id}`)).json();
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Learning database" })
    .click();
  const database = page.getByRole("region", {
    name: "Learning Database",
    exact: true,
  });
  const graph = database.getByRole("region", {
    name: "Overall knowledge graph",
    exact: true,
  });
  const captured = database.getByRole("region", {
    name: "Captured knowledge",
    exact: true,
  });
  const save = database.getByRole("button", {
    name: "Demo save knowledge",
    exact: true,
  });
  await expect(save).toBeEnabled();
  await expect(captured).toContainText("Earlier coverage finding");
  const originalNodes = Number(
    (await graph.getByRole("img").getAttribute("aria-label"))!.match(
      /with (\d+) nodes/,
    )![1],
  );
  const title = `Material context explains what to compare ${Date.now()}`;
  const summary =
    "Retain before/after coverage images with the material change history. The cause remains unconfirmed.";
  await database.getByLabel("Knowledge title", { exact: true }).fill(title);
  await database
    .getByRole("textbox", { name: "New knowledge", exact: true })
    .fill(summary);
  await save.click();
  await expect(graph.getByRole("status")).toContainText("New knowledge added");
  const paths = graph.locator(".knowledge-connection-overlay");
  const directCount = await paths.locator('g[data-wave="direct"]').count();
  expect(directCount).toBeGreaterThanOrEqual(6);
  await expect(graph.getByRole("status")).toContainText(
    `+${directCount} connections`,
  );
  const libraryLinks = graph.getByLabel("Connections to the main library");
  await expect(libraryLinks).toContainText("Incomplete coverage");
  await expect(libraryLinks).toContainText("DJ-2200 nozzle");
  await expect(libraryLinks).toContainText("S-932");
  const firstLink = paths.locator('g[data-wave="direct"]').first();
  await expect(firstLink).toHaveAttribute("data-state", "drawing");
  await expect(firstLink.locator(".knowledge-link-draw")).toHaveAttribute(
    "d",
    /^M .+ [QL] .+/,
  );
  const drawProgress = Number.parseFloat(
    await firstLink
      .locator(".knowledge-link-draw")
      .evaluate((path) => getComputedStyle(path).strokeDashoffset),
  );
  expect(drawProgress).toBeGreaterThan(0);
  expect(drawProgress).toBeLessThan(1);
  await expect(paths.locator('g[data-wave="direct"]').last()).toHaveAttribute(
    "data-state",
    "waiting",
  );
  expect(await paths.locator('g[data-wave="library"]').count()).toBeGreaterThan(
    0,
  );
  await expect(captured).toContainText(title);
  await expect(captured).toContainText("Earlier coverage finding");
  const halo = graph.locator(".knowledge-node-arrival");
  await expect(halo).toHaveAttribute("data-motion", "animated");
  await expect(graph.getByRole("img")).toHaveAttribute(
    "aria-label",
    new RegExp(`with ${originalNodes + 1} nodes`),
  );
  await expect(save).toBeDisabled();
  await database.screenshot({
    path: testInfo.outputPath("knowledge-arrival-desktop.png"),
  });
  const saved = await (await request.get(`/api/incidents/${id}`)).json();
  expect(saved.status).toBe(before.status);
  expect(saved.closure).toBeNull();
  expect(saved.learning).toBeNull();
  expect(saved.captured_knowledge).toHaveLength(1);
  expect(saved.captured_knowledge[0]).toMatchObject({
    title,
    summary,
    status: "draft",
    demo: true,
    source_revision: before.revision,
  });
  const knowledgeId = saved.captured_knowledge[0].id;
  await expect(halo).toHaveAttribute(
    "data-knowledge-id",
    `knowledge:${id}:${knowledgeId}`,
  );
  await expect(
    database.getByRole("complementary", { name: "Selected knowledge details" }),
  ).toContainText(summary);
  await graph
    .getByText("Browse nodes and relationships with keyboard", { exact: true })
    .click();
  await expect(
    graph.getByRole("button", { name: `Knowledge: ${title}`, exact: true }),
  ).toBeVisible();
  await graph
    .getByText("Browse nodes and relationships with keyboard", { exact: true })
    .click();
  await expect(paths).toHaveAttribute("data-phase", "2");
  await database.screenshot({
    path: testInfo.outputPath("knowledge-library-propagation.png"),
  });
  await expect(paths).toHaveAttribute("data-phase", "3");
  await expect(paths.locator('g[data-state="connected"]')).toHaveCount(
    await paths.locator("g").count(),
  );
  // Every animated route corresponds to an actual graph relationship.
  const routes = await paths.locator("g").evaluateAll((groups) =>
    groups.map((group) => ({
      id: group.getAttribute("data-edge-id"),
      from: group.getAttribute("data-from"),
      to: group.getAttribute("data-to"),
    })),
  );
  const relationships = await graph
    .locator("button[data-edge-id]")
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        id: button.getAttribute("data-edge-id"),
        from: button.getAttribute("data-source"),
        to: button.getAttribute("data-target"),
      })),
    );
  for (const route of routes) {
    const edge = relationships.find((item) => item.id === route.id)!;
    expect(edge).toBeTruthy();
    expect([edge.from, edge.to].sort()).toEqual([route.from, route.to].sort());
  }
  await database
    .getByRole("button", { name: "Replay animation", exact: true })
    .click();
  await expect(halo).toHaveAttribute("data-motion", "animated");
  expect(
    (await (await request.get(`/api/incidents/${id}`)).json())
      .captured_knowledge,
  ).toHaveLength(1);
  await expect(paths).toHaveAttribute("data-phase", "1");
  await expect(paths).toHaveAttribute("data-phase", "3", { timeout: 10000 });
  await database.screenshot({
    path: testInfo.outputPath("knowledge-saved-desktop.png"),
  });
  await page.reload();
  await expect(captured).toContainText(title);
  await captured.getByRole("button", { name: new RegExp(title) }).click();
  await expect(
    database.getByRole("complementary", { name: "Selected knowledge details" }),
  ).toContainText(summary);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await database
    .getByLabel("Knowledge title", { exact: true })
    .fill("A second finding with reduced motion");
  await database
    .getByRole("textbox", { name: "New knowledge", exact: true })
    .fill("Keep the original timestamps with each coverage image.");
  await save.click();
  await expect(graph.getByRole("status")).toContainText(
    "A second finding with reduced motion",
  );
  await expect(halo).toHaveAttribute("data-motion", "reduced");
  await expect(halo).toBeHidden();
  await expect(paths).toBeHidden();
  await expect(paths).toHaveAttribute("data-phase", "3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("knowledge-demo-mobile.png"),
    fullPage: true,
  });
  const next = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `next-knowledge-${Date.now()}` },
    })
  ).json();
  await page.goto(`/incidents/${next.id}/knowledge`);
  await expect(captured).toContainText(title);
  await expect(captured).toContainText("A second finding with reduced motion");
  expect(errors).toEqual([]);
});

test("a failed save retains the finding and retry does not duplicate a committed record", async ({
  page,
  request,
}) => {
  const incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `knowledge-retry-${Date.now()}` },
    })
  ).json();
  await page.goto(`/incidents/${incident.id}/knowledge`);
  const save = page.getByRole("button", {
    name: "Demo save knowledge",
    exact: true,
  });
  await expect(save).toBeEnabled();
  await page
    .getByLabel("Knowledge title", { exact: true })
    .fill("Retain a finding across a failed response");
  const routePattern = `**/api/incidents/${incident.id}/actions`;
  await page.route(
    routePattern,
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBeTruthy();
      await route.fulfill({
        status: 503,
        json: { detail: "The save response was interrupted. Try again." },
      });
    },
    { times: 1 },
  );
  await save.click();
  await expect(
    page
      .getByRole("complementary", {
        name: "New knowledge from this investigation",
      })
      .getByRole("alert"),
  ).toContainText("Try again");
  await expect(page.getByLabel("Knowledge title", { exact: true })).toHaveValue(
    "Retain a finding across a failed response",
  );
  await expect(page.locator(".knowledge-node-arrival")).toHaveCount(0);
  await save.click();
  await expect(page.locator(".knowledge-arrival-notice")).toContainText(
    "New knowledge added",
  );
  const saved = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  expect(saved.captured_knowledge).toHaveLength(1);
  expect(saved.status).toBe(incident.status);
});
