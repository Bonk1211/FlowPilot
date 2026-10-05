import { openPartialReplay } from "./partialReplay";
import { expect, test } from "@playwright/test";

test("both starting branches stay visible and software extends from recorded evidence", async ({
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
  const hardware = graph.getByRole("button", {
    name: /Investigation branch.*Hardware:/,
  });
  const software = graph.getByRole("button", {
    name: /Investigation branch.*Software:/,
  });
  await expect(hardware).toBeInViewport();
  await expect(software).toBeInViewport();
  await expect(
    graph.locator('.react-flow__edge[data-id="edge-branch-hardware"]'),
  ).toHaveCount(1);
  await expect(
    graph.locator('.react-flow__edge[data-id="edge-branch-software"]'),
  ).toHaveCount(1);
  await graph.screenshot({
    path: testInfo.outputPath("hardware-software-start.png"),
  });
  await software.click();
  const conversation = graph.locator(".investigation-conversation");
  await conversation
    .getByRole("button", { name: "Follow this branch" })
    .click();
  const changed = conversation.getByRole("radio", {
    name: "Changed",
    exact: true,
  });
  await changed.check();
  await changed.locator("+ span").click();
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", /controller logs/);
  await page.reload();
  await expect(
    graph.locator(".flowchart-node.is-spotlight button"),
  ).toHaveAttribute("title", /controller logs/);
  await graph.getByRole("button", { name: "Fit chart", exact: true }).click();
  await hardware.click();
  await conversation
    .getByRole("button", { name: "Follow this branch" })
    .click();
  await expect(
    conversation.getByRole("radio", { name: "Intermittent", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 844 });
  const branchNavigation = graph.getByRole("navigation", {
    name: "Investigation branches",
  });
  await expect(
    branchNavigation.getByRole("button", { name: "Hardware" }),
  ).toBeInViewport();
  await branchNavigation.getByRole("button", { name: "Software" }).click();
  await expect(
    conversation.getByRole("button", { name: "Follow this branch" }),
  ).toBeVisible();
  await expect(
    branchNavigation.getByRole("button", { name: "Software" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => {
      const question = await graph
        .locator(".flowchart-node.is-spotlight button")
        .boundingBox();
      const chat = await conversation.boundingBox();
      return (
        !!question &&
        !!chat &&
        question.x >= 0 &&
        question.x + question.width <= 375 &&
        question.y + question.height <= chat.y
      );
    })
    .toBe(true);
  await graph.screenshot({
    path: testInfo.outputPath("hardware-software-mobile.png"),
  });
});
