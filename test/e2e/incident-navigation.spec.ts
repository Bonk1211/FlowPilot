import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type { Incident, IncidentJob } from "@flowpilot/contracts";

const features = [
  { slug: "investigation", label: "Investigation" },
  { slug: "evidence", label: "Evidence" },
  { slug: "simulation", label: "Simulation" },
  { slug: "experiments", label: "Experiments" },
  { slug: "handoff", label: "Handoff" },
  { slug: "knowledge", label: "Knowledge" },
  { slug: "review", label: "Review" },
] as const;

type Feature = (typeof features)[number];

async function replay(request: APIRequestContext, analyzed = true) {
  const response = await request.post("/api/incidents/replay", {
    data: { trigger_id: `feature-navigation-${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  let incident: Incident = await response.json();
  if (analyzed) {
    for (const action of ["advance_replay", "analyze"]) {
      const changed = await request.post(
        `/api/incidents/${incident.id}/actions`,
        {
          data: { action, revision: incident.revision },
        },
      );
      expect(changed.ok()).toBeTruthy();
      incident = await changed.json();
    }
  }
  return incident;
}

function featureHeading(page: Page, label: string) {
  return page.getByRole("heading", { name: label, exact: true, level: 2 });
}

async function navigate(page: Page, label: Feature["label"]) {
  const navigation = page.getByRole("navigation", {
    name: "Incident features",
    exact: true,
  });
  if (!(await navigation.isVisible()))
    await page
      .getByRole("button", { name: "Expand navigation", exact: true })
      .click();
  await navigation.getByRole("link", { name: label, exact: true }).click();
  await expect(featureHeading(page, label)).toBeVisible();
}

test("incident feature links select distinct pages and expose the current route", async ({
  page,
  request,
}, testInfo) => {
  const incident = await replay(request);
  const base = `/incidents/${incident.id}`;
  await page.goto(base);
  const navigation = page.getByRole("navigation", {
    name: "Incident features",
    exact: true,
  });
  await expect(featureHeading(page, "Investigation")).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(features.length);
  await expect(
    navigation.getByRole("link", { name: "Investigation", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  for (const feature of features) {
    const link = navigation.getByRole("link", {
      name: feature.label,
      exact: true,
    });
    await expect(link).toHaveAttribute("href", `${base}/${feature.slug}`);
    await link.click();
    await expect(page).toHaveURL(`${base}/${feature.slug}`);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(featureHeading(page, feature.label)).toBeVisible();
    if (feature.slug !== "investigation")
      await expect(featureHeading(page, feature.label)).toBeFocused();
    await expect(page).toHaveTitle(new RegExp(feature.label));
    for (const other of features.filter((item) => item.slug !== feature.slug))
      await expect(featureHeading(page, other.label)).not.toBeVisible();
    const sidebar = page.locator(".incident-feature-sidebar");
    await expect(sidebar).toHaveCSS("position", "fixed");
    await expect(sidebar).toHaveCSS("width", "64px");
    const content = page.locator(".incident-feature-content");
    const before = await content.boundingBox();
    await page
      .getByRole("button", { name: "Expand navigation", exact: true })
      .click();
    await expect(sidebar).toHaveCSS("width", "224px");
    expect(await content.boundingBox()).toMatchObject({
      x: before!.x,
      width: before!.width,
    });
    await page
      .getByRole("button", { name: "Collapse navigation", exact: true })
      .press("Escape");
    await expect(
      page.getByRole("button", { name: "Expand navigation", exact: true }),
    ).toBeFocused();
    if (feature.slug === "investigation") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(
          "incident-features-desktop-investigation.png",
        ),
        fullPage: true,
      });
    }
  }
});

test("deep links survive reload and browser history, with recovery for unknown pages", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  const base = `/incidents/${incident.id}`;
  await page.goto(`${base}/evidence`);
  await expect(featureHeading(page, "Evidence")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(`${base}/evidence`);
  await expect(
    page.getByRole("heading", { name: "Evidence & timeline" }),
  ).toBeVisible();
  await navigate(page, "Simulation");
  await navigate(page, "Handoff");
  await page.goBack();
  await expect(page).toHaveURL(`${base}/simulation`);
  await expect(featureHeading(page, "Simulation")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(`${base}/evidence`);
  await expect(featureHeading(page, "Evidence")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(`${base}/simulation`);
  await expect(featureHeading(page, "Simulation")).toBeVisible();

  await page.goto(`${base}/unknown-feature`);
  await expect(featureHeading(page, "Page not found")).toBeVisible();
  await expect(featureHeading(page, "Investigation")).not.toBeVisible();
  const recovery = page.getByRole("link", {
    name: "Return to Investigation",
    exact: true,
  });
  await expect(recovery).toHaveAttribute("href", `${base}/investigation`);
  await recovery.click();
  await expect(page).toHaveURL(`${base}/investigation`);
  await expect(featureHeading(page, "Investigation")).toBeVisible();
});

test("same-incident navigation preserves unsaved handoff edits and selected context", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const incident = await replay(request);
  let failImage = true;
  await page.route("**/api/vision/examples/incomplete/image", (route) =>
    failImage
      ? route.fulfill({ status: 503, body: "Temporary image failure" })
      : route.continue(),
  );
  await page.goto(`/incidents/${incident.id}/handoff`);
  const message =
    "Unsaved engineer note: preserve the material container identity.";
  await page
    .getByRole("textbox", { name: "Handoff message", exact: true })
    .fill(message);
  await navigate(page, "Simulation");
  await page
    .getByText("Explore and save a simulated response", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Hypothetical mechanism", exact: true })
    .selectOption("material_condition");
  await page
    .getByRole("button", { name: "Play schematic", exact: true })
    .click();
  await navigate(page, "Evidence");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByText("Compare images", { exact: true }).click();
  await expect(
    page.getByText("Image could not load", { exact: true }),
  ).toBeVisible();
  failImage = false;
  await page.getByText("Compare images", { exact: true }).click();
  const firstBad = page
    .getByRole("list", { name: "Evidence timeline", exact: true })
    .getByRole("button", { name: /First-known-bad coverage/ });
  await firstBad.click();
  await navigate(page, "Handoff");
  await expect(
    page.getByRole("textbox", { name: "Handoff message", exact: true }),
  ).toHaveValue(message);
  await expect(
    page.getByRole("button", { name: "Save handoff edits", exact: true }),
  ).toBeEnabled();
  const stored: Incident = await (
    await request.get(`/api/incidents/${incident.id}`)
  ).json();
  expect(stored.handoff.body).toBe(incident.handoff.body);

  await navigate(page, "Simulation");
  await expect(
    page.getByRole("combobox", { name: "Hypothetical mechanism", exact: true }),
  ).toHaveValue("material_condition");
  await expect(
    page.getByText("Reduced motion enabled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play schematic", exact: true }),
  ).toBeDisabled();
  await navigate(page, "Evidence");
  await expect(firstBad).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Compare images", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Inspect first known bad evidence",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Image could not load", { exact: true }),
  ).not.toBeVisible();
  await navigate(page, "Investigation");
  await expect(
    page.getByRole("button", { name: /Material-condition change possible/ }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a pending replay creation does not redirect after another incident is opened", async ({
  page,
  request,
}) => {
  const existing = await replay(request, false);
  await page.route("**/api/incidents", (route) =>
    route.fulfill({ json: [existing] }),
  );
  let release!: () => void;
  const pendingResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  let createdId: string | null = null;
  await page.route("**/api/incidents/replay", async (route) => {
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    createdId = ((await response.json()) as Incident).id;
    await pendingResponse;
    await route.fulfill({ response });
  });
  await page.goto("/incidents");
  await page
    .getByRole("button", { name: "Start S932 replay", exact: true })
    .click();
  await expect.poll(() => createdId).not.toBeNull();
  await page.locator(`a[href="/incidents/${existing.id}"]`).click();
  await expect(featureHeading(page, "Investigation")).toBeVisible();
  const completed = page.waitForResponse("**/api/incidents/replay");
  release();
  await (await completed).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page).toHaveURL(`/incidents/${existing.id}`);
  await expect(featureHeading(page, "Investigation")).toBeVisible();
  expect(createdId).not.toBe(existing.id);
});

test("mobile feature navigation reaches every page without horizontal overflow", async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const incident = await replay(request);
  await page.goto(`/incidents/${incident.id}/investigation`);
  for (const feature of features) {
    await navigate(page, feature.label);
    await expect(page).toHaveURL(`/incidents/${incident.id}/${feature.slug}`);
    await expect(
      page.getByRole("button", { name: "Expand navigation", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".incident-feature-sidebar")).toHaveCSS(
      "position",
      "fixed",
    );
    await expect(page.locator(".incident-feature-sidebar")).toHaveCSS(
      "width",
      "48px",
    );
    await expect(
      page.getByRole("combobox", { name: "Incident page", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${feature.label} must fit the mobile viewport`,
    ).toBeTruthy();
    if (feature.slug === "handoff") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath("incident-features-mobile-handoff.png"),
        fullPage: true,
      });
    }
  }
});

test("background completion refreshes a non-investigation page without losing its draft", async ({
  page,
  request,
}) => {
  const incident = await replay(request, false);
  let completed = false;
  let polls = 0;
  await page.route("**/api/incident-jobs/status", (route) =>
    route.fulfill({ json: { enabled: true } }),
  );
  await page.route(`**/api/incidents/${incident.id}/jobs`, async (route) => {
    polls += 1;
    // Only the worker signal is mocked; the changed incident is saved and fetched through the API.
    const job: IncidentJob = {
      id: "navigation-refresh-job",
      incident_id: incident.id,
      input_fingerprint: "synthetic-navigation-test",
      source_revision: incident.revision,
      kind: "analysis",
      state: completed ? "succeeded" : "running",
      attempts: 1,
      max_attempts: 3,
      created_at: "2026-10-01T00:00:00+00:00",
      updated_at: completed
        ? "2026-10-01T00:00:01+00:00"
        : "2026-10-01T00:00:00+00:00",
      lease_until: null,
      worker_token: null,
      error: null,
    };
    await route.fulfill({ json: [job] });
  });
  await page.goto(`/incidents/${incident.id}/handoff`);
  const message =
    "Unsaved note retained while the synthetic evidence package updates.";
  await page
    .getByRole("textbox", { name: "Handoff message", exact: true })
    .fill(message);
  await expect.poll(() => polls).toBeGreaterThan(0);
  const response = await request.post(`/api/incidents/${incident.id}/actions`, {
    data: { action: "advance_replay", revision: incident.revision },
  });
  expect(response.ok()).toBeTruthy();
  const updated: Incident = await response.json();
  completed = true;
  await expect(
    page.getByText(`Evidence revision ${updated.revision}`, { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(featureHeading(page, "Handoff")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Handoff message", exact: true }),
  ).toHaveValue(message);
  await navigate(page, "Evidence");
  await expect(
    page
      .getByRole("list", { name: "Evidence timeline", exact: true })
      .getByRole("button", {
        name: /Falling mass with a stable recorded pressure trend/,
      }),
  ).toBeVisible();
});

test("timeline markers, content and simulation stay synchronized in both layouts", async ({
  page,
  request,
}, testInfo) => {
  const incident = await replay(request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/incidents/${incident.id}/evidence`);
  const timeline = page.getByRole("list", {
    name: "Evidence timeline",
    exact: true,
  });
  const markers = timeline.locator(".incident-event");
  const selected = timeline.locator(".incident-event.selected");
  const detail = page.getByRole("region", {
    name: "Selected evidence",
    exact: true,
  });
  const scrubber = page.getByRole("slider", {
    name: "Explore source events",
    exact: true,
  });
  const previous = page.getByRole("button", {
    name: "Previous event",
    exact: true,
  });
  const next = page.getByRole("button", { name: "Next event", exact: true });
  await expect(markers).toHaveCount(incident.evidence.length);
  await expect(detail).toContainText("Last-known-good coverage");
  await scrubber.focus();
  await scrubber.press("Home");
  await expect(previous).toBeDisabled();
  await expect(selected).toContainText("Material container changed");
  await expect(detail).toContainText("replay:v1/change-note");
  await next.click();
  await expect(scrubber).toHaveValue("1");
  await expect(selected).toContainText("Last-known-good coverage");
  await expect(detail.getByRole("img")).toHaveAttribute(
    "alt",
    /Last-known-good coverage/,
  );
  await previous.click();
  await expect(scrubber).toHaveValue("0");
  await scrubber.focus();
  await scrubber.press("End");
  await expect(next).toBeDisabled();
  await expect(selected).toContainText("PM record unavailable");
  await expect(detail).toContainText(
    "The replay package contains no complete PM record.",
  );

  await markers
    .filter({ hasText: "Falling mass with a stable recorded pressure trend" })
    .click();
  await expect(scrubber).toHaveValue("2");
  await expect(detail.getByRole("table")).toContainText("12");
  await expect(detail.locator("figure")).toHaveCount(0);
  await expect(detail).toContainText("replay:v1/machine-log");
  const toggle = detail.getByRole("button", { name: /Event 3 of/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(detail.getByRole("table")).not.toBeVisible();
  await toggle.click();
  await expect(detail.getByRole("table")).toBeVisible();
  await page.locator(".incident-events").screenshot({
    path: testInfo.outputPath("timeline-horizontal.png"),
    style: ".incident-command-bar, .skip-link { visibility: hidden; }",
  });

  await page.getByRole("button", { name: "Vertical", exact: true }).click();
  await expect(scrubber).toHaveValue("2");
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(
    timeline.getByRole("region", { name: "Selected evidence", exact: true }),
  ).toContainText("replay:v1/machine-log");
  await expect(detail.getByRole("table")).toBeVisible();
  await page.locator(".incident-events").screenshot({
    path: testInfo.outputPath("timeline-vertical.png"),
    style: ".incident-command-bar, .skip-link { visibility: hidden; }",
  });

  await page.getByText("Compare images", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Inspect first known bad evidence",
      exact: true,
    })
    .click();
  await expect(selected).toContainText("First-known-bad coverage");
  await expect(scrubber).toHaveValue("3");
  await expect(detail.getByRole("img")).toHaveAttribute(
    "alt",
    /First-known-bad coverage/,
  );
  await navigate(page, "Simulation");
  await expect(page.locator(".incident-mechanism")).toContainText(
    "Inspecting evidence: First-known-bad coverage",
  );
  await navigate(page, "Evidence");
  await expect(selected).toContainText("First-known-bad coverage");
  await expect(
    page.getByRole("button", { name: "Vertical", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 812, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    for (const layout of ["Horizontal", "Vertical"]) {
      await page.getByRole("button", { name: layout, exact: true }).click();
      await expect(selected).toContainText("First-known-bad coverage");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect((await detail.boundingBox())!.width).toBeGreaterThan(220);
      await page.locator(".incident-events").screenshot({
        path: testInfo.outputPath(
          `timeline-${layout.toLowerCase()}-${viewport.width}.png`,
        ),
        style: ".incident-command-bar, .skip-link { visibility: hidden; }",
      });
    }
  }
});

test("timeline handles empty and single-event packages", async ({
  page,
  request,
}) => {
  const incident = await replay(request, false);
  for (const count of [0, 1]) {
    await page.route(`**/api/incidents/${incident.id}`, (route) =>
      route.fulfill({
        json: { ...incident, evidence: incident.evidence.slice(0, count) },
      }),
    );
    await page.goto(`/incidents/${incident.id}/evidence`);
    const timeline = page.getByRole("list", {
      name: "Evidence timeline",
      exact: true,
    });
    await expect(timeline.locator(".incident-event")).toHaveCount(count);
    if (count === 0) {
      await expect(
        page.getByText(
          "No source events yet. Add source evidence to start the timeline.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("slider", {
          name: "Explore source events",
          exact: true,
        }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("button", { name: "Previous event", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Next event", exact: true }),
      ).toBeDisabled();
      await expect(timeline.locator(".incident-event.selected")).toHaveCount(1);
      await expect(
        page.getByRole("region", { name: "Selected evidence", exact: true }),
      ).toContainText(incident.evidence[0].label);
    }
    await page.unroute(`**/api/incidents/${incident.id}`);
  }
});

test("fullscreen timeline keeps its floating navigation and playback synchronized", async ({
  page,
  request,
}, testInfo) => {
  const incident = await replay(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/incidents/${incident.id}/evidence`);
  const timeline = page.getByRole("list", {
    name: "Evidence timeline",
    exact: true,
  });
  const selected = timeline.locator(".incident-event.selected");
  const detail = page.getByRole("region", {
    name: "Selected evidence",
    exact: true,
  });
  await expect(detail.getByRole("img")).toBeVisible();
  const canvas = page.locator(".incident-timeline-page");
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBe(1440);
  expect(bounds?.height).toBe(900);
  expect((await detail.boundingBox())!.height).toBeGreaterThan(200);
  await page.screenshot({
    path: testInfo.outputPath("fullscreen-timeline-desktop.png"),
  });
  const before = await timeline.boundingBox();
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Collapse navigation", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(await timeline.boundingBox()).toEqual(before);
  await page.screenshot({
    path: testInfo.outputPath("fullscreen-timeline-navigation.png"),
  });
  await page
    .getByRole("button", { name: "Collapse navigation", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("button", { name: "Expand navigation", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Incident details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: incident.symptom, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close incident details", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("button", { name: "Incident details", exact: true }),
  ).toBeFocused();

  await selected.focus();
  await selected.press("Home");
  await expect(selected).toContainText("Material container changed");
  await selected.press("ArrowRight");
  await expect(selected).toContainText("Last-known-good coverage");
  await expect(selected).toBeFocused();
  await page.clock.install();
  await page
    .getByRole("button", { name: "Play timeline", exact: true })
    .click();
  await page.clock.runFor(3100);
  await expect(selected).toContainText("Falling mass");
  await expect(detail).toContainText("replay:v1/machine-log");
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play timeline", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(3100);
  await expect(selected).toContainText("First-known-bad coverage");
  await selected.focus();
  await selected.press("End");
  await page
    .getByRole("button", { name: "Play timeline", exact: true })
    .click();
  await expect(selected).toContainText("Material container changed");
  for (const label of [
    "Last-known-good coverage",
    "Falling mass",
    "First-known-bad coverage",
    "Pressure and mass export pending",
    "PM record unavailable",
  ]) {
    await page.clock.runFor(3100);
    await expect(selected).toContainText(label);
  }
  await expect(
    page.getByRole("button", { name: "Play timeline", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Play timeline", exact: true }),
  ).toBeDisabled();
  await expect(detail).toHaveCSS("animation-name", "none");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(canvas).toHaveCSS("height", "812px");
  await expect(selected).toBeInViewport();
  expect((await detail.boundingBox())!.height).toBeGreaterThan(180);
  await page.screenshot({
    path: testInfo.outputPath("fullscreen-timeline-mobile.png"),
  });
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Incident features", exact: true })
    .getByRole("link", { name: "Simulation", exact: true })
    .click();
  await expect(featureHeading(page, "Simulation")).toBeVisible();
});

test("mechanism components come from the assessment for every hypothesis", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  const labels: Record<string, string> = {
    bfs_bottle: "BFS bottle",
    bfs_air: "BFS pressure",
    pickup_tube: "Pickup tube",
    feed_tube: "Feed tube",
    fluid_qd: "Fluid QD",
    dj2200_valve: "DJ-2200 valve",
    nozzle: "Nozzle",
  };
  const hypotheses = incident.assessment?.hypotheses ?? [];
  expect(hypotheses.length).toBeGreaterThanOrEqual(3);
  await page.goto(`/incidents/${incident.id}/investigation`);
  for (const hypothesis of hypotheses) {
    await page
      .getByLabel("Candidate mechanisms", { exact: true })
      .getByRole("button", { name: new RegExp(hypothesis.title) })
      .click();
    await navigate(page, "Simulation");
    const list = page.getByLabel("Components in this mechanism", {
      exact: true,
    });
    await expect(list.getByRole("button")).toHaveText(
      hypothesis.component_ids.map((id) => labels[id]),
    );
    await navigate(page, "Investigation");
  }
});

test("mechanism highlights every component of the hypothesis and explains the selected one", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  const hypothesis = incident.assessment?.hypotheses[0];
  expect(hypothesis).toBeTruthy();
  await page.goto(`/incidents/${incident.id}/simulation`);
  await page.getByRole("button", { name: "2D schematic", exact: true }).click();
  const figure = page.locator(".prototype-diagram");
  await expect(figure.locator('[data-highlighted="true"]')).toHaveCount(
    hypothesis?.component_ids.length ?? 0,
  );
  const list = page.getByLabel("Components in this mechanism", { exact: true });
  const buttons = list.getByRole("button");
  await buttons.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(buttons.nth(1)).toBeFocused();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  const name = (await buttons.nth(1).textContent()) ?? "";
  await expect(
    page.getByRole("group", { name: `Role of ${name}`, exact: true }),
  ).toBeVisible();
});

test("investigation board links a selected event to the hypotheses that cite it and their components", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  await page.goto(`/incidents/${incident.id}/investigation`);
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
  await expect(links).toContainText("Supports Fluid-path restriction");
  await expect(links).toContainText("Conflicts with Unstable fluid delivery");
  await expect(board.getByRole("status")).toContainText(
    "Conflicts with Unstable fluid delivery",
  );
  const components = board.getByLabel("Components in this mechanism", {
    exact: true,
  });
  await expect(components.getByRole("button")).toHaveText([
    "Pickup tube",
    "Feed tube",
    "Fluid QD",
    "Nozzle",
  ]);
  await links
    .getByRole("button", { name: "Conflicts with Unstable fluid delivery" })
    .click();
  await expect(components.getByRole("button")).toHaveText([
    "BFS bottle",
    "BFS pressure",
    "Pickup tube",
    "Fluid QD",
  ]);
  await navigate(page, "Simulation");
  await expect(
    page
      .getByRole("heading", { name: "Unstable fluid delivery", level: 3 })
      .first(),
  ).toBeVisible();
});

test("two mechanisms can be compared by shared and distinct components", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  await page.goto(`/incidents/${incident.id}/simulation`);
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
  await expect(cells.nth(0)).toHaveText(/Feed tube.*Nozzle/s);
  await expect(cells.nth(1)).toHaveText(/Pickup tube.*Fluid QD/s);
  await expect(cells.nth(2)).toHaveText(/BFS bottle.*BFS pressure/s);
  await expect(
    page
      .getByRole("region", { name: "Schematic A", exact: true })
      .getByRole("img", { name: /Highlighted parts: .*Nozzle/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare mechanisms", exact: true })
    .click();
  await expect(page.getByLabel("Mechanism A", { exact: true })).toHaveCount(0);
});

test("timeline marks uncollected sources instead of treating them as normal", async ({
  page,
  request,
}) => {
  const incident = await replay(request);
  await page.goto(`/incidents/${incident.id}/evidence`);
  const timeline = page.getByRole("list", {
    name: "Evidence timeline",
    exact: true,
  });
  const missing = timeline.locator("li[data-missing]");
  await expect(missing).toHaveCount(
    (incident.evidence ?? []).filter((item) => item.status !== "collected")
      .length,
  );
  const pm = missing.filter({ hasText: "PM record unavailable" });
  await expect(pm).toContainText("Unavailable · not assumed normal");
  await expect(pm).not.toContainText("Observed");
  await expect(pm).not.toContainText("Simulated");
  await expect(
    timeline
      .locator("li:not([data-missing])")
      .filter({ hasText: "Last-known-good coverage" }),
  ).toContainText("collected");
});
