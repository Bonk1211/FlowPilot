import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Tests of manual investigation need the original, unanalysed partial package.
// The home-page replay now assembles and analyses sources before navigation.
export async function openPartialReplay(page: Page) {
  const response = await page.request.post("/api/incidents/replay", {
    data: { trigger_id: `partial-${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const incident = await response.json();
  await page.goto(`/incidents/${incident.id}`);
}
