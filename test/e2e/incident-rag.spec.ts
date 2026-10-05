import { openPartialReplay } from "./partialReplay";
import { expect, test } from "@playwright/test";
import type { Incident, SourcePassage } from "@flowpilot/contracts";

test("conversation references open exact excerpts in the explanation sidebar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await openPartialReplay(page);
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const graph = page.getByRole("region", {
    name: "Adaptive investigation",
    exact: true,
  });
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toBeVisible();
  const source: SourcePassage = {
    id: "SRC-test:section-2.4-1",
    document_id: "S932-CONSOLIDATED-RAG",
    title: "S932 reference",
    revision: "test-r1",
    section: "2.4 Relationships useful for diagnosis",
    file_path: "docs/Asymtek_S932_Consolidated_Reference.md",
    configurations: ["S932"],
    authority: "secondary_summary",
    approval_status: "unverified",
    excerpt_kind: "exact_excerpt",
    passage: "Normal mass can coexist with poor coverage.",
    applicable: true,
    operational_allowed: false,
    limitation: "Unverified secondary summary; original manuals absent.",
  };
  await page.route("**/api/incidents/*/conversation", async (route) => {
    const request = route.request().postDataJSON();
    const url = route
      .request()
      .url()
      .replace(/\/conversation$/, "");
    const response = await page.request.get(url);
    const incident: Incident = await response.json();
    incident.revision += 1;
    incident.conversation = [
      {
        id: request.turn_id,
        text: request.text,
        input_mode: "text",
        reply:
          "Coverage can vary even when mass is normal. The explanation remains unverified.",
        intent: "discuss",
        status: "discussed",
        input_fingerprint: "test",
        recorded_at: new Date().toISOString(),
        sources: [source],
      },
    ];
    await route.fulfill({ json: incident });
  });
  const chat = graph.locator(".investigation-conversation");
  await chat
    .getByLabel("Talk through what you're seeing")
    .fill("Why can mass be normal?");
  await chat.getByRole("button", { name: "Send message" }).click();
  await chat.getByRole("button", { name: "View references · 1" }).click();
  const references = graph.getByRole("region", {
    name: "Conversation references",
  });
  await expect(references).toBeVisible();
  await references.locator("summary").click();
  await expect(references.locator("blockquote")).toHaveText(source.passage);
  await expect(
    references.getByText("unverified", { exact: true }),
  ).toBeVisible();
  await expect(references).toContainText(source.limitation);
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(references).toBeVisible();
  expect(
    await references.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});
