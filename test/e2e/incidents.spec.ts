import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function goToFeature(page: Page, name: string) {
  const navigation = page.getByRole("navigation", {
    name: "Incident features",
    exact: true,
  });
  if (!(await navigation.isVisible()))
    await page
      .getByRole("button", { name: "Expand navigation", exact: true })
      .click();
  await navigation.getByRole("link", { name, exact: true }).click();
}

async function startReplay(page: Page) {
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-/);
  await expect(
    page.getByRole("heading", {
      name: "Progressively insufficient flux coverage",
    }),
  ).toBeVisible();
  await goToFeature(page, "Investigation");
}

async function analyzeReplay(page: Page) {
  await goToFeature(page, "Evidence");
  await page.getByRole("button", { name: "Collect next evidence" }).click();
  await expect(
    page.getByRole("button", { name: "Collect next evidence" }),
  ).toHaveCount(0);
  await goToFeature(page, "Investigation");
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  await page.getByRole("button", { name: "Ordered text view" }).click();
  await expect(
    page.getByRole("heading", { name: "Investigate competing causes" }),
  ).toBeVisible();
  await expect(
    page.locator(".investigation-node.is-active .stage-check svg rect"),
  ).toHaveCount(1);
}

async function recordResult(page: Page, result: string) {
  const active = page.locator(".investigation-node.is-active");
  await active.locator(`input[type="radio"][value="${result}"]`).check();
  const response = page.waitForResponse(
    (item) =>
      item.url().endsWith("/actions") && item.request().method() === "POST",
  );
  await active.locator('input[type="radio"]:checked + span').click();
  expect((await response).ok()).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Reassess evidence" }),
  ).toBeEnabled();
}

test("incident replay preserves the early handoff, branches, exports and survives reload", async ({
  page,
}, testInfo) => {
  await startReplay(page);
  const url = page.url();
  await goToFeature(page, "Handoff");
  const handoff = page.getByRole("region", {
    name: "Engineer handoff",
    exact: true,
  });
  await expect(handoff.getByLabel("Handoff message")).toHaveValue(
    /Diagnosis is pending/,
  );
  await expect(
    handoff.getByText("Draft · not sent", { exact: true }),
  ).toBeVisible();
  await handoff
    .getByLabel("Handoff message")
    .fill("Engineer note: preserve the material container identity.");
  await handoff.getByRole("button", { name: "Save handoff edits" }).click();
  await expect(
    handoff.getByRole("button", { name: "Save handoff edits" }),
  ).toBeDisabled();
  await goToFeature(page, "Investigation");
  await analyzeReplay(page);
  await expect(
    page.getByRole("heading", {
      name: "Compare recorded delivery evidence",
      exact: true,
    }),
  ).toBeVisible();
  await recordResult(page, "contradicted");
  await expect(
    page.getByRole("heading", {
      name: "Review the recorded fluid-path finding",
      exact: true,
    }),
  ).toBeVisible();
  await recordResult(page, "supported");
  await expect(
    page.getByRole("heading", {
      name: "Review the supported explanation with engineering",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show chart" }).click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  await expect(
    graph
      .locator(".flowchart-node.stage-review")
      .getByRole("button", { name: /supported explanation/ }),
  ).toBeVisible();
  await expect(graph.locator(".investigation-answer-panel form")).toHaveCount(
    0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await graph.getByRole("button", { name: "Fit chart" }).click();
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  await graph.locator(".investigation-graph-context > summary").click();
  await graph.screenshot({
    path: testInfo.outputPath("graph-review.png"),
    style: ".command-bar, .skip-link { visibility: hidden !important; }",
  });
  await graph.getByRole("button", { name: "Exit full screen" }).click();
  await expect(page.locator(".investigation-candidate").first()).toContainText(
    "Fluid-path restriction",
  );
  await expect(page.locator(".investigation-candidate").first()).toContainText(
    "supported",
  );
  await page
    .getByRole("button", { name: /Material-condition change possible/ })
    .click();
  await goToFeature(page, "Simulation");
  await expect(page.locator(".incident-mechanism-text h3")).toHaveText(
    "Material-condition change",
  );
  await page.getByRole("button", { name: "2D schematic", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("incident-desktop.png"),
    fullPage: true,
  });
  await goToFeature(page, "Investigation");
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.locator(".investigation-candidate").first()).toContainText(
    "supported",
  );
  await goToFeature(page, "Handoff");
  await expect(handoff.getByLabel("Handoff message")).toHaveValue(
    "Engineer note: preserve the material container identity.",
  );
  await goToFeature(page, "Investigation");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Incident details", exact: true })
    .click();
  await page.getByRole("link", { name: "Export report", exact: true }).click();
  const file = await download;
  const text = await readFile((await file.path())!, "utf8");
  expect(text).toContain("Fluid-path restriction · supported");
  expect(text).not.toContain(
    "Engineer note: preserve the material container identity.",
  );
  expect(text).toContain("Investigation open; no final conclusion.");
  expect(text).not.toContain("```json");
});

test("inconclusive closure requires explicit demo review and learning stays a candidate", async ({
  page,
}) => {
  await startReplay(page);
  await analyzeReplay(page);
  for (let index = 0; index < 3; index++)
    await recordResult(page, "inconclusive");
  await expect(
    page
      .getByRole("heading", {
        name: "Escalate the unresolved investigation",
      })
      .last(),
  ).toBeVisible();
  await goToFeature(page, "Knowledge");
  await page.getByLabel("Reviewer name").fill("Demo reviewer");
  await page
    .getByLabel("Findings and unresolved questions")
    .fill(
      "All available checks were inconclusive. Preserve the missing PM record.",
    );
  await expect(
    page.getByRole("button", { name: "Save review and close" }),
  ).toBeDisabled();
  await page
    .getByLabel("Use the engineer role for this local demonstration")
    .check();
  await page.getByRole("button", { name: "Save review and close" }).click();
  await expect(
    page.getByText("Inconclusive — questions remain", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Experience: candidate", { exact: true }),
  ).toBeVisible();
  await page.getByText("Review experience for reuse", { exact: true }).click();
  await page
    .getByLabel("Review reason")
    .fill("Reviewed the uncertainty for reuse in compatible replay incidents.");
  await page
    .getByRole("button", { name: "Publish reviewed experience" })
    .click();
  await expect(
    page.getByText("Experience: published", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Withdraw experience" }).click();
  await expect(
    page.getByText("Experience: withdrawn", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Experience: withdrawn", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Incident details", exact: true })
    .click();
  await expect(
    page.getByText("Equipment disposition: not assessed", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close incident details", exact: true })
    .click();
  await goToFeature(page, "Evidence");
  await page
    .locator("summary")
    .filter({ hasText: /Source files/ })
    .click();
  await page.getByText("Add late evidence and reopen", { exact: true }).click();
  await page.getByLabel("Evidence JSON").fill(
    JSON.stringify({
      id: "late-material-note",
      kind: "context",
      role: "context",
      label: "Late material history",
      source_ref: "replay:late-material-history",
      synthetic: true,
      values: { material_condition: "changed" },
    }),
  );
  await page.getByRole("button", { name: "Save source evidence" }).click();
  await goToFeature(page, "Investigation");
  await expect(
    page.getByRole("button", { name: "Analyze available evidence" }),
  ).toBeVisible();
  await expect(
    page.getByText("Inconclusive — questions remain", { exact: true }),
  ).toHaveCount(0);
});

test("narrow workspace retains evidence, accessible schematic and recovery from failed retrieval", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startReplay(page);
  await analyzeReplay(page);
  await goToFeature(page, "Simulation");
  await page.getByRole("button", { name: "2D schematic", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play schematic" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("incident-mobile.png"),
    fullPage: true,
  });
  await goToFeature(page, "Knowledge");
  await page.route("**/api/incidents/*/experience", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page
    .getByText("Sources & past investigations", { exact: true })
    .click();
  await page.getByRole("button", { name: "Refresh experience" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Reviewed experience is unavailable" }),
  ).toBeVisible();
  await page.unroute("**/api/incidents/*/experience");
  await page.getByRole("button", { name: "Refresh experience" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Reviewed experience is unavailable" }),
  ).toHaveCount(0);
});

for (const outcome of ["accepted", "unknown"] as const) {
  test(`mock communication records ${outcome} and receipt states without sending email`, async ({
    page,
  }) => {
    const realSubmissions: string[] = [];
    page.on("request", (request) => {
      if (/\/communications\/[^/]+\/send$/.test(request.url()))
        realSubmissions.push(request.url());
    });
    await startReplay(page);
    await goToFeature(page, "Handoff");
    const handoff = page.getByRole("region", {
      name: "Engineer handoff",
      exact: true,
    });
    await handoff
      .getByRole("button", { name: "Simulate handoff", exact: true })
      .click();
    const message = handoff.locator(".incident-mail-record");
    await expect(message.locator(".incident-mail-state")).toHaveText(
      "Simulated · Approved snapshot · not sent",
    );
    await expect(
      message.getByText("engineer@example.invalid", { exact: false }),
    ).toBeVisible();
    await expect(
      handoff.getByRole("button", {
        name: "Send approved snapshot",
        exact: true,
      }),
    ).toHaveCount(0);
    if (outcome === "unknown") {
      await message
        .getByRole("button", {
          name: "Simulate submission failure",
          exact: true,
        })
        .click();
      await expect(message.locator(".incident-mail-state")).toHaveText(
        "Simulated · Submission failed",
      );
      await message
        .getByRole("button", {
          name: "Simulate uncertain outcome",
          exact: true,
        })
        .click();
      await expect(message.locator(".incident-mail-state")).toHaveText(
        "Simulated · Submission or delivery outcome unknown",
      );
      await expect(
        message.getByRole("button", {
          name: "Simulate SMTP acceptance",
          exact: true,
        }),
      ).toHaveCount(0);
    } else {
      await message
        .getByRole("button", { name: "Simulate SMTP acceptance", exact: true })
        .click();
      await expect(message.locator(".incident-mail-state")).toHaveText(
        "Simulated · Accepted by SMTP · delivery unverified",
      );
      await message
        .getByRole("button", { name: "Simulate delivery receipt", exact: true })
        .click();
      await expect(message.locator(".incident-mail-state")).toHaveText(
        "Simulated · Delivery receipt recorded",
      );
    }
    await message
      .getByRole("button", { name: "Simulate acknowledgement", exact: true })
      .click();
    await expect(message.locator(".incident-mail-state")).toHaveText(
      "Simulated · Engineer acknowledgement recorded",
    );
    await page.reload();
    await goToFeature(page, "Handoff");
    await expect(
      page
        .getByRole("region", { name: "Engineer handoff", exact: true })
        .locator(".incident-mail-state"),
    ).toHaveText("Simulated · Engineer acknowledgement recorded");
    expect(realSubmissions).toEqual([]);
  });
}

test("synthetic simulation follows the selected mechanism and preserves its saved curves", async ({
  page,
}, testInfo) => {
  await startReplay(page);
  await goToFeature(page, "Evidence");
  await page
    .getByRole("button", { name: "Incident details", exact: true })
    .click();
  await expect(page.getByText("Manual mode", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close incident details" }).click();
  await analyzeReplay(page);
  await goToFeature(page, "Evidence");
  const scrubber = page.getByRole("slider", {
    name: "Explore source events",
    exact: false,
  });
  await scrubber.focus();
  await scrubber.press("ArrowRight");
  const label = await page
    .locator(".incident-event.selected strong")
    .innerText();
  await goToFeature(page, "Simulation");
  await expect(
    page.getByRole("heading", { name: "S932 assembly guide", exact: true }),
  ).toBeVisible();
  await page.locator(".guided-settings > summary").click();
  const simulation = page.locator(".incident-simulation");
  await simulation
    .getByText("Explore and save a simulated response", { exact: true })
    .click();
  await simulation.getByText("Link contextual evidence · 1 selected").click();
  await expect(
    simulation.getByRole("checkbox", { name: label.trim(), exact: true }),
  ).toBeChecked();
  await simulation
    .getByRole("combobox", { name: "Hypothetical mechanism", exact: true })
    .selectOption("material_condition");
  await expect(
    simulation.getByRole("combobox", {
      name: "Hypothetical mechanism",
      exact: true,
    }),
  ).toHaveValue("material_condition");
  await goToFeature(page, "Simulation");
  await simulation
    .getByRole("slider", { name: "Illustrative fault severity", exact: true })
    .focus();
  await simulation
    .getByRole("slider", { name: "Illustrative fault severity", exact: true })
    .press("End");
  await expect(
    simulation.getByRole("slider", {
      name: "Illustrative fault severity",
      exact: true,
    }),
  ).toHaveValue("1");
  await simulation
    .getByRole("button", { name: "Run and save simulation", exact: true })
    .click();
  await expect(simulation.getByRole("status")).toContainText(
    "Simulated response saved",
  );
  await simulation
    .getByText("Exact simulated values · 13 positions", { exact: true })
    .click();
  await expect(simulation.getByRole("table")).toBeVisible();
  await expect(simulation.getByRole("table").getByRole("row")).toHaveCount(14);
  await simulation
    .getByText("Synthetic held-out evaluation · not physical validation", {
      exact: true,
    })
    .click();
  await expect(simulation).toContainText(
    "No real-machine validation has been performed.",
  );
  await expect(
    simulation.getByRole("rowheader", {
      name: "Constant baseline",
      exact: true,
    }),
  ).toBeVisible();
  await simulation.screenshot({
    path: testInfo.outputPath("simulation.png"),
    style: ".command-bar, .skip-link { visibility: hidden !important; }",
  });
  await simulation
    .getByRole("combobox", { name: "Hypothetical mechanism", exact: true })
    .selectOption("restriction");
  await simulation
    .getByRole("button", { name: "Run and save simulation", exact: true })
    .click();
  await expect(
    simulation.getByRole("heading", {
      name: "Fluid-path restriction · saved simulation",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.locator(".guided-settings > summary").click();
  const history = page.getByRole("combobox", {
    name: "Saved simulation history",
    exact: true,
  });
  await expect(history.locator("option")).toHaveCount(2);
  await history.selectOption({ index: 0 });
  await simulation
    .getByText("Explore and save a simulated response", { exact: true })
    .click();
  await expect(
    simulation.getByRole("combobox", {
      name: "Hypothetical mechanism",
      exact: true,
    }),
  ).toHaveValue("material_condition");
  await goToFeature(page, "Simulation");
  await expect(
    page.locator(".incident-simulation").getByRole("heading", {
      name: "Material-condition change · saved simulation",
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".incident-simulation")
    .getByText("Exact simulated values · 13 positions", { exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("mock factorial plan is previewed, authorized, executed once and preserved in the report", async ({
  page,
}, testInfo) => {
  await startReplay(page);
  await goToFeature(page, "Experiments");
  const experiments = page.locator(".incident-experiments");
  await experiments.locator(":scope > summary").click();
  await experiments
    .getByText("Design a new mock experiment", { exact: true })
    .click();
  await expect(experiments).toContainText("9 planned runs");
  await experiments
    .getByRole("button", { name: "Propose mock experiment", exact: true })
    .click();
  await expect(experiments.getByRole("status")).toContainText(
    "Mock plan saved",
  );
  const matrix = experiments.getByRole("region", {
    name: "Stored experiment matrix and synthetic results",
    exact: true,
  });
  await expect(matrix.getByRole("row")).toHaveCount(10);
  await expect(
    matrix.getByRole("cell", { name: "Not run", exact: true }),
  ).toHaveCount(18);
  const approve = experiments.getByRole("button", {
    name: "Approve stored mock matrix",
    exact: true,
  });
  await expect(approve).toBeDisabled();
  await experiments
    .getByRole("checkbox", {
      name: "Use the demo engineer role to authorize this mock experiment",
      exact: true,
    })
    .check();
  await approve.click();
  await expect(experiments.getByRole("status")).toContainText(
    "approved for mock execution only",
  );
  await experiments
    .getByRole("button", { name: "Run approved mock experiment", exact: true })
    .click();
  await expect(experiments.getByRole("status")).toContainText(
    "Mock experiment saved",
  );
  await expect(
    experiments.getByRole("heading", {
      name: "Simulated differences observed",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    matrix.getByRole("cell", { name: "Not run", exact: true }),
  ).toHaveCount(0);
  await expect(
    experiments.getByRole("button", {
      name: "Run approved mock experiment",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(experiments).toContainText(
    "Synthetic responses do not confirm a physical cause.",
  );
  const planId = await experiments
    .getByRole("combobox", { name: "Saved mock plans", exact: true })
    .inputValue();
  await page.reload();
  await experiments.locator(":scope > summary").click();
  await expect(
    experiments.getByRole("heading", {
      name: `Stored mock plan · ${planId}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(experiments.locator(".incident-tag")).toHaveText(
    "Simulated · completed",
  );
  await expect(matrix.getByRole("row")).toHaveCount(10);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export report", exact: true }).click();
  const download = await downloadPromise;
  const report = await readFile((await download.path())!, "utf8");
  expect(report).toContain("Technical assessment report");
  expect(report).not.toContain("Drafted email");
  expect(report).toContain(planId);
  expect(report).toContain("Experiment design · simulated conditions");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await experiments.screenshot({
    path: testInfo.outputPath("mock-experiment-mobile.png"),
    style: ".command-bar, .skip-link { visibility: hidden !important; }",
  });
});
