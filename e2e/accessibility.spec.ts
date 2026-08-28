import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("core collector workflow is navigable and has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Built for");
  await expect(page.getByRole("heading", { name: "Sign in to run analysis" })).toBeVisible();

  await page.getByRole("tab", { name: "Chase Grid" }).click();
  await expect(page.getByRole("heading", { name: "The Chase Grid" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Drift-Ender/ })).toHaveAttribute(
    "href",
    "https://www.hwtreasure.com/2026-super/drift-ender/",
  );

  await page.getByRole("tab", { name: "US Retail" }).press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Chase Grid" })).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByRole("tab", { name: "Analyst" }).click();
  const undersizedButtons = await page.locator("button:visible").evaluateAll((buttons) => buttons
    .map((button) => ({ name: button.textContent?.trim(), rect: button.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width < 44 || rect.height < 44)
    .map(({ name, rect }) => `${name}: ${Math.round(rect.width)}x${Math.round(rect.height)}`));
  expect(undersizedButtons).toEqual([]);
});

test("mobile layout preserves the primary evidence entry points", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Analyst" }).click();
  await expect(page.getByText("Take a photo")).toBeVisible();
  await expect(page.getByText("Choose photos")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in to analyze/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
