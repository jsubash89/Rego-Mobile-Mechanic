import { expect, test } from "@playwright/test";
import { failOnBrowserErrors } from "./helpers/browser-errors.mjs";

const tiles = ["Oil Change", "Brakes", "Battery", "Car Tow", "Schedule a Pick Up", "Other Services"];
const browserErrorAssertions = new WeakMap();

async function openDetails(page, { service = "Oil Change", vehicle = {} } = {}) {
  await page.getByRole("button", { name: service, exact: true }).click();
  await page.getByRole("button", { name: "Schedule Now" }).click();
  const vehicleDialog = page.getByRole("dialog", { name: /vehicle/i });
  for (const [label, value] of Object.entries(vehicle)) await vehicleDialog.getByLabel(label).selectOption(value);
  await vehicleDialog.getByRole("button", { name: "Next" }).click();
  await page.getByRole("dialog", { name: /schedule/i }).getByRole("button", { name: /Earliest Available/ }).click();
  return page.getByRole("dialog", { name: "Service Details" });
}

async function reachLocation(page, options) {
  const details = await openDetails(page, options);
  await details.getByRole("button", { name: "Continue to location" }).click();
  return page.getByRole("dialog", { name: /service the vehicle/i });
}

async function demoQueueSnapshot(page, demo) {
  await page.getByRole("button", { name: demo, exact: true }).click();
  const jobs = page.locator(`[data-testid^="${demo}-job-"]`);
  await expect(jobs.first()).toBeVisible();
  const snapshot = await jobs.evaluateAll((nodes) => nodes.map((node) => ({
    testId: node.getAttribute("data-testid"),
    text: node.textContent.replace(/\s+/g, " ").trim(),
  })));
  await page.getByRole("button", { name: demo, exact: true }).click();
  return snapshot;
}

test.beforeEach(async ({ page }) => {
  browserErrorAssertions.set(page, failOnBrowserErrors(page));
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  browserErrorAssertions.get(page)?.();
});

test("customer shell exposes six canonical services and customer-only top navigation", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /On-Demand Auto Service/ })).toBeVisible();
  for (const tile of tiles) await expect(page.getByRole("button", { name: tile, exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Customer" });
  await expect(nav.getByRole("link")).toHaveText(["Service Area", "About Us", "Mechanic Sign Up"]);
  await expect(nav).not.toContainText(/provider|admin|dispatch/i);
});

test("oil details are specific while a non-oil branch omits oil details", async ({ page }) => {
  let details = await openDetails(page);
  await expect(details.getByText("Synthetic Engine Oil", { exact: true }).first()).toBeVisible();
  await expect(details.getByText("Oil Drain Plug Gasket")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Restored your booking draft/)).toBeVisible();

  details = await openDetails(page, { service: "Brakes" });
  await expect(details.getByText("Brake service parts/materials")).toBeVisible();
  await expect(details.getByText("Oil Drain Plug Gasket")).toHaveCount(0);
});

test("incomplete vehicle cannot confirm and receives specific guidance", async ({ page }) => {
  const location = await reachLocation(page, { vehicle: { Year: "" } });
  await location.getByRole("button", { name: "Confirm booking" }).click();
  await expect(location).toBeVisible();
  await expect(location).toContainText(/vehicle.*year/i);
  await expect(page.getByTestId("booking-confirmation")).toHaveCount(0);
});

test("mock booking confirms without payment and sensitive draft data never persists or restores confirmation", async ({ page }) => {
  const fullVin = "1HGCM82633A654321";
  const fullAddress = "9182 Distinctive Lavender Lane, Chicago, IL 60601";
  const privateNote = "Blue gate; secret location note 7419";

  await page.getByLabel("Service address").fill(fullAddress);
  await page.getByRole("button", { name: "Schedule Now" }).click();
  const vehicleDialog = page.getByRole("dialog", { name: /vehicle/i });
  await vehicleDialog.getByRole("button", { name: "VIN", exact: true }).click();
  await vehicleDialog.getByLabel("Vehicle VIN").fill(fullVin);
  await vehicleDialog.getByRole("button", { name: "Next" }).click();
  await page.getByRole("dialog", { name: /schedule/i }).getByRole("button", { name: /Earliest Available/ }).click();
  await page.getByRole("dialog", { name: "Service Details" }).getByRole("button", { name: "Continue to location" }).click();
  const location = page.getByRole("dialog", { name: /service the vehicle/i });
  await location.getByRole("button", { name: "Change Address" }).click();
  await location.getByLabel("Service address").fill(fullAddress);
  await location.getByLabel("Location Notes").fill(privateNote);
  await expect(location.getByText(/No payment is captured/)).toBeVisible();
  await location.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByTestId("booking-confirmation")).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem("rego.bookingDraft.v1"));
  expect(stored).not.toBeNull();
  expect(stored).not.toContain(fullVin);
  expect(stored).not.toContain(fullAddress);
  expect(stored).not.toContain(privateNote);
  expect(stored).not.toMatch(/confirmed|payment|message/i);

  await page.reload();
  await expect(page.getByTestId("booking-confirmation")).toHaveCount(0);
});

test("Car Tow is a partner-only fail-closed handoff and cannot mutate normal jobs", async ({ page }) => {
  const providerBefore = await demoQueueSnapshot(page, "provider");
  const dispatchBefore = await demoQueueSnapshot(page, "dispatch");
  await page.getByRole("button", { name: "Car Tow", exact: true }).click();
  const handoff = page.getByRole("dialog", { name: "Partner handoff for Car Tow" });
  await expect(handoff).toContainText("will not create a normal mechanic booking, provider assignment, or dispatch job");
  await handoff.getByLabel("Market").selectOption("boise");
  await expect(handoff).toContainText("No static partner card for this market; no ReGo booking will be created.");
  await expect(page.getByTestId("booking-confirmation")).toHaveCount(0);
  await handoff.getByRole("button", { name: "Back to ReGo" }).click();
  expect(await demoQueueSnapshot(page, "provider")).toEqual(providerBefore);
  expect(await demoQueueSnapshot(page, "dispatch")).toEqual(dispatchBefore);
});

test("booking modal moves and traps focus, closes on Escape, and restores its opener", async ({ page }) => {
  const opener = page.getByRole("button", { name: "Schedule Now" });
  await opener.focus();
  await opener.click();

  const dialog = page.getByRole("dialog", { name: /vehicle/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Next" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("mobile service details scroll inside the viewport and isolate the background", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const initialBodyOverflow = await page.evaluate(() => document.body.style.overflow);
  const details = await openDetails(page);
  const pageContent = page.locator("#rego-page-content");

  await expect(pageContent).toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const bounds = await details.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.height).toBeLessThanOrEqual(844);

  const pageScrollBefore = await page.evaluate(() => window.scrollY);
  const dialogScrollBefore = await details.evaluate((dialog) => dialog.scrollTop);
  await details.hover();
  await page.mouse.wheel(0, 2_000);
  await expect.poll(() => details.evaluate((dialog) => dialog.scrollTop)).toBeGreaterThan(dialogScrollBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);

  await details.getByRole("button", { name: "Continue to location" }).click();
  const location = page.getByRole("dialog", { name: /service the vehicle/i });
  await expect(location).toBeVisible();
  await expect(pageContent).toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await location.getByRole("button", { name: "Close" }).click();
  await expect(location).toHaveCount(0);
  await expect(pageContent).not.toHaveAttribute("inert", "");
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(initialBodyOverflow);
});

test("provider demo enforces lifecycle/report gates and exposes masked summaries only", async ({ page }) => {
  await page.getByRole("button", { name: "provider", exact: true }).click();
  await page.getByTestId("provider-job-BK-1042").click();
  const workbench = page.getByTestId("provider-workbench");
  await expect(workbench).toContainText("River North, Chicago");
  await expect(workbench).not.toContainText(/123 Main|JTMW|•••-•••/);
  await workbench.getByRole("button", { name: "Accept offer" }).click();
  await workbench.getByRole("button", { name: "Progress to confirmed" }).click();
  await workbench.getByRole("button", { name: "Progress to en route" }).click();
  await workbench.getByRole("button", { name: "Progress to arrived" }).click();
  await workbench.getByRole("button", { name: "Progress to in progress" }).click();
  await workbench.getByRole("button", { name: "Progress to completed" }).click();
  await expect(workbench).toContainText(/report notes|required|checklist|invoice/i);
  await expect(workbench.getByTestId("provider-job-status")).toHaveText(/in_progress/);

  await page.getByTestId("provider-job-BK-1038").click();
  await workbench.getByRole("button", { name: "Progress to completed" }).click();
  await expect(workbench.getByTestId("provider-job-status")).toHaveText(/completed/);
});

test("dispatch demo guards assignment, resolves blockers, masks data, and has no roadside assignability", async ({ page }) => {
  await page.getByRole("button", { name: "dispatch", exact: true }).click();
  await page.getByTestId("dispatch-job-BK-1045").click();
  const workbench = page.getByTestId("dispatch-workbench");
  await expect(workbench.getByRole("button", { name: "Reassign with override" })).toBeDisabled();
  await workbench.getByRole("button", { name: "Assign best provider" }).click();
  await expect(workbench.getByRole("button", { name: "Reassign with override" })).toBeEnabled();
  await expect(workbench).toContainText("Fulton Market, Chicago");
  await expect(workbench).not.toContainText(/9182|JTMW|•••-•••/);

  await page.getByTestId("dispatch-job-BK-1043").click();
  await workbench.getByRole("button", { name: "Resolve blocker" }).click();
  await expect(workbench.getByTestId("dispatch-job-status")).toHaveText(/in_progress/);
  await expect(page.locator('button[data-testid^="dispatch-job-"]').filter({ hasText: /tow|roadside/i })).toHaveCount(0);
});
