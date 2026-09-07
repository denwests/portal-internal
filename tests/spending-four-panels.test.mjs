import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateEvotoAmount,
  isBookkeepingExpense,
  normalizeSpendingCategory,
  summarizeSpendings,
} from "../src/lib/spendingFinance.js";

test("legacy and new Spending categories are normalized", () => {
  assert.equal(normalizeSpendingCategory("Studio Expenses"), "expense");
  assert.equal(normalizeSpendingCategory("Cash Movement"), "cash");
  assert.equal(normalizeSpendingCategory("Attire / Background"), "attire");
  assert.equal(normalizeSpendingCategory("Evoto Balance"), "evoto");
});

test("Evoto credit amount and monthly balance are calculated", () => {
  assert.equal(calculateEvotoAmount(125, 750), 93750);
  assert.equal(calculateEvotoAmount(1.5, 750), 1125);
  const summary = summarizeSpendings([
    { category: "evoto", evoto_direction: "In", evoto_credits: 200 },
    { category: "evoto", evoto_direction: "Out", evoto_credits: 60, evoto_credit_rate: 750 },
  ]);
  assert.equal(summary.evotoIn, 200);
  assert.equal(summary.evotoOut, 60);
  assert.equal(summary.evotoBalance, 140);
  assert.equal(summary.evotoUsageValue, 45000);
});

test("separate-wallet categories stay out of Bookkeeping", () => {
  assert.equal(isBookkeepingExpense({ category: "expense" }), true);
  assert.equal(isBookkeepingExpense({ category: "attire" }), false);
  assert.equal(isBookkeepingExpense({ category: "evoto", evoto_direction: "Out" }), false);
  assert.equal(isBookkeepingExpense({ category: "evoto", evoto_direction: "In" }), false);
  assert.equal(isBookkeepingExpense({ category: "cash" }), false);
});

test("Spending SQL includes constraints, grants, and RLS", async () => {
  const sql = await readFile(new URL("../supabase/spending-four-panels.sql", import.meta.url), "utf8");
  assert.match(sql, /spending_settings/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.spending_settings from anon, authenticated/i);
  assert.match(sql, /role in \('Founder', 'Administrator'\)/i);
  assert.match(sql, /'attire', 'evoto'/i);
});

test("Spending UI exposes four compact panels and responsive rules", async () => {
  const page = await readFile(new URL("../src/pages/Spending.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/pages/Spending.css", import.meta.url), "utf8");
  assert.match(page, /Attire \/ Background/);
  assert.match(page, /Evoto Balance/);
  assert.match(page, /Evoto credit rate/i);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /max-width:var\(--page-max\)!important/);
  assert.match(css, /STABLE GEOMETRY ACROSS WALLET SWITCHES/);
  assert.match(css, /@media\(max-width:760px\)/);
});
