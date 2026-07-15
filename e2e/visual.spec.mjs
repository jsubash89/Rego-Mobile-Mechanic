import { expect, test } from "@playwright/test";
import { failOnBrowserErrors } from "./helpers/browser-errors.mjs";

for (const viewport of [
  { name: "desktop", width: 1063, height: 844 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`customer shell visual baseline - ${viewport.name}`, async ({ page }) => {
    const assertNoBrowserErrors = failOnBrowserErrors(page);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /On-Demand Auto Service/ })).toBeVisible();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page).toHaveScreenshot(`customer-shell-${viewport.name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
    assertNoBrowserErrors();
  });
}
