import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabase";
import {
  downloadSmmInvoicePdf,
  formatGeneratedAt,
  formatInvoiceCurrency,
  formatInvoiceDate,
  previewSmmInvoicePdf,
} from "../lib/smmInvoicePdf";
import "./SmmInvoice.css";

const DEFAULT_SETTINGS = {
  id: 1,
  invoice_title: "Invoice",
  default_description: "",
  default_amount: 0,
  default_information: "",
  payment_information: "",
  brand_name: "Vanguena",
};

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setupError(error) {
  const message = error?.message || "Unable to load SMM invoices.";
  if (message.includes("smm_invoice") || error?.code === "PGRST205") {
    return "Invoice database is not ready. Run supabase/smm-invoice.sql in the Supabase SQL Editor, then reload this page.";
  }
  return message;
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function SmmInvoice() {
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [form, setForm] = useState({
    client_id: "",
    invoice_date: localDateValue(),
    title: DEFAULT_SETTINGS.invoice_title,
    description: DEFAULT_SETTINGS.default_description,
    amount: "",
    information: DEFAULT_SETTINGS.default_information,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [clientResult, invoiceResult, settingsResult] = await Promise.all([
      supabase.from("smm_clients").select("id, name").eq("active", true).order("name"),
      supabase.from("smm_invoices").select("*").order("generated_at", { ascending: false }),
      supabase.from("smm_invoice_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    const loadError = clientResult.error || invoiceResult.error || settingsResult.error;
    if (loadError) {
      setError(setupError(loadError));
      setClients(clientResult.data || []);
      setInvoices(invoiceResult.data || []);
    } else {
      const nextSettings = { ...DEFAULT_SETTINGS, ...(settingsResult.data || {}) };
      setClients(clientResult.data || []);
      setInvoices(invoiceResult.data || []);
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const totalValue = useMemo(
    () => invoices.reduce((total, invoice) => total + Number(invoice.amount || 0), 0),
    [invoices],
  );

  const openGenerator = () => {
    setError("");
    setNotice("");
    setForm({
      client_id: clients[0]?.id || "",
      invoice_date: localDateValue(),
      title: settings.invoice_title,
      description: settings.default_description,
      amount: settings.default_amount ? String(settings.default_amount) : "",
      information: settings.default_information,
    });
    setGenerateOpen(true);
  };

  const openSettings = () => {
    setError("");
    setNotice("");
    setSettingsDraft({ ...settings });
    setSettingsOpen(true);
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      id: 1,
      invoice_title: settingsDraft.invoice_title.trim(),
      default_description: settingsDraft.default_description.trim(),
      default_amount: Number(settingsDraft.default_amount || 0),
      default_information: settingsDraft.default_information.trim(),
      payment_information: settingsDraft.payment_information.trim(),
      brand_name: settingsDraft.brand_name.trim(),
      updated_by: localStorage.getItem("employeeId") || null,
    };

    const { data, error: saveError } = await supabase
      .from("smm_invoice_settings")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (saveError) {
      setError(setupError(saveError));
    } else {
      const nextSettings = { ...DEFAULT_SETTINGS, ...data };
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      setSettingsOpen(false);
      setNotice("Invoice settings saved. New defaults will apply to future invoices.");
    }
    setSaving(false);
  };

  const generateInvoice = async (event) => {
    event.preventDefault();
    const client = clients.find((item) => item.id === form.client_id);
    const amount = Number(form.amount);

    if (!client || !form.invoice_date || !form.title.trim() || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Complete the client, date, title, description, and a valid price above zero.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      client_id: client.id,
      client_name: client.name,
      invoice_date: form.invoice_date,
      title: form.title.trim(),
      description: form.description.trim(),
      amount,
      information: form.information.trim(),
      payment_information: settings.payment_information,
      brand_name: settings.brand_name,
    };

    const { data, error: generateError } = await supabase
      .from("smm_invoices")
      .insert(payload)
      .select()
      .single();

    if (generateError) {
      setError(setupError(generateError));
    } else {
      setInvoices((current) => [data, ...current]);
      setGenerateOpen(false);
      setNotice(`${data.invoice_number} generated and ready to download.`);
    }
    setSaving(false);
  };

  const handlePreview = (invoice) => {
    const opened = previewSmmInvoicePdf(invoice);
    if (!opened) setError("The browser blocked the preview window. Allow pop-ups or use Download PDF.");
  };

  const deleteInvoice = async () => {
    if (!invoiceToDelete) return;

    setDeleting(true);
    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("smm_invoices")
      .delete()
      .eq("id", invoiceToDelete.id);

    if (deleteError) {
      setError(setupError(deleteError));
    } else {
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceToDelete.id));
      setNotice(`${invoiceToDelete.invoice_number} deleted.`);
      setInvoiceToDelete(null);
    }

    setDeleting(false);
  };

  return (
    <div className="invoice-page">
      <Sidebar activePage="smm-invoice" />

      <main className="invoice-main">
        <header className="invoice-page-header">
          <div>
            <span>Social Media Management</span>
            <h1>Invoice</h1>
            <p>Generate and keep consistent client invoice records.</p>
          </div>
          <div className="invoice-header-actions">
            <button type="button" className="invoice-settings-button" onClick={openSettings} aria-label="Open invoice settings">
              <SettingsIcon />
              <span>Settings</span>
            </button>
            <button type="button" className="invoice-primary-button" onClick={openGenerator} disabled={loading || !clients.length}>
              Generate Invoice
            </button>
          </div>
        </header>

        {error && <div className="invoice-alert error" role="alert">{error}</div>}
        {notice && <div className="invoice-alert success" role="status">{notice}</div>}

        <section className="invoice-summary" aria-label="Invoice summary">
          <div>
            <span>Total invoices</span>
            <strong>{invoices.length}</strong>
          </div>
          <div>
            <span>Invoice value</span>
            <strong>{formatInvoiceCurrency(totalValue)}</strong>
          </div>
          <div>
            <span>Active clients</span>
            <strong>{clients.length}</strong>
          </div>
        </section>

        <section className="invoice-content">
          <div className="invoice-content-header">
            <div>
              <h2>Generated invoices</h2>
              <p>Each record keeps its original details even when defaults change.</p>
            </div>
          </div>

          {loading ? (
            <div className="invoice-empty"><span>Loading invoice records...</span></div>
          ) : invoices.length === 0 ? (
            <div className="invoice-empty">
              <div className="invoice-document-mark"><span /><span /><span /></div>
              <h3>No invoices yet</h3>
              <p>Generate the first invoice after completing Settings.</p>
            </div>
          ) : (
            <>
              <div className="invoice-desktop-list">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Client</th>
                      <th>Invoice title</th>
                      <th>Amount</th>
                      <th>Generated at</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td><strong>{invoice.invoice_number}</strong><small>{formatInvoiceDate(invoice.invoice_date)}</small></td>
                        <td>{invoice.client_name}</td>
                        <td><strong>{invoice.title}</strong><small>{invoice.description}</small></td>
                        <td>{formatInvoiceCurrency(invoice.amount)}</td>
                        <td>{formatGeneratedAt(invoice.generated_at)} WIB</td>
                        <td>
                          <div className="invoice-row-actions">
                            <button type="button" onClick={() => handlePreview(invoice)}>Preview</button>
                            <button type="button" onClick={() => downloadSmmInvoicePdf(invoice)}>Download PDF</button>
                            <button type="button" className="invoice-delete-button" onClick={() => setInvoiceToDelete(invoice)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="invoice-mobile-list">
                {invoices.map((invoice) => (
                  <article key={invoice.id} className="invoice-mobile-card">
                    <div className="invoice-mobile-card-top">
                      <div><span>Invoice ID</span><strong>{invoice.invoice_number}</strong></div>
                      <strong>{formatInvoiceCurrency(invoice.amount)}</strong>
                    </div>
                    <dl>
                      <div><dt>Client</dt><dd>{invoice.client_name}</dd></div>
                      <div><dt>Invoice</dt><dd>{invoice.title}</dd></div>
                      <div><dt>Generated</dt><dd>{formatGeneratedAt(invoice.generated_at)} WIB</dd></div>
                    </dl>
                    <div className="invoice-row-actions">
                      <button type="button" onClick={() => handlePreview(invoice)}>Preview</button>
                      <button type="button" onClick={() => downloadSmmInvoicePdf(invoice)}>Download PDF</button>
                      <button type="button" className="invoice-delete-button" onClick={() => setInvoiceToDelete(invoice)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      {generateOpen && (
        <div className="invoice-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setGenerateOpen(false)}>
          <form className="invoice-modal" onSubmit={generateInvoice}>
            <header>
              <div><span>New document</span><h2>Generate Invoice</h2><p>Review the defaults before saving the final snapshot.</p></div>
              <button type="button" className="invoice-close" onClick={() => setGenerateOpen(false)} aria-label="Close">×</button>
            </header>
            <div className="invoice-form-body">
              <label className="invoice-field full"><span>Client</span><select value={form.client_id} onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))} required><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
              <label className="invoice-field full"><span>Invoice date</span><input type="date" value={form.invoice_date} onChange={(event) => setForm((current) => ({ ...current, invoice_date: event.target.value }))} required /></label>
              <label className="invoice-field full"><span>Invoice title</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></label>
              <label className="invoice-field full"><span>Description</span><input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required /></label>
              <label className="invoice-field"><span>Price (IDR)</span><input type="number" min="1" step="1" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="5500000" required /></label>
              <label className="invoice-field"><span>Information</span><input value={form.information} onChange={(event) => setForm((current) => ({ ...current, information: event.target.value }))} placeholder="Optional project detail" /></label>
            </div>
            <footer><button type="button" onClick={() => setGenerateOpen(false)}>Cancel</button><button type="submit" className="invoice-primary-button" disabled={saving}>{saving ? "Generating..." : "Generate Invoice"}</button></footer>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="invoice-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}>
          <form className="invoice-modal settings" onSubmit={saveSettings}>
            <header>
              <div><span>Default details</span><h2>Invoice Settings</h2><p>These values are copied into every new invoice and remain editable.</p></div>
              <button type="button" className="invoice-close" onClick={() => setSettingsOpen(false)} aria-label="Close">×</button>
            </header>
            <div className="invoice-form-body">
              <label className="invoice-field full"><span>Brand name</span><input value={settingsDraft.brand_name} onChange={(event) => setSettingsDraft((current) => ({ ...current, brand_name: event.target.value }))} required /></label>
              <label className="invoice-field full"><span>Default invoice title</span><input value={settingsDraft.invoice_title} onChange={(event) => setSettingsDraft((current) => ({ ...current, invoice_title: event.target.value }))} required /></label>
              <label className="invoice-field full"><span>Default description</span><input value={settingsDraft.default_description} onChange={(event) => setSettingsDraft((current) => ({ ...current, default_description: event.target.value }))} placeholder="Example: Product Photography" /></label>
              <label className="invoice-field"><span>Default price (IDR)</span><input type="number" min="0" step="1" value={settingsDraft.default_amount} onChange={(event) => setSettingsDraft((current) => ({ ...current, default_amount: event.target.value }))} /></label>
              <label className="invoice-field"><span>Default information</span><input value={settingsDraft.default_information} onChange={(event) => setSettingsDraft((current) => ({ ...current, default_information: event.target.value }))} placeholder="Optional project detail" /></label>
              <label className="invoice-field full"><span>Payment information</span><textarea rows="3" value={settingsDraft.payment_information} onChange={(event) => setSettingsDraft((current) => ({ ...current, payment_information: event.target.value }))} placeholder="Bank name, account number, and account holder" /></label>
            </div>
            <footer><button type="button" onClick={() => setSettingsOpen(false)}>Cancel</button><button type="submit" className="invoice-primary-button" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button></footer>
          </form>
        </div>
      )}

      {invoiceToDelete && (
        <div className="invoice-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !deleting && setInvoiceToDelete(null)}>
          <section className="invoice-modal invoice-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-invoice-title">
            <header>
              <div>
                <span>Permanent action</span>
                <h2 id="delete-invoice-title">Delete Invoice</h2>
                <p>This invoice record and its download entry will be removed.</p>
              </div>
              <button type="button" className="invoice-close" onClick={() => setInvoiceToDelete(null)} disabled={deleting} aria-label="Close">×</button>
            </header>
            <div className="invoice-delete-copy">
              Delete <strong>{invoiceToDelete.invoice_number}</strong> for <strong>{invoiceToDelete.client_name}</strong>? This action cannot be undone.
            </div>
            <footer>
              <button type="button" onClick={() => setInvoiceToDelete(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="invoice-delete-button" onClick={deleteInvoice} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Invoice"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default SmmInvoice;
