import { expect, test, type Page } from "@playwright/test";

// Follows segments 2 and 3 of docs/S932_DEMO_SCRIPT.md click for click and
// checks the claims the narration makes. It measures the clicking only, not
// speaking time, and is not a substitute for a rehearsal with presenters.

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

test("demo segments 2 and 3 follow the script and its claims hold", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-/);
  const started = Date.now();

  // Segment 2: images and timeline.
  await goToFeature(page, "Evidence");
  await page.getByRole("button", { name: "Collect next evidence" }).click();
  await expect(
    page.getByRole("button", { name: "Collect next evidence" }),
  ).toHaveCount(0);
  const timeline = page.getByRole("list", {
    name: "Evidence timeline",
    exact: true,
  });
  const missing = timeline.locator("li[data-missing]");
  await expect(missing).toHaveCount(2);
  await expect(
    missing.filter({ hasText: "PM record unavailable" }),
  ).toHaveCount(1);
  await expect(
    missing.filter({ hasText: "Pressure and mass export pending" }),
  ).toHaveCount(1);
  await page.getByText("Compare images", { exact: true }).click();
  await expect(
    page.getByText("Last known good", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("First known bad", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Compare images", { exact: true }).click();
  await timeline
    .locator(".incident-event")
    .filter({ hasText: "Material container changed" })
    .click();
  await expect(page.locator(".incident-timeline-caption")).toContainText(
    "Timing uncertain: order is provisional",
  );
  const afterSegment2 = Date.now();

  // Segment 3: hypotheses and mechanism.
  await goToFeature(page, "Investigation");
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const candidates = page.getByLabel("Candidate mechanisms", { exact: true });
  await expect(candidates.getByRole("button")).toHaveCount(3);
  const board = page.getByRole("region", {
    name: "Evidence and mechanism",
    exact: true,
  });
  await board
    .getByRole("button", { name: /Falling mass with a stable recorded/ })
    .click();
  const links = board.getByRole("list", {
    name: "Hypotheses that cite this event",
    exact: true,
  });
  await expect(links.getByRole("listitem")).toHaveCount(4);
  await links
    .getByRole("button", { name: "Conflicts with Unstable fluid delivery" })
    .click();
  await expect(
    board
      .getByLabel("Components in this mechanism", { exact: true })
      .getByRole("button"),
  ).toHaveText(["BFS bottle", "BFS pressure", "Pickup tube", "Fluid QD"]);
  await expect(
    board.getByText("Inferred", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    board.getByText("Simulated", { exact: false }).first(),
  ).toBeVisible();
  await goToFeature(page, "Simulation");
  await page
    .getByRole("button", { name: "Compare mechanisms", exact: true })
    .click();
  await page
    .getByLabel("Mechanism A", { exact: true })
    .selectOption({ label: "Fluid-path restriction" });
  await page
    .getByLabel("Mechanism B", { exact: true })
    .selectOption({ label: "Unstable fluid delivery" });
  const cells = page
    .getByRole("table", { name: "Components in each mechanism" })
    .getByRole("cell");
  await expect(cells.nth(1)).toHaveText(/Pickup tube.*Fluid QD/s);
  await expect(
    page.getByText("Still needed for", { exact: false }),
  ).toHaveCount(2);
  const finished = Date.now();

  testInfo.annotations.push({
    type: "clicking time",
    description: `segment 2 ${afterSegment2 - started} ms; segment 3 ${finished - afterSegment2} ms`,
  });
  console.log(
    `Demo clicking time: segment 2 ${afterSegment2 - started} ms, segment 3 ${finished - afterSegment2} ms`,
  );
});
