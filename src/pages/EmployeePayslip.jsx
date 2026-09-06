import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabase";
import {
  calculatePayslipTotals,
  downloadEmployeePayslipPdf,
  formatPayslipCurrency,
  formatPayslipPeriod,
  previewEmployeePayslipPdf,
} from "../lib/employeePayslipPdf";
import { formatGroupedNumberInput, parseGroupedNumberInput } from "../lib/uiFormatting";
import "./EmployeePayslip.css";

const BRANDS = ["PLUNO STUDIO", "VANGUENA"];
const ENTRY_TYPES = ["Overtime", "Incentive", "Other"];

function currentPeriod() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function emptyEntry() {
  return { date: "", type: "Overtime", description: "", amount: "" };
}

function setupError(error) {
  const message = error?.message || "Unable to load employee payslips.";
  if (message.includes("employee_payslips") || error?.code === "PGRST205") {
    return "Payslip database is not ready. Run supabase/employee-payslips.sql in the Supabase SQL Editor, then reload this page.";
  }
  return message;
}

function EmployeePayslip() {
  const [employees, setEmployees] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [payslipToDelete, setPayslipToDelete] = useState(null);
  const [form, setForm] = useState({
    brand_name: BRANDS[0],
    employee_id: "",
    period: currentPeriod(),
    position: "",
    base_salary: "",
    deduction: "",
    notes: "",
    entries: [],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [employeeResult, payslipResult] = await Promise.all([
      supabase.from("employees").select("id, name, role, status").eq("status", "Aktif").order("name"),
      supabase.from("employee_payslips").select("*").order("generated_at", { ascending: false }),
    ]);
    const loadError = employeeResult.error || payslipResult.error;
    if (loadError) setError(setupError(loadError));
    setEmployees(employeeResult.data || []);
    setPayslips(payslipResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const openGenerator = () => {
    const firstEmployee = employees[0];
    setForm({
      brand_name: BRANDS[0],
      employee_id: firstEmployee?.id || "",
      period: currentPeriod(),
      position: firstEmployee?.role || "",
      base_salary: "",
      deduction: "",
      notes: "",
      entries: [],
    });
    setError("");
    setNotice("");
    setGeneratorOpen(true);
  };

  const totals = useMemo(() => calculatePayslipTotals(form), [form]);
  const totalPaid = useMemo(() => payslips.reduce((sum, payslip) => sum + calculatePayslipTotals(payslip).netPay, 0), [payslips]);

  const updateEntry = (index, field, value) => {
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry),
    }));
  };

  const generatePayslip = async (event) => {
    event.preventDefault();
    const employee = employees.find((item) => item.id === form.employee_id);
    if (!employee || !form.period || !form.position.trim() || Number(form.base_salary) < 0 || totals.netPay < 0) {
      setError("Complete the employee, period, position, and valid salary values.");
      return;
    }

    setSaving(true);
    setError("");
    const entries = form.entries
      .filter((entry) => entry.description.trim() || Number(entry.amount) > 0)
      .map((entry) => ({ ...entry, amount: Number(entry.amount || 0) }));
    const payload = {
      brand_name: form.brand_name,
      employee_id: employee.id,
      employee_name: employee.name,
      position: form.position.trim(),
      period: form.period,
      base_salary: Number(form.base_salary || 0),
      deduction: Number(form.deduction || 0),
      entries,
      notes: form.notes.trim(),
    };
    const { data, error: createError } = await supabase.from("employee_payslips").insert(payload).select().single();
    if (createError) {
      setError(setupError(createError));
    } else {
      setPayslips((current) => [data, ...current]);
      setGeneratorOpen(false);
      setNotice(`${data.payslip_number} generated and ready to download.`);
    }
    setSaving(false);
  };

  const deletePayslip = async () => {
    if (!payslipToDelete) return;
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase.from("employee_payslips").delete().eq("id", payslipToDelete.id);
    if (deleteError) setError(setupError(deleteError));
    else {
      setPayslips((current) => current.filter((item) => item.id !== payslipToDelete.id));
      setNotice(`${payslipToDelete.payslip_number} deleted.`);
      setPayslipToDelete(null);
    }
    setSaving(false);
  };

  const previewPayslip = (payslip) => {
    if (!previewEmployeePayslipPdf(payslip)) setError("The browser blocked the preview window. Allow pop-ups or use Download PDF.");
  };

  return (
    <div className="payslip-page">
      <Sidebar activePage="employee-payslips" />
      <main className="payslip-main">
        <header className="payslip-header">
          <div><span>Management</span><h1>Employee Payslips</h1><p>Generate simple salary slips for PLUNO Studio or Vanguena.</p></div>
          <button type="button" className="payslip-primary" onClick={openGenerator} disabled={loading || !employees.length}>Generate Payslip</button>
        </header>

        {error && <div className="payslip-alert error" role="alert">{error}</div>}
        {notice && <div className="payslip-alert success" role="status">{notice}</div>}

        <section className="payslip-summary" aria-label="Payslip summary">
          <div><span>Total payslips</span><strong>{payslips.length}</strong></div>
          <div><span>Total net pay</span><strong>{formatPayslipCurrency(totalPaid)}</strong></div>
          <div><span>Active employees</span><strong>{employees.length}</strong></div>
        </section>

        <section className="payslip-content">
          <header><div><h2>Generated payslips</h2><p>Every record keeps the employee and salary details used when generated.</p></div></header>
          {loading ? <div className="payslip-empty">Loading payslips...</div> : payslips.length === 0 ? (
            <div className="payslip-empty"><strong>No payslips yet</strong><span>Generate the first salary slip for an active employee.</span></div>
          ) : (
            <div className="payslip-list">
              {payslips.map((payslip) => {
                const rowTotals = calculatePayslipTotals(payslip);
                return <article className="payslip-row" key={payslip.id}>
                  <div><span>Payslip ID</span><strong>{payslip.payslip_number}</strong></div>
                  <div><span>Employee</span><strong>{payslip.employee_name}</strong><small>{payslip.position}</small></div>
                  <div><span>Brand</span><strong>{payslip.brand_name}</strong></div>
                  <div><span>Period</span><strong>{formatPayslipPeriod(payslip.period)}</strong></div>
                  <div><span>Net pay</span><strong>{formatPayslipCurrency(rowTotals.netPay)}</strong></div>
                  <div className="payslip-actions">
                    <button type="button" onClick={() => previewPayslip(payslip)}>Preview</button>
                    <button type="button" onClick={() => downloadEmployeePayslipPdf(payslip)}>Download PDF</button>
                    <button type="button" className="danger" onClick={() => setPayslipToDelete(payslip)}>Delete</button>
                  </div>
                </article>;
              })}
            </div>
          )}
        </section>
      </main>

      {generatorOpen && <div className="payslip-overlay" onMouseDown={(event) => event.target === event.currentTarget && !saving && setGeneratorOpen(false)}>
        <form className="payslip-modal" onSubmit={generatePayslip} role="dialog" aria-modal="true" aria-labelledby="generate-payslip-title">
          <header><div><span>New document</span><h2 id="generate-payslip-title">Generate Payslip</h2><p>Fill in the essentials. Overtime and incentives are optional.</p></div><button type="button" className="payslip-close" onClick={() => setGeneratorOpen(false)} aria-label="Close">×</button></header>
          <div className="payslip-form-body">
            {error && <div className="payslip-form-error" role="alert">{error}</div>}
            <div className="payslip-form-grid">
              <label><span>Brand</span><select value={form.brand_name} onChange={(event) => setForm((current) => ({ ...current, brand_name: event.target.value }))}>{BRANDS.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
              <label><span>Employee</span><select value={form.employee_id} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); setForm((current) => ({ ...current, employee_id: event.target.value, position: employee?.role || current.position })); }} required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              <label><span>Period</span><input type="month" value={form.period} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))} required /></label>
              <label><span>Position</span><input value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))} placeholder="Example: Admin" required /></label>
              <label><span>Base salary</span><input type="text" inputMode="numeric" value={formatGroupedNumberInput(form.base_salary)} onChange={(event) => setForm((current) => ({ ...current, base_salary: parseGroupedNumberInput(event.target.value) }))} placeholder="1.000.000" required /></label>
              <label><span>Deductions</span><input type="text" inputMode="numeric" value={formatGroupedNumberInput(form.deduction)} onChange={(event) => setForm((current) => ({ ...current, deduction: parseGroupedNumberInput(event.target.value) }))} placeholder="0" /></label>
            </div>

            <section className="payslip-extra-section">
              <div className="payslip-extra-heading"><div><strong>Overtime and incentives</strong><span>Optional detail rows</span></div><button type="button" onClick={() => setForm((current) => ({ ...current, entries: [...current.entries, emptyEntry()] }))}>+ Add detail</button></div>
              {form.entries.length === 0 ? <div className="payslip-extra-empty">No additional income details.</div> : form.entries.map((entry, index) => <div className="payslip-extra-row" key={`${index}-${entry.type}`}>
                <input aria-label="Detail date" type="date" value={entry.date} onChange={(event) => updateEntry(index, "date", event.target.value)} />
                <select aria-label="Detail type" value={entry.type} onChange={(event) => updateEntry(index, "type", event.target.value)}>{ENTRY_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                <input aria-label="Detail description" value={entry.description} onChange={(event) => updateEntry(index, "description", event.target.value)} placeholder="Description" />
                <input aria-label="Detail amount" type="text" inputMode="numeric" value={formatGroupedNumberInput(entry.amount)} onChange={(event) => updateEntry(index, "amount", parseGroupedNumberInput(event.target.value))} placeholder="Amount" />
                <button type="button" aria-label="Remove detail" onClick={() => setForm((current) => ({ ...current, entries: current.entries.filter((_, entryIndex) => entryIndex !== index) }))}>×</button>
              </div>)}
            </section>

            <label className="payslip-notes"><span>Notes <small>Optional</small></span><textarea rows="2" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Additional information for this payslip" /></label>
            <div className="payslip-live-total"><span>Net pay</span><strong>{formatPayslipCurrency(totals.netPay)}</strong></div>
          </div>
          <footer><button type="button" onClick={() => setGeneratorOpen(false)}>Cancel</button><button type="submit" className="payslip-primary" disabled={saving}>{saving ? "Generating..." : "Generate Payslip"}</button></footer>
        </form>
      </div>}

      {payslipToDelete && <div className="payslip-overlay" onMouseDown={(event) => event.target === event.currentTarget && !saving && setPayslipToDelete(null)}>
        <section className="payslip-modal delete" role="dialog" aria-modal="true" aria-labelledby="delete-payslip-title">
          <header><div><span>Permanent action</span><h2 id="delete-payslip-title">Delete Payslip</h2><p>The generated salary record will be permanently removed.</p></div></header>
          <div className="payslip-delete-copy">Delete <strong>{payslipToDelete.payslip_number}</strong> for <strong>{payslipToDelete.employee_name}</strong>?</div>
          <footer><button type="button" onClick={() => setPayslipToDelete(null)} disabled={saving}>Cancel</button><button type="button" className="payslip-danger" onClick={deletePayslip} disabled={saving}>{saving ? "Deleting..." : "Delete Payslip"}</button></footer>
        </section>
      </div>}
    </div>
  );
}

export default EmployeePayslip;
