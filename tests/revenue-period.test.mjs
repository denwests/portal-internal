import assert from "node:assert/strict";
import test from "node:test";

import {
  getRevenueDate,
  isRevenueInMonth,
  isRevenueInRange,
} from "../src/lib/revenuePeriod.js";

test("DP paid in August for a September event is September revenue", () => {
  const transaction = {
    transaction_date: "2026-08-29",
    revenue_date: "2026-09-05",
    amount: 2_000_000,
  };

  assert.equal(isRevenueInMonth(transaction, "2026", "08"), false);
  assert.equal(isRevenueInMonth(transaction, "2026", "09"), true);
});

test("September settlement for an August event remains August revenue", () => {
  const transaction = {
    transaction_date: "2026-09-01",
    revenue_date: "2026-08-31",
    amount: 3_000_000,
  };

  assert.equal(isRevenueInRange(transaction, "2026-08-01", "2026-08-31"), true);
  assert.equal(isRevenueInRange(transaction, "2026-09-01", "2026-09-30"), false);
});

test("legacy transaction falls back to its payment date", () => {
  const transaction = {
    transaction_date: "2026-08-15",
    revenue_date: null,
  };

  assert.equal(getRevenueDate(transaction), "2026-08-15");
});
