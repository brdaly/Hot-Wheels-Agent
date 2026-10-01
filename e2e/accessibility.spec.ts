import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { HUNT_REFERENCE_IMAGES } from "../data/hunt-reference-images";

test("core collector workflow is navigable and has no serious accessibility violations", async ({ page }) => {
  let analyzeRequests = 0;
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/analyze") analyzeRequests += 1;
    if (request.resourceType() === "image") imageRequests.push(request.url());
  });
  const response = await page.goto("/");
  const imagePolicy = response?.headers()["content-security-policy"]?.split(";")
    .map((directive) => directive.trim()).find((directive) => directive.startsWith("img-src "));
  expect(imagePolicy).toBe("img-src 'self' blob: data:");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Built for");
  await expect(page.getByRole("heading", { name: "See how the analyst reaches a decision." })).toBeVisible();
  await expect(page.getByText("PRECOMPUTED RULES DEMO")).toBeVisible();

  await page.getByRole("button", { name: /Verify first/i }).click();
  await expect(page.getByRole("heading", { name: "No buy call yet" })).toBeVisible();
  expect(analyzeRequests).toBe(0);

  await page.getByRole("tab", { name: "Chase Grid" }).click();
  await expect(page.getByRole("heading", { name: "The Chase Grid" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Drift-Ender/ })).toHaveAttribute(
    "href",
    "https://hwheadline.com/drift-ender-2026-hot-wheels-super-treasure-hunt/",
  );
  await expect(page.locator(".hunt-car img")).toHaveCount(30);
  await expect(page.getByRole("link", { name: /View photo on HWheadline for/ })).toHaveCount(30);
  for (const photo of HUNT_REFERENCE_IMAGES) {
    const card = page.locator(".hunt-car").filter({ has: page.getByText(photo.part, { exact: true }) });
    const placeholder = card.locator("img");
    await expect(placeholder).toHaveAttribute("src", "/hunt-placeholder.svg");
    await expect(placeholder).toHaveAttribute("alt", "");
    await expect(card.getByRole("link", { name: /View photo on HWheadline for/ })).toHaveAttribute("href", photo.sourceUrl);
    await placeholder.scrollIntoViewIfNeeded();
    await expect.poll(() => placeholder.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await expect(page.getByText("Photo: HWheadline / HWJamey (on source page)").first()).toBeVisible();
  expect(imageRequests.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);

  await page.getByRole("tab", { name: "US Retail" }).press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Chase Grid" })).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByRole("tab", { name: "Owner Workspace" }).click();
  await expect(page.getByRole("heading", { name: "Full analysis is in private beta" })).toBeVisible();
  await expect(page.getByText("Take a photo")).toBeHidden();
  const undersizedButtons = await page.locator("button:visible").evaluateAll((buttons) => buttons
    .map((button) => ({ name: button.textContent?.trim(), rect: button.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width < 44 || rect.height < 44)
    .map(({ name, rect }) => `${name}: ${Math.round(rect.width)}x${Math.round(rect.height)}`));
  expect(undersizedButtons).toEqual([]);
});

test("mobile layout preserves the primary evidence entry points", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, developmentBypass: true }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Owner Workspace" }).click();
  await expect(page.getByRole("heading", { name: "Owner session active" })).toBeVisible();
  await expect(page.getByText("Take a photo")).toBeVisible();
  await expect(page.getByText("Choose photos")).toBeVisible();
  await expect(page.getByText("Full card + blister")).toBeVisible();
  await expect(page.getByRole("button", { name: /Run collector analysis/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("disclaimer and privacy pages are reachable and accessible", async ({ page }) => {
  for (const route of ["/disclaimer", "/privacy"]) {
    await page.goto(route);
    await expect(page.getByRole("link", { name: /Back to Collector Intelligence/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  }
});
