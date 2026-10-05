import { expect, test, type Page } from "@playwright/test";
import { openPartialReplay } from "./partialReplay";

async function openHandoff(page: Page) {
  await openPartialReplay(page);
  const navigation = page.getByRole("navigation", {
    name: "Incident features",
    exact: true,
  });
  if (!(await navigation.isVisible())) {
    await page
      .getByRole("button", { name: "Expand navigation", exact: true })
      .click();
  }
  await navigation.getByRole("link", { name: "Handoff", exact: true }).click();
  return page.getByRole("region", { name: "Outlook draft", exact: true });
}

test("saved handoff exports to Outlook with recipients and a usable draft link", async ({
  page,
}, testInfo) => {
  await page.route("**/api/incident-outlook", async (route) => {
    await route.fulfill({
      json: { configured: true, connected: true, email: "owner@example.test" },
    });
  });
  const exports: Record<string, unknown>[] = [];
  await page.route("**/api/incident-outlook/drafts/*", async (route) => {
    const body = route.request().postDataJSON();
    exports.push(body);
    await route.fulfill({
      json: {
        id: "browser-test-draft",
        web_link:
          "https://outlook.office.com/mail/drafts/id/browser-test-draft",
        draft_version: body.draft_version,
      },
    });
  });
  const panel = await openHandoff(page);
  await expect(
    panel.getByText("Connected as owner@example.test"),
  ).toBeVisible();
  const message = page.getByLabel("Handoff message");
  await message.fill(
    "Reviewed handoff for Outlook: preserve the material identity.",
  );
  const save = panel.getByRole("button", {
    name: "Save to Outlook",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await page
    .getByRole("button", { name: "Save handoff edits", exact: true })
    .click();
  await expect(save).toBeEnabled();
  await panel
    .getByLabel("Outlook recipients (optional)")
    .fill("engineer@example.test");
  await save.click();
  await expect(
    panel.getByRole("button", { name: "Saved to Outlook", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("link", { name: "Open draft in Outlook" }),
  ).toHaveAttribute(
    "href",
    "https://outlook.office.com/mail/drafts/id/browser-test-draft",
  );
  const incidentId = page.url().split("/").at(-2);
  const incident = await (
    await page.request.get(`/api/incidents/${incidentId}`)
  ).json();
  expect(exports).toEqual([
    {
      incident_revision: incident.revision,
      draft_version: incident.handoff.version,
      recipients: ["engineer@example.test"],
    },
  ]);
  await panel.screenshot({ path: testInfo.outputPath("outlook-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await expect(
    panel.getByRole("link", { name: "Open draft in Outlook" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({ path: testInfo.outputPath("outlook-mobile.png") });
  await message.fill("A new unsaved handoff edit.");
  await expect(save).toBeDisabled();
  await expect(
    panel.getByRole("link", { name: "Open draft in Outlook" }),
  ).toHaveCount(0);
  expect(exports).toHaveLength(1);
});

test("Outlook failures retain the message and unconfigured state explains setup", async ({
  page,
}) => {
  let configured = false;
  await page.route("**/api/incident-outlook", async (route) => {
    await route.fulfill({
      json: {
        configured,
        connected: configured,
        email: configured ? "owner@example.test" : null,
      },
    });
  });
  await page.route("**/api/incident-outlook/drafts/*", async (route) => {
    await route.fulfill({
      status: 502,
      json: { detail: "Check Outlook Drafts before saving again." },
    });
  });
  const panel = await openHandoff(page);
  await expect(
    panel.getByText(
      "Ask your workspace administrator to configure the Outlook connector.",
    ),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Connect Outlook" }),
  ).toHaveCount(0);
  configured = true;
  await panel
    .getByRole("button", { name: "Check connection", exact: true })
    .click();
  const message = await page.getByLabel("Handoff message").inputValue();
  await panel
    .getByRole("button", { name: "Save to Outlook", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toHaveText(
    "Check Outlook Drafts before saving again.",
  );
  await expect(page.getByLabel("Handoff message")).toHaveValue(message);
  await expect(
    panel.getByRole("link", { name: "Open draft in Outlook" }),
  ).toHaveCount(0);
});
