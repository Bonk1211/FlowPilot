import { expect, test } from "@playwright/test";

test("source owner registers exact secondary text and reviews it without granting operational authority", async ({
  page,
  request,
}) => {
  const name = `Source review ${Date.now()}`;
  await page.goto("/incidents");
  await page.getByRole("button", { name: "Start S932 replay" }).click();
  await expect(page).toHaveURL(/\/incidents\/INC-/);
  await page
    .getByRole("navigation", { name: "Incident features" })
    .getByRole("link", { name: "Knowledge", exact: true })
    .click();
  await page
    .getByText("Sources & past investigations", { exact: true })
    .click();
  const panel = page.locator(
    'details[aria-label="Controlled source registry"]',
  );
  await panel.getByText("Controlled sources & review", { exact: true }).click();
  await panel
    .getByText("Register a document revision", { exact: true })
    .click();
  await panel.getByLabel("Document ID", { exact: true }).fill(name);
  await panel.getByLabel("Document revision", { exact: true }).fill("mock-1");
  await panel.getByLabel("Title", { exact: true }).fill(name);
  await panel
    .getByLabel("Original document reference", { exact: true })
    .fill("mock:fixture-source");
  await panel
    .getByLabel("Page or section", { exact: true })
    .fill("Mock source section 1");
  await panel
    .getByLabel("Exact source passage", { exact: true })
    .fill(
      "Illustrative context only. This is not a machine procedure.\nPreserve this exact text.",
    );
  await panel
    .getByRole("button", { name: "Register source revision", exact: true })
    .click();
  await expect(panel.getByRole("heading", { name, exact: true })).toBeVisible();
  await panel
    .getByLabel("Use demonstration knowledge-owner role (no site authority)")
    .check();
  const source = panel
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await source
    .getByLabel("Review notes", { exact: true })
    .fill("Reviewed as a synthetic reference, not an operating method.");
  await source
    .getByRole("button", { name: "Record source review", exact: true })
    .click();
  await expect(source.getByText(/published · secondary summary/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Incident features" })
    .getByRole("link", { name: "Investigation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Analyze available evidence" })
    .click();
  const id = new URL(page.url()).pathname.split("/")[2];
  await expect
    .poll(async () => {
      const response = await request.get(
        `http://127.0.0.1:8100/api/incidents/${id}`,
      );
      const incident = await response.json();
      return incident.assessment?.sources.find(
        (item: { document_id: string }) => item.document_id === name,
      )?.operational_allowed;
    })
    .toBe(false);
});
