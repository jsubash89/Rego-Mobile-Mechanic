import { expect, test } from "@playwright/test";
import pg from "pg";
import { failOnBrowserErrors } from "./helpers/browser-errors.mjs";
import { assertSafeTestDatabaseUrl } from "../src/server/test-database-guard.mjs";

const { Pool } = pg;
const databaseUrl = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const pool = new Pool({ connectionString: databaseUrl, max: 2, allowExitOnIdle: true });
const references = new Set();
const customerEmails = new Set();
const fullVin = "1HGCM82633A654321";
const vinLast6 = fullVin.slice(-6);
const privateNote = "E2E blue garage, level 2";

async function reachRequestForm(page) {
  await page.goto("/");
  await page.getByLabel("Service address").fill("100 W Randolph St, Chicago, IL 60601");
  await page.getByRole("button", { name: "Schedule Now" }).click();
  const vehicle = page.getByRole("dialog", { name: /vehicle/i });
  await expect(vehicle.getByLabel("Vehicle VIN", { exact: true })).toHaveCount(0);
  await vehicle.getByLabel("VIN last 6").fill(vinLast6);
  await vehicle.getByRole("button", { name: "Next" }).click();
  await page.getByRole("dialog", { name: /schedule/i }).getByRole("button", { name: /Earliest Available/ }).click();
  await page.getByRole("dialog", { name: "Service Details" }).getByRole("button", { name: "Continue to location" }).click();
  const form = page.getByRole("dialog", { name: /service the vehicle/i });
  await form.getByLabel("Customer-entered Chicago ZIP code").fill("60601");
  await form.getByLabel("Location Notes").fill(privateNote);
  return form;
}

async function completeContact(form, suffix) {
  const email = `rego-e2e-${suffix}@example.test`;
  customerEmails.add(email);
  await form.getByLabel("Customer name").fill(`Playwright Customer ${suffix}`);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel(/I consent to ReGo contacting me/).check();
}

test.afterEach(async () => {
  if (customerEmails.size) {
    await pool.query("DELETE FROM booking_requests WHERE customer->>'email' = ANY($1::text[])", [[...customerEmails]]);
  }
  if (references.size) {
    await pool.query("DELETE FROM booking_requests WHERE public_reference = ANY($1::text[])", [[...references]]);
  }
});

test.afterAll(async () => {
  await pool.end();
});

test("customer submits a durable pending-review request with truthful confirmation", async ({ page }) => {
  const assertNoBrowserErrors = failOnBrowserErrors(page);
  const form = await reachRequestForm(page);
  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  await completeContact(form, suffix);
  await expect(form).toContainText("operator coverage verification");

  const requestPromise = page.waitForRequest((request) => request.url().endsWith("/api/booking-requests") && request.method() === "POST");
  await form.getByRole("button", { name: "Submit service request" }).click();
  const sent = await requestPromise;
  const payload = sent.postDataJSON();
  expect(payload.marketId).toBe("chicago");
  expect(payload.providerPreferenceId).toBeUndefined();
  expect(payload.vehicle).toMatchObject({ vinSuffix: vinLast6 });
  expect(payload.vehicle.vin).toBeUndefined();
  expect(JSON.stringify(payload)).not.toContain(fullVin);
  for (const field of ["status", "actor", "createdAt", "total", "price", "publicReference"]) expect(payload[field]).toBeUndefined();

  const confirmation = page.getByTestId("request-confirmation");
  await expect(confirmation).toContainText("Request received");
  await expect(confirmation).toContainText("pending review");
  await expect(confirmation).toContainText(/requested time.*not confirmed/i);
  await expect(confirmation).toContainText("No payment was collected");
  const reference = (await confirmation.getByTestId("public-reference").textContent()).trim();
  expect(reference).toMatch(/^BR_[A-Z0-9]{10}$/);
  references.add(reference);

  await expect.poll(async () => {
    const result = await pool.query(`SELECT br.market_id, br.status, br.customer, br.location, br.vehicle,
      count(ev.id)::int AS event_count
      FROM booking_requests br LEFT JOIN booking_request_events ev ON ev.booking_request_id = br.id
      WHERE br.public_reference = $1 GROUP BY br.id`, [reference]);
    return result.rows[0];
  }).toMatchObject({ market_id: "chicago", status: "pending_review", event_count: 1 });

  const stored = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  const serialized = JSON.stringify(stored);
  expect(serialized).not.toContain(`rego-e2e-${suffix}@example.test`);
  expect(serialized).not.toContain("100 W Randolph St");
  expect(serialized).not.toContain(privateNote);
  expect(serialized).not.toContain(fullVin);
  expect(serialized).not.toContain(vinLast6);
  expect(serialized).not.toContain(reference);
  expect(serialized).not.toMatch(/idempotency/i);
  assertNoBrowserErrors();
});

test("failed submission preserves fields, shows no success, reuses retry key, and blocks duplicate clicks", async ({ page }) => {
  const form = await reachRequestForm(page);
  const suffix = `retry-${Date.now()}`;
  await completeContact(form, suffix);
  const keys = [];
  let attempts = 0;
  await page.route("**/api/booking-requests", async (route) => {
    attempts += 1;
    keys.push(route.request().headers()["idempotency-key"]);
    if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "secret database failure" }) });
    return route.fulfill({ status: 429, headers: { "retry-after": "1" }, contentType: "application/json", body: JSON.stringify({ error: "rate_limited" }) });
  });

  const submit = form.getByRole("button", { name: "Submit service request" });
  await submit.click();
  await expect(form).toContainText(/could not save/i);
  await expect(form.getByLabel("Email")).toHaveValue(`rego-e2e-${suffix}@example.test`);
  await expect(page.getByTestId("request-confirmation")).toHaveCount(0);
  await submit.dblclick();
  await expect(form).toContainText(/wait.*try again/i);
  expect(attempts).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  expect(keys[0]).toMatch(/^[A-Za-z0-9._:-]{10,128}$/);
});
