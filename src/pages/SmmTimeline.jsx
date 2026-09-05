import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Sidebar from "../components/Sidebar";
import { MonthPicker } from "../components/PeriodPicker";
import { supabase } from "../supabase";
import "./SmmTimeline.css";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const STATUSES = ["Not Started", "In Progress", "Complete"];
const PLATFORMS = ["Instagram", "TikTok", "Other"];
const FORMATS = ["Design", "Photo", "Video"];
const PAGE_SIZE = 9;
const EMPTY_ITEM = { content: "", materials: "", reference: "", platform: "Instagram", format: "Video", output: "Design", platforms: [], formats: [], status: "Not Started", schedule: null, schedule_date: null, notes: "" };

function timelineErrorMessage(error, fallback = "Unable to save timeline changes.") {
  if (error?.message?.includes("smm_timeline_items_platforms_check")) {
    return "The Other platform requires the included Supabase platform update before it can be saved.";
  }
  return error?.message || fallback;
}

function debounce(callback, delay) {
  let timer;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const argsToUse = lastArgs;
      lastArgs = null;
      callback(...argsToUse);
    }, delay);
  };
  wrapped.flush = () => {
    window.clearTimeout(timer);
    if (!lastArgs) return;
    const argsToUse = lastArgs;
    lastArgs = null;
    callback(...argsToUse);
  };
  return wrapped;
}

function MultiCheckbox({ options, value, onChange, label }) {
  const selected = (Array.isArray(value) ? value : []).slice().sort((a, b) => a.localeCompare(b));
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const toggle = (option) => {
    const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    onChange(next.sort((a, b) => a.localeCompare(b)));
  };

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = options.length * 34 + 12;
      setMenuStyle({
        left: Math.min(rect.left, window.innerWidth - 170),
        top: window.innerHeight - rect.bottom < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4,
        width: Math.max(rect.width, 160),
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeMenu = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [open]);

  return <div className="smm-multi-select">
    <button ref={buttonRef} type="button" className="smm-multi-trigger" aria-label={label} aria-expanded={open} onClick={toggleMenu}>
      <span className="smm-multi-tags">
        {selected.length ? <span className="smm-multi-value">{selected.join(", ")}</span> : <span className="placeholder">Select</span>}
      </span>
    </button>
    {open && createPortal(<div ref={menuRef} className="smm-multi-menu" style={menuStyle}>
      {options.map((option) => <label key={option}>
        <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
        <span>{option}</span>
      </label>)}
    </div>, document.body)}
  </div>;
}

function createShareToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replaceAll("-", "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

function SmmTimeline() {
  const now = new Date();
  const role = localStorage.getItem("employeeRole") || "Staff";
  const employeeId = localStorage.getItem("employeeId");
  const canManage = role === "Founder" || role === "Administrator";
  const [clients, setClients] = useState([]);
  const [timelines, setTimelines] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const periodRequestRef = useRef("");

  const selectedTimeline = timelines.find((timeline) => timeline.id === selectedId);
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    const [{ data: clientData, error: clientError }, { data: timelineData, error: timelineError }] = await Promise.all([
      supabase.from("smm_clients").select("*").eq("active", true).order("name"),
      supabase.from("smm_timelines").select("*").order("year", { ascending: false }).order("month", { ascending: false }),
    ]);
    if (clientError || timelineError) {
      setError((clientError || timelineError).message || "Gagal memuat timeline.");
      setClients([]);
      setTimelines([]);
    } else {
      setClients(clientData || []);
      setTimelines(timelineData || []);
      setSelectedClientId((current) => current || clientData?.[0]?.id || "");
    }
    setLoading(false);
  }, [setClients, setError, setLoading, setSelectedClientId, setTimelines]);

  const loadItems = useCallback(async (timelineId) => {
    if (!timelineId) {
      setItems([]);
      return;
    }
    const { data, error: loadError } = await supabase.from("smm_timeline_items").select("*").eq("timeline_id", timelineId).order("sort_order");
    if (loadError) {
      setError(loadError.message);
      return;
    }
    let rows = data || [];
    if (canManage && rows.length < PAGE_SIZE) {
      const placeholders = Array.from({ length: PAGE_SIZE - rows.length }, (_, index) => ({
        ...EMPTY_ITEM,
        timeline_id: timelineId,
        sort_order: rows.length + index + 1,
        created_by: employeeId,
      }));
      const { data: created, error: createError } = await supabase.from("smm_timeline_items").insert(placeholders).select();
      if (createError) setError(createError.message);
      else rows = [...rows, ...(created || [])];
    }
    setItems(rows);
    setPage(1);
  }, [canManage, employeeId, setError, setItems, setPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBase(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBase]);

  useEffect(() => {
    if (!selectedClientId || loading) return undefined;
    const requestKey = `${selectedClientId}-${selectedYear}-${selectedMonth}`;
    if (periodRequestRef.current === requestKey) return undefined;

    const timer = window.setTimeout(async () => {
      periodRequestRef.current = requestKey;
      setPeriodLoading(true);
      setError("");
      const existing = timelines.find((timeline) => timeline.client_id === selectedClientId && Number(timeline.month) === Number(selectedMonth) && Number(timeline.year) === Number(selectedYear));
      if (existing) {
        setSelectedId(existing.id);
        setPeriodLoading(false);
        return;
      }
      if (!canManage) {
        setSelectedId("");
        setItems([]);
        setPeriodLoading(false);
        return;
      }
      const { data, error: createError } = await supabase.from("smm_timelines").insert({ client_id: selectedClientId, month: Number(selectedMonth), year: Number(selectedYear), status: "Draft", created_by: employeeId }).select().single();
      if (createError) {
        setError(createError.message);
        setSelectedId("");
      } else {
        setTimelines((current) => [data, ...current]);
        setSelectedId(data.id);
        setItems([]);
      }
      setPeriodLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canManage, employeeId, loading, selectedClientId, selectedMonth, selectedYear, timelines]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadItems(selectedId); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadItems, selectedId]);

  const saveItem = useRef(null);
  const pendingItemChanges = useRef(new Map());
  useEffect(() => {
    saveItem.current = debounce(async () => {
      const pending = Array.from(pendingItemChanges.current.entries());
      pendingItemChanges.current.clear();
      if (!pending.length) return;
      setSaveState("Saving...");
      const results = await Promise.all(pending.map(([id, changes]) => supabase.from("smm_timeline_items").update(changes).eq("id", id)));
      const saveError = results.find((result) => result.error)?.error;
      if (saveError) {
        setError(timelineErrorMessage(saveError));
        setSaveState("Save failed");
      } else setSaveState("Saved");
    }, 650);
    return () => saveItem.current?.flush();
  }, []);

  const updateItem = (id, field, value) => {
    if (!canManage && field !== "status") return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    const currentChanges = pendingItemChanges.current.get(id) || {};
    pendingItemChanges.current.set(id, { ...currentChanges, [field]: value });
    saveItem.current?.();
  };

  const updateItemAndSave = (id, field, value) => {
    updateItem(id, field, value);
    saveItem.current?.flush();
  };

  const addItem = async () => {
    if (!selectedId || !canManage) return;
    setSaving(true);
    setError("");
    const { data, error: insertError } = await supabase.from("smm_timeline_items").insert({ ...EMPTY_ITEM, timeline_id: selectedId, sort_order: items.length + 1, created_by: employeeId }).select().single();
    if (insertError) setError(timelineErrorMessage(insertError, "Unable to add content."));
    else {
      setItems((current) => [...current, data]);
      setPage(Math.ceil((items.length + 1) / PAGE_SIZE));
    }
    setSaving(false);
  };

  const duplicateItem = async (item) => {
    const { id, created_at, updated_at, ...copy } = item;
    void id; void created_at; void updated_at;
    const { data, error: copyError } = await supabase.from("smm_timeline_items").insert({ ...copy, schedule: null, schedule_date: copy.schedule_date || null, sort_order: items.length + 1, created_by: employeeId }).select().single();
    if (copyError) setError(timelineErrorMessage(copyError, "Unable to duplicate content."));
    else setItems((current) => [...current, data]);
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Hapus kolom konten “${item.content || "tanpa judul"}”?`)) return;
    pendingItemChanges.current.delete(item.id);
    const { error: deleteError } = await supabase.from("smm_timeline_items").delete().eq("id", item.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    const remaining = items.filter((row) => row.id !== item.id);
    if (remaining.length < PAGE_SIZE) {
      const nextSortOrder = Math.max(0, ...remaining.map((row) => Number(row.sort_order || 0))) + 1;
      const { data: replacement, error: replacementError } = await supabase.from("smm_timeline_items").insert({ ...EMPTY_ITEM, timeline_id: selectedId, sort_order: nextSortOrder, created_by: employeeId }).select().single();
      if (replacementError) setError(replacementError.message);
      else remaining.push(replacement);
    }
    setItems(remaining);
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(remaining.length / PAGE_SIZE))));
  };

  const moveItem = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((item, position) => { item.sort_order = position + 1; });
    setItems(next);
    await Promise.all(next.map((item) => supabase.from("smm_timeline_items").update({ sort_order: item.sort_order }).eq("id", item.id)));
    setSaveState("Saved");
  };

  const createClient = async (event) => {
    event.preventDefault();
    const name = clientName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const { data: client, error: clientError } = await supabase.from("smm_clients").insert({ name, created_by: employeeId }).select().single();
    if (clientError) {
      setError(clientError.message);
      setSaving(false);
      return;
    }
    const { data: timeline, error: timelineError } = await supabase.from("smm_timelines").insert({ client_id: client.id, month: now.getMonth() + 1, year: now.getFullYear(), status: "Draft", created_by: employeeId }).select().single();
    if (timelineError) setError(timelineError.message);
    else {
      setClients((current) => [...current, client].sort((a, b) => a.name.localeCompare(b.name)));
      setTimelines((current) => [timeline, ...current]);
      setSelectedClientId(client.id);
      setSelectedMonth(now.getMonth() + 1);
      setSelectedYear(now.getFullYear());
      setSelectedId(timeline.id);
      periodRequestRef.current = `${client.id}-${now.getFullYear()}-${now.getMonth() + 1}`;
      setClientName("");
      setClientModalOpen(false);
      setNotice("Client dan timeline bulan berjalan berhasil dibuat.");
    }
    setSaving(false);
  };

  const deleteClient = async () => {
    if (!canManage || !selectedClient) return;
    const confirmed = window.confirm(`Delete ${selectedClient.name} from active clients? Existing timeline data will be preserved.`);
    if (!confirmed) return;
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase.from("smm_clients").update({ active: false }).eq("id", selectedClient.id);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    const remainingClients = clients.filter((client) => client.id !== selectedClient.id);
    setClients(remainingClients);
    setSelectedClientId(remainingClients[0]?.id || "");
    setSelectedId("");
    setItems([]);
    setPage(1);
    periodRequestRef.current = "";
    setNotice("Client removed from active clients. Existing timeline data was preserved.");
    setSaving(false);
  };

  const shareTimeline = async () => {
    if (!selectedTimeline || !canManage) return;
    setSaving(true);
    setError("");
    const token = selectedTimeline.share_token || createShareToken();
    if (!selectedTimeline.share_token) {
      const { error: shareError } = await supabase.from("smm_timelines").update({ share_token: token, shared_at: new Date().toISOString() }).eq("id", selectedTimeline.id);
      if (shareError) {
        setError(shareError.message);
        setSaving(false);
        return;
      }
      setTimelines((current) => current.map((timeline) => timeline.id === selectedTimeline.id ? { ...timeline, share_token: token } : timeline));
    }
    const url = `${window.location.origin}/timeline/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Preview link copied.");
    } catch {
      window.prompt("Salin link preview berikut:", url);
    }
    setSaving(false);
  };

  const filteredItems = useMemo(() => items.filter((item) => statusFilter === "All" || item.status === statusFilter), [items, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const completed = items.filter((item) => item.status === "Complete").length;
  const progressPercent = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div className="smm-page">
      <Sidebar activePage="smm-timeline" />
      <main className="smm-main">
        <div className="smm-section-heading">
          <div>
            <div className="smm-section-label">PLUNO STUDIO / SOCIAL MEDIA MANAGEMENT</div>
            <h2>Content Timeline</h2>
          </div>
          <div className="smm-period-filter">
            <select value={selectedClientId} onChange={(event) => { periodRequestRef.current = ""; setSelectedClientId(event.target.value); }} aria-label="Client">
              <option value="">Select client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <MonthPicker
              year={selectedYear}
              month={selectedMonth}
              ariaLabel="Timeline month and year"
              onChange={({ year, month }) => {
                periodRequestRef.current = "";
                setSelectedYear(year);
                setSelectedMonth(month);
              }}
            />
          </div>
        </div>

        <div className="smm-action-bar">
          <div className="smm-action-copy">
            <span>MONTHLY TIMELINE</span>
            <strong>{selectedClient ? `${selectedClient.name} · ${MONTHS[selectedMonth - 1]} ${selectedYear}` : "Select or add a client"}</strong>
          </div>
          <div className="smm-header-actions">
            {selectedTimeline && canManage && <button className="smm-secondary-button" onClick={shareTimeline} disabled={saving}>Share</button>}
            {selectedClient && canManage && <button className="smm-delete-client" onClick={deleteClient} disabled={saving}>Delete Client</button>}
            {canManage && <button className="smm-primary-button" onClick={() => setClientModalOpen(true)}>Add Client</button>}
          </div>
        </div>

        {error && <div className="smm-message error" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
        {notice && <div className="smm-message success" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}

        {loading || periodLoading ? <div className="smm-empty">Loading timeline...</div> : !selectedClient ? <div className="smm-empty"><strong>No client yet</strong><span>Add a client to create this month's timeline.</span></div> : !selectedTimeline ? <div className="smm-empty"><strong>No timeline available</strong><span>A timeline has not been created for this period.</span></div> : (
          <>
            <section className="smm-summary">
              <div><span>CLIENT</span><strong>{selectedClient.name}</strong></div>
              <div className="smm-progress-card">
                <span>PROGRESS</span>
                <div className="smm-progress-copy"><strong>{progressPercent}%</strong><small>{completed} of {items.length} complete</small></div>
                <div className="smm-progress-track" role="progressbar" aria-label="Timeline completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}>
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </section>

            <section className="smm-table-card">
              <div className="smm-table-tools">
                <div>
                  <select aria-label="Filter by progress" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="All">All statuses</option>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
                </div>
                <span className="smm-save-state">{saveState}</span>
                {canManage && <button className="smm-primary-button" onClick={addItem} disabled={saving}>+ Add Content</button>}
              </div>
              <div className="smm-table-wrap">
                <table>
                  <thead><tr><th>No</th><th>Content</th><th>Materials</th><th>Reference</th><th>Platform</th><th>Format</th><th>Status</th><th>Schedule</th>{canManage && <th>Actions</th>}</tr></thead>
                  <tbody>
                    {visibleItems.length === 0 ? <tr><td colSpan={canManage ? 9 : 8} className="smm-no-rows">No content found.</td></tr> : visibleItems.map((item) => {
                      const absoluteIndex = items.findIndex((row) => row.id === item.id);
                      return <tr key={item.id}>
                        <td data-label="No">{absoluteIndex + 1}</td>
                        <td data-label="Content"><textarea value={item.content || ""} disabled={!canManage} onChange={(event) => updateItem(item.id, "content", event.target.value)} onBlur={() => saveItem.current?.flush()} /></td>
                        <td data-label="Materials"><textarea value={item.materials || ""} disabled={!canManage} onChange={(event) => updateItem(item.id, "materials", event.target.value)} onBlur={() => saveItem.current?.flush()} /></td>
                        <td data-label="Reference"><input type="url" value={item.reference || ""} disabled={!canManage} placeholder="https://" onChange={(event) => updateItem(item.id, "reference", event.target.value)} onBlur={() => saveItem.current?.flush()} />{item.reference && <a href={item.reference} target="_blank" rel="noreferrer">Open</a>}</td>
                        <td data-label="Platform"><MultiCheckbox label="Platform" options={PLATFORMS} value={item.platforms} onChange={(value) => updateItemAndSave(item.id, "platforms", value)} /></td>
                        <td data-label="Format"><MultiCheckbox label="Format" options={FORMATS} value={item.formats} onChange={(value) => updateItemAndSave(item.id, "formats", value)} /></td>
                        <td data-label="Status"><select className="smm-status" value={item.status} onChange={(event) => updateItemAndSave(item.id, "status", event.target.value)}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></td>
                        <td data-label="Schedule"><input type="date" value={item.schedule_date || ""} onChange={(event) => updateItemAndSave(item.id, "schedule_date", event.target.value || null)} /></td>
                        {canManage && <td data-label="Actions"><div className="smm-row-actions"><button title="Move up" disabled={absoluteIndex === 0} onClick={() => moveItem(absoluteIndex, -1)}>↑</button><button title="Move down" disabled={absoluteIndex === items.length - 1} onClick={() => moveItem(absoluteIndex, 1)}>↓</button><button title="Duplicate" onClick={() => duplicateItem(item)}>+</button><button className="danger" title="Delete" onClick={() => deleteItem(item)}>×</button></div></td>}
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && <div className="smm-pagination">
                <button type="button" aria-label="Previous content page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>←</button>
                <span>{page} / {totalPages}</span>
                <button type="button" aria-label="Next content page" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>→</button>
              </div>}
            </section>
          </>
        )}
        <footer className="smm-footer">PLUNO STUDIO · INTERNAL PORTAL <span>{role}</span></footer>
      </main>

      {clientModalOpen && <div className="smm-overlay" onMouseDown={(event) => event.target === event.currentTarget && setClientModalOpen(false)}>
        <form className="smm-modal" onSubmit={createClient}>
          <header><div><span>CLIENT MANAGEMENT</span><h2>Add Client</h2></div><button type="button" onClick={() => setClientModalOpen(false)}>×</button></header>
          <label>Client Name<input autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} required placeholder="Company or brand name" /></label>
          <footer><button type="button" className="smm-secondary-button" onClick={() => setClientModalOpen(false)}>Cancel</button><button className="smm-primary-button" disabled={saving}>Add Client</button></footer>
        </form>
      </div>}
    </div>
  );
}

export default SmmTimeline;
