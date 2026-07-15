import { expect, test } from "@playwright/test";
import pg from "pg";
import { assertSafeTestDatabaseUrl } from "../src/server/test-database-guard.mjs";
const { Pool } = pg;
const pool = new Pool({ connectionString: assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL), allowExitOnIdle: true });
const secret = "operator-e2e-shared-secret-000000000000";
let reference; let requestId;
const email = `operator-e2e-${Date.now()}@example.test`;
const exactAddress = "123 Main St, Chicago, IL 60601";
const privateNote = "Synthetic operator E2E private note";

test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/booking-requests", { headers: { "idempotency-key": `operator-e2e-${Date.now()}` }, data: {
    customer: { name: "Operator E2E Customer", email, phone: "+1 312 555 0199" }, consent: { accepted: true, source: "booking_request_form" }, marketId: "chicago",
    serviceId: "diagnostic", fulfillmentId: "mobile", providerPreferenceId: "maria", vehicle: { year: 2020, make: "Subaru", model: "Outback", vinSuffix: "H4P220" },
    schedulePreference: "Weekday mornings", location: { type: "driveway", address: exactAddress, postalCode: "60601", notes: privateNote },
  }});
  expect(response.status()).toBe(201); reference = (await response.json()).publicReference;
  requestId = (await pool.query("SELECT id FROM booking_requests WHERE public_reference = $1", [reference])).rows[0].id;
});
test.afterAll(async () => { if (requestId) { await pool.query("DELETE FROM booking_requests WHERE id = $1", [requestId]); const events = await pool.query("SELECT count(*)::int AS count FROM booking_request_events WHERE booking_request_id = $1", [requestId]); expect(events.rows[0].count).toBe(0); } await pool.end(); });

test("operator queue is protected, throttled, masked, auditable, and logout invalidates access", async ({ page, request }) => {
  const unauthApi = await request.get("/operator/api/requests"); expect(unauthApi.status()).toBe(401); expect(await unauthApi.text()).not.toContain(reference);
  await page.goto("/operator/requests"); await expect(page).toHaveURL(/\/operator\/login$/);
  for (let i = 0; i < 5; i++) expect(await page.evaluate(async () => (await fetch("/operator/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: "wrong-secret-value-that-is-never-valid" }) })).status)).toBe(401);
  expect(await page.evaluate(async () => (await fetch("/operator/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: "wrong-secret-value-that-is-never-valid" }) })).status)).toBe(429);
  const rawIpRows = await pool.query("SELECT identity_hash FROM operator_login_rate_limit_windows"); expect(rawIpRows.rows.every(row => /^[a-f0-9]{64}$/.test(row.identity_hash))).toBe(true); expect(JSON.stringify(rawIpRows.rows)).not.toContain("127.0.0.1");
  await pool.query("DELETE FROM operator_login_rate_limit_windows");
  await page.getByLabel("Operator secret").fill(secret); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/operator\/requests$/);
  await expect(page.getByText(reference)).toBeVisible(); await expect(page.getByText("o***@example.test", { exact: false })).toBeVisible();
  await expect(page.getByText(exactAddress)).toHaveCount(0); await expect(page.getByText(privateNote)).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal details" }).click(); const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("Sensitive customer data revealed"); await expect(dialog).toContainText(email); await expect(dialog).toContainText(exactAddress); await expect(dialog).toContainText(privateNote);
  page.on("dialog", d => d.type() === "prompt" ? d.accept("Customer contacted by phone") : d.accept()); const transitionResponse = page.waitForResponse(response => response.url().endsWith(`/operator/api/requests/${requestId}`) && response.request().method() === "PATCH"); await dialog.getByRole("button", { name: "Mark Contacted" }).click(); expect((await transitionResponse).status()).toBe(200); await expect(dialog.getByText("Contacted", { exact: true })).toBeVisible();
  const persisted = await pool.query(`SELECT br.status, count(ev.id) FILTER (WHERE ev.event_type='operator_status_transition')::int AS transitions
    FROM booking_requests br LEFT JOIN booking_request_events ev ON ev.booking_request_id=br.id WHERE br.id=$1 GROUP BY br.id`, [requestId]); expect(persisted.rows[0]).toMatchObject({ status: "contacted", transitions: 1 });
  const illegal = await page.request.patch(`/operator/api/requests/${requestId}`, { headers: { origin: "http://127.0.0.1:3107" }, data: { currentStatus: "contacted", version: 1, newStatus: "contacted", reason: "noop" } }); expect(illegal.status()).toBe(422);
  await dialog.getByRole("button", { name: "Close" }).click(); await page.getByRole("button", { name: "Sign out" }).click(); await expect(page).toHaveURL(/\/operator\/login$/); expect((await page.request.get("/operator/api/requests")).status()).toBe(401);
});
