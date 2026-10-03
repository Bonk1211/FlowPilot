import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Incident } from "@flowpilot/contracts";

test("confirmed answers join the live and full timelines, preserving corrections and uncertain timing", async ({
  page,
  request,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  let incident: Incident = await (
    await request.post("/api/incidents/replay", {
      data: { trigger_id: `live-timeline-${randomUUID()}` },
    })
  ).json();
  // A later source makes this an insertion between events, rather than an append.
  incident = await (
    await request.post(`/api/incidents/${incident.id}/actions`, {
      data: {
        action: "add_evidence",
        revision: incident.revision,
        evidence: {
          id: "later-source",
          kind: "context",
          role: "context",
          label: "Later source record",
          source_ref: "Timeline test source",
          event_time: new Date(
            Date.parse(incident.created_at) + 86400000,
          ).toISOString(),
          event_timezone: "UTC",
          time_uncertain: false,
          synthetic: true,
        },
      },
    })
  ).json();
  incident = await (
    await request.post(`/api/incidents/${incident.id}/actions`, {
      data: { action: "analyze", revision: incident.revision },
    })
  ).json();
  await page.goto(`/incidents/${incident.id}/investigation`);
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  const live = graph.getByRole("complementary", {
    name: "Live investigation timeline",
  });
  const events = live.getByRole("list", { name: "Live timeline events" });
  const panel = graph.locator(".investigation-answer-panel");
  await expect(panel).toBeHidden();
  await expect(
    graph.getByRole("button", { name: "Expand explanation bubble" }),
  ).toBeVisible();
  const chartBounds = (await graph
    .locator(".investigation-canvas")
    .boundingBox())!;
  const timelineBounds = (await live.boundingBox())!;
  expect(chartBounds.x + chartBounds.width).toBeLessThanOrEqual(
    timelineBounds.x,
  );
  const originalCount = await events.locator("li[data-event-id]").count();
  const conversation = graph.locator(".investigation-conversation");
  await conversation
    .getByLabel("Talk through what you're seeing")
    .fill("It is intermittent");
  await conversation.getByRole("button", { name: "Send message" }).click();
  await expect(
    conversation.getByRole("button", { name: "Confirm answer" }),
  ).toBeVisible();
  await expect(events.locator("li[data-event-id]")).toHaveCount(originalCount);
  await conversation.getByRole("button", { name: "Confirm answer" }).click();
  const finding = events.locator('li[data-observation="true"]');
  await expect(finding).toHaveCount(1);
  await expect(finding).toContainText("Frequency · Intermittent");
  await expect(finding).toHaveAttribute("data-new", "true");
  const findingId = (await finding.getAttribute("data-event-id"))!;
  const ids = await events
    .locator("li[data-event-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-event-id")),
    );
  expect(ids.indexOf(findingId)).toBeLessThan(ids.indexOf("later-source"));
  await expect(finding.locator("details")).not.toHaveAttribute("open");
  await finding.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(finding.locator("details")).toHaveAttribute("open", "");
  await expect(finding.locator("time")).toContainText("Recorded ·");
  await page.screenshot({
    path: testInfo.outputPath("live-timeline-desktop.png"),
  });
  await finding
    .getByRole("button", { name: "Inspect in full timeline" })
    .click();
  await expect(page).toHaveURL(`/incidents/${incident.id}/evidence`);
  const full = page.getByRole("list", {
    name: "Evidence timeline",
    exact: true,
  });
  await expect(full.locator(".incident-event.selected")).toContainText(
    "Frequency · Intermittent",
  );
  await expect(
    page.getByRole("region", { name: "Selected evidence" }),
  ).toContainText("The occurrence time is not established");
  await page.reload();
  await expect(full).toContainText("Frequency · Intermittent");
  await page.getByRole("link", { name: "Investigation", exact: true }).click();
  await expect(panel).toBeHidden();
  await graph
    .getByRole("button", { name: "Expand explanation bubble" })
    .click();
  await expect(panel).toBeVisible();
  await graph.getByRole("button", { name: "Close explanation panel" }).click();
  await expect(events).toBeVisible();

  // Corrected answers leave the compact view but remain inspectable in history.
  await graph.getByRole("button", { name: "Ordered text view" }).click();
  const answered = graph
    .locator(".investigation-ordered .investigation-node.is-answered")
    .first();
  await answered.getByRole("button", { name: "Correct this answer" }).click();
  await answered.locator('input[value="sudden"]').check();
  await answered.locator('input[value="sudden"] + span').click();
  await graph.getByRole("button", { name: "Show chart" }).click();
  await expect(events.locator('li[data-observation="true"]')).toHaveCount(1);
  await expect(events).toContainText("Frequency · Sudden");
  await expect(events).not.toContainText("Frequency · Intermittent");
  await live.getByRole("link", { name: "Open full timeline" }).click();
  await expect(full).toContainText("Frequency · Intermittent");
  await expect(full).toContainText("Frequency · Sudden");
  await expect(
    full
      .locator(".incident-event")
      .filter({ hasText: "Frequency · Intermittent" }),
  ).toContainText("Superseded");
  await page.getByRole("link", { name: "Investigation", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cards = conversation.locator(".investigation-response.is-active");
  await cards.locator('input[value="unknown"]').check();
  await cards.locator('input[value="unknown"] + span').click();
  await expect(events.locator('li[data-observation="true"]')).toHaveCount(1);
  expect(
    await events.evaluate(
      (element) => element.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(events).toBeHidden();
  await expect(
    live.getByRole("link", { name: "Open full timeline" }),
  ).toBeInViewport();
  await live.getByRole("button", { name: "Expand live timeline" }).click();
  await expect(events).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("live-timeline-mobile.png"),
  });
  await live.getByRole("button", { name: "Collapse live timeline" }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(
    live.getByRole("link", { name: "Open full timeline" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(pageErrors).toEqual([]);
});
