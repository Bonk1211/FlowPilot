import { expect, type Page } from "@playwright/test";

export async function start(page: Page) {
  await page.goto("/?samples=raster");
  await page
    .getByRole("button", { name: "Start investigation", exact: true })
    .click();
  await expect(page).toHaveURL(/\?case=CASE-/);
}

export async function discovery(page: Page, intermittent = false) {
  await page
    .getByRole("button", {
      name: intermittent ? "Blobs or line-end droplets" : "Incomplete coverage",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: intermittent
        ? "Does flux weight pass despite blobs or droplets?"
        : "Has measured flux weight been falling?",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Stable / no known change" }).click();
  await page.getByRole("button", { name: "Not recorded", exact: true }).click();
  await page.getByRole("button", { name: "Not recorded", exact: true }).click();
  await page.getByRole("button", { name: "Diagnose case" }).click();
  await expect(
    page.getByRole("heading", { name: "Ranked causes" }),
  ).toBeVisible();
}

export async function inspect(page: Page, positive: boolean) {
  await page
    .getByRole("button", { name: "Start illustrative inspection" })
    .click();
  const next = page.getByRole("button", { name: "Next step", exact: true });
  while (await next.isEnabled()) await next.click();
  await page
    .getByRole("button", {
      name: positive ? "Obstruction found" : "No obstruction found",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm observation" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm observation" }).click();
}
