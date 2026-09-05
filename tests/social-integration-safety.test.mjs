import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("social route preserves restricted customer and social access", async () => {
  const app = await read("../src/App.jsx");

  assert.match(app, /path="\/customer"[\s\S]*?allowedRoles=\{\s*OPERATIONAL_ROLES/);
  assert.match(app, /path="\/social-media"[\s\S]*?allowedRoles=\{\s*OPERATIONAL_ROLES/);
});

test("sidebar keeps final order and hides operational sections from Staff", async () => {
  const sidebar = await read("../src/components/Sidebar.jsx");
  const labels = [
    "Dashboard",
    "Booking List",
    "Transactions",
    "Customer Data",
    "Spending",
    "Bookkeeping",
    "Timeline",
    "Invoice",
  ];
  let previous = -1;

  for (const label of labels) {
    const position = sidebar.indexOf(label);
    assert.ok(position > previous, `${label} harus berada pada urutan yang benar`);
    previous = position;
  }

  assert.doesNotMatch(sidebar, /to="\/galleries"/);
  assert.doesNotMatch(sidebar, /to="\/social-media"/);
});

test("social inbox uses ten rows per page", async () => {
  const socialPage = await read("../src/pages/SocialMedia.jsx");
  assert.match(socialPage, /const pageSize = 10;/);
});

test("social SQL does not mutate existing finance tables", async () => {
  const sql = (await read("../supabase/social-media.sql")).toLowerCase();
  const protectedTables = [
    "customers",
    "bookings",
    "transactions",
    "spendings",
    "bookkeeping_reports",
    "employees",
  ];

  for (const table of protectedTables) {
    assert.doesNotMatch(sql, new RegExp(`delete\\s+from\\s+(public\\.)?${table}\\b`));
    assert.doesNotMatch(sql, new RegExp(`update\\s+(public\\.)?${table}\\b`));
    assert.doesNotMatch(sql, new RegExp(`drop\\s+table[\\s\\S]*?\\b${table}\\b`));
    assert.doesNotMatch(sql, new RegExp(`truncate[\\s\\S]*?\\b${table}\\b`));
  }
});

test("worker secret files are ignored", async () => {
  const gitignore = await read("../.gitignore");
  assert.match(gitignore, /^\.dev\.vars$/m);
  assert.match(gitignore, /^!\.dev\.vars\.example$/m);
  assert.match(gitignore, /^\.wrangler$/m);
});
