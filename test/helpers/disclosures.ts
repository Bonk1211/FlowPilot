import type { Locator } from "@playwright/test";

export async function openDisclosure(summary: Locator) {
  if (
    !(await summary.evaluate(
      (element) => (element.parentElement as HTMLDetailsElement).open,
    ))
  ) {
    await summary.click();
  }
}
