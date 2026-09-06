import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildEmployeePayslipPdf, calculatePayslipTotals, formatPayslipCurrency } from "../src/lib/employeePayslipPdf.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const sample = {
  payslip_number: "PLN-PAY-202606-001",
  brand_name: "PLUNO STUDIO",
  employee_name: "April",
  position: "Admin",
  period: "2026-06",
  base_salary: 1000000,
  deduction: 50000,
  entries: [
    { date: "2026-06-15", type: "Overtime", description: "Studio rental", amount: 25000 },
    { date: "2026-06-20", type: "Overtime", description: "Product session", amount: 25000 },
    { date: "2026-06-25", type: "Incentive", description: "Monthly incentive", amount: 100000 },
  ],
  generated_at: "2026-07-01T03:00:00.000Z",
};

test("Employee Payslips route and navigation are Founder-only", async () => {
  const app = await read("../src/App.jsx");
  const sidebar = await read("../src/components/Sidebar.jsx");
  assert.match(app, /path="\/employee-payslips"[\s\S]*?allowedRoles=\{FOUNDER_ONLY\}/);
  assert.match(sidebar, /employeeRole === "Founder"[\s\S]*?to="\/employee-payslips"/);
});

test("payslip totals combine optional income and deductions", () => {
  const totals = calculatePayslipTotals(sample);
  assert.equal(totals.overtime, 50000);
  assert.equal(totals.incentive, 100000);
  assert.equal(totals.grossPay, 1150000);
  assert.equal(totals.netPay, 1100000);
  assert.equal(formatPayslipCurrency(totals.netPay), "Rp1.100.000");
});

test("employee payslip PDF renders one valid document", () => {
  const doc = buildEmployeePayslipPdf(sample);
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  assert.match(new TextDecoder().decode(bytes.slice(0, 8)), /^%PDF-/);
  assert.ok(bytes.length > 4000);
  assert.equal(doc.internal.getNumberOfPages(), 1);
});

test("payslip SQL uses explicit grants and Founder-only RLS", async () => {
  const sql = await read("../supabase/employee-payslips.sql");
  assert.match(sql, /alter table public\.employee_payslips enable row level security/);
  assert.match(sql, /grant select, insert, delete on table public\.employee_payslips to authenticated/);
  assert.match(sql, /role = 'Founder'/);
  assert.match(sql, /current_user_can_manage_employee_payslips/);
  assert.match(sql, /revoke all on function public\.set_employee_payslip_number\(\) from public/);
  assert.match(sql, /for insert to authenticated with check/);
  assert.match(sql, /for delete to authenticated using/);
  assert.doesNotMatch(sql, /grant[^\n]*update[^\n]*employee_payslips/i);
});

test("payslip generator stays simple and supports both brands", async () => {
  const page = await read("../src/pages/EmployeePayslip.jsx");
  assert.match(page, /\["PLUNO STUDIO", "VANGUENA"\]/);
  assert.match(page, /Overtime and incentives/);
  assert.match(page, /Generate Payslip/);
  assert.match(page, /Download PDF/);
  assert.match(page, /Delete Payslip/);
});
