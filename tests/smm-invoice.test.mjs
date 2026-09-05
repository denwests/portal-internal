import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSmmInvoicePdf, formatInvoiceCurrency } from "../src/lib/smmInvoicePdf.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("SMM invoice route is restricted and sits below Timeline", async () => {
  const app = await read("../src/App.jsx");
  const sidebar = await read("../src/components/Sidebar.jsx");

  assert.match(app, /path="\/smm-invoice"[\s\S]*?allowedRoles=\{OPERATIONAL_ROLES\}/);
  assert.ok(sidebar.indexOf('to="/smm-invoice"') > sidebar.indexOf('to="/smm-timeline"'));
});

test("SMM invoice SQL preserves snapshots and uses role-based RLS", async () => {
  const sql = await read("../supabase/smm-invoice.sql");

  assert.match(sql, /create table if not exists public\.smm_invoices/);
  assert.match(sql, /client_name text not null/);
  assert.match(sql, /payment_information text not null/);
  assert.match(sql, /drop column if exists parent_brand/);
  assert.match(sql, /drop column if exists billing_period/);
  assert.match(sql, /alter table public\.smm_invoices enable row level security/);
  assert.match(sql, /current_user_can_manage_smm_invoice/);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(sql, /grant select, insert, delete on table public\.smm_invoices to authenticated/);
  assert.match(sql, /on public\.smm_invoices for delete to authenticated/);
  assert.doesNotMatch(sql, /grant[^\n]*update[^\n]*public\.smm_invoices/i);
});

test("generated invoices can be deleted after confirmation", async () => {
  const page = await read("../src/pages/SmmInvoice.jsx");

  assert.match(page, /className="invoice-delete-button"/);
  assert.match(page, /className="invoice-modal invoice-delete-modal"/);
  assert.match(page, /\.from\("smm_invoices"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", invoiceToDelete\.id\)/);
});

test("SMM invoice PDF renders a valid document", () => {
  const doc = buildSmmInvoicePdf({
    invoice_number: "VGN-202609-001",
    client_name: "Asih Group",
    invoice_date: "2026-09-05",
    title: "Invoice",
    description: "Product Photography",
    amount: 5500000,
    information: "Preparation Start-Up Ruang Jumpa",
    payment_information: "Payment details configured in Settings",
    brand_name: "Vanguena",
    generated_at: "2026-09-05T06:00:00.000Z",
  });
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const header = new TextDecoder().decode(bytes.slice(0, 8));

  assert.match(header, /^%PDF-/);
  assert.ok(bytes.length > 3000);
  assert.equal(doc.internal.getNumberOfPages(), 1);
  assert.equal(formatInvoiceCurrency(5500000), "Rp5.500.000");
});

test("SMM invoice has a dedicated mobile card layout", async () => {
  const page = await read("../src/pages/SmmInvoice.jsx");
  const styles = await read("../src/pages/SmmInvoice.css");

  assert.match(page, /invoice-mobile-list/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /\.invoice-desktop-list\{display:none\}/);
  assert.match(styles, /\.invoice-mobile-list\{display:block\}/);
});

test("Vanguena invoice stays generic without parent brand or billing period", async () => {
  const page = await read("../src/pages/SmmInvoice.jsx");
  const pdf = await read("../src/lib/smmInvoicePdf.js");

  assert.doesNotMatch(page, /parent_brand|billing_period|Billing period/);
  assert.doesNotMatch(pdf, /parent_brand|billing_period|BILLING PERIOD|A PLUNO STUDIO BRAND/);
});
