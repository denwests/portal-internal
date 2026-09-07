import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getActiveBookingDeposit, sumActiveBookingDeposits } from "../src/lib/bookingPayments.js";
import { buildCustomerNetRevenueSeries } from "../src/lib/customerFinance.js";

test("dashboard monthly net revenue matches Customer Data final net values", () => {
  const rows = [
    { date: "2026-09-05", total_net_value: 997000 },
    { date: "2026-09-12", total_net_value: 500000 },
    { date: "2026-08-20", total_net_value: 300000 },
    { date: "2025-09-05", total_net_value: 800000 },
  ];
  const series = buildCustomerNetRevenueSeries(rows, 2026);
  assert.equal(series[8], 1497000);
  assert.equal(series[7], 300000);
  assert.equal(series.reduce((sum, value) => sum + value, 0), 1797000);
});

test("active DP disappears after a booking is fully paid", () => {
  const partial = { package_price: 1000000, paid_amount: 300000, payment_status: "Partial", status: "Complete" };
  const paid = { package_price: 1000000, paid_amount: 1000000, payment_status: "Paid", status: "Complete" };
  const legacyPartial = { package_price: 900000, paid_amount: 0, down_payment: 200000, payment_status: "Partial", status: "Complete" };
  const canceled = { package_price: 1000000, paid_amount: 250000, payment_status: "Partial", status: "Canceled" };
  assert.equal(getActiveBookingDeposit(partial), 300000);
  assert.equal(getActiveBookingDeposit(paid), 0);
  assert.equal(getActiveBookingDeposit(legacyPartial), 200000);
  assert.equal(getActiveBookingDeposit(canceled), 0);
  assert.equal(sumActiveBookingDeposits([partial, paid, legacyPartial, canceled]), 500000);
});

test("iPhone payment settlement is scrollable and uses a compact grid", async () => {
  const css = await readFile(new URL("../src/pluno-night.css", import.meta.url), "utf8");
  assert.match(css, /#root \.booking-overlay \{[\s\S]*?overflow-y: auto !important;[\s\S]*?touch-action: pan-y;/);
  assert.match(css, /#root \.booking-payment-modal \{[\s\S]*?max-height: calc\(100dvh - 20px\) !important;[\s\S]*?overflow-y: auto !important;/);
  assert.match(css, /#root \.booking-payment-summary \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/);
});

test("booking list exposes active DP and Dashboard uses customer finance RPC", async () => {
  const [booking, dashboard] = await Promise.all([
    readFile(new URL("../src/pages/Booking.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(booking, /<th>ACTIVE DP<\/th>/);
  assert.match(booking, /sumActiveBookingDeposits\(filteredBookings\)/);
  assert.match(dashboard, /rpc\(\s*"get_customer_finance_summary"\s*\)/);
  assert.match(dashboard, />\s*NET REVENUE\s*</);
  assert.doesNotMatch(dashboard, /\.from\("transactions"\)/);
});
