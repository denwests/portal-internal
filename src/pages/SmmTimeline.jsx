import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabase";
import "./SmmTimeline.css";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const STATUSES = ["Idea", "Waiting Material", "Production", "Editing", "Internal Review", "Client Review", "Revision", "Approved", "Scheduled", "Published"];
const PLATFORMS = ["Instagram", "TikTok", "Threads", "Facebook", "Other"];
const FORMATS = ["Feed", "Reels", "Story", "Carousel", "Video", "Other"];
const OUTPUTS = ["Photo", "Video", "Design", "Copywriting", "Mixed"];
const EMPTY_ITEM = { content: "", materials: "", reference: "", platform: "Instagram", format: "Feed", output: "Design", status: "Idea", schedule: "", notes: "" };
const EMPTY_TIMELINE = { client_id: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), pic_name: "", status: "Draft", general_notes: "" };

function debounce(callback, delay) {
  let timer;
  const wrapped = (...args) => { window.clearTimeout(timer); timer = window.setTimeout(() => callback(...args), delay); };
  wrapped.cancel = () => window.clearTimeout(timer);
  return wrapped;
}

function safeFileName(value) {
  return String(value || "timeline").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
}

function displaySchedule(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function SmmTimeline() {
  const role = localStorage.getItem("employeeRole") || "Staff";
  const employeeId = localStorage.getItem("employeeId");
  const canManage = role === "Founder" || role === "Administrator";
  const [clients, setClients] = useState([]);
  const [timelines, setTimelines] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [dialog, setDialog] = useState(null);
  const [timelineForm, setTimelineForm] = useState(EMPTY_TIMELINE);
  const [clientName, setClientName] = useState("");

  const selectedTimeline = timelines.find((timeline) => timeline.id === selectedId);
  const selectedClient = clients.find((client) => client.id === selectedTimeline?.client_id);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    const [{ data: clientData, error: clientError }, { data: timelineData, error: timelineError }] = await Promise.all([
      supabase.from("smm_clients").select("*").order("name"),
      supabase.from("smm_timelines").select("*").order("year", { ascending: false }).order("month", { ascending: false }),
    ]);
    if (clientError || timelineError) {
      setError((clientError || timelineError).message || "Gagal memuat timeline.");
      setClients([]); setTimelines([]);
    } else {
      setClients(clientData || []); setTimelines(timelineData || []);
      setSelectedId((current) => current || timelineData?.[0]?.id || "");
    }
    setLoading(false);
  }, []);

  const loadItems = useCallback(async (timelineId) => {
    if (!timelineId) { setItems([]); return; }
    const { data, error: loadError } = await supabase.from("smm_timeline_items").select("*").eq("timeline_id", timelineId).order("sort_order");
    if (loadError) setError(loadError.message);
    else setItems(data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBase(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBase]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadItems(selectedId); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadItems, selectedId]);

  const saveItem = useRef(null);
  useEffect(() => {
    saveItem.current = debounce(async (id, changes) => {
      setSaveState("Saving...");
      const allowedChanges = canManage ? changes : { status: changes.status };
      const { error: saveError } = await supabase.from("smm_timeline_items").update(allowedChanges).eq("id", id);
      if (saveError) { setError(saveError.message); setSaveState("Save failed"); }
      else setSaveState("Saved");
    }, 650);
    return () => saveItem.current?.cancel();
  }, [canManage]);

  const updateItem = (id, field, value) => {
    if (!canManage && field !== "status") return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    saveItem.current?.(id, { [field]: value });
  };

  const addItem = async () => {
    if (!selectedId || !canManage) return;
    setSaving(true); setError("");
    const { data, error: insertError } = await supabase.from("smm_timeline_items").insert({ ...EMPTY_ITEM, timeline_id: selectedId, sort_order: items.length + 1, created_by: employeeId }).select().single();
    if (insertError) setError(insertError.message); else setItems((current) => [...current, data]);
    setSaving(false);
  };

  const duplicateItem = async (item) => {
    const { id, created_at, updated_at, ...copy } = item;
    void id; void created_at; void updated_at;
    const { data, error: copyError } = await supabase.from("smm_timeline_items").insert({ ...copy, sort_order: items.length + 1, created_by: employeeId }).select().single();
    if (copyError) setError(copyError.message); else setItems((current) => [...current, data]);
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Hapus konten “${item.content || "tanpa judul"}”?`)) return;
    const { error: deleteError } = await supabase.from("smm_timeline_items").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message); else setItems((current) => current.filter((row) => row.id !== item.id));
  };

  const moveItem = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]];
    next.forEach((item, position) => { item.sort_order = position + 1; });
    setItems(next);
    await Promise.all(next.map((item) => supabase.from("smm_timeline_items").update({ sort_order: item.sort_order }).eq("id", item.id)));
    setSaveState("Saved");
  };

  const createClient = async (event) => {
    event.preventDefault();
    const name = clientName.trim(); if (!name) return;
    setSaving(true);
    const { data, error: createError } = await supabase.from("smm_clients").insert({ name, created_by: employeeId }).select().single();
    if (createError) setError(createError.message); else { setClients((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name))); setTimelineForm((current) => ({ ...current, client_id: data.id })); setClientName(""); setDialog("timeline"); }
    setSaving(false);
  };

  const createTimeline = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    const payload = { ...timelineForm, month: Number(timelineForm.month), year: Number(timelineForm.year), pic_name: timelineForm.pic_name.trim() || null, general_notes: timelineForm.general_notes.trim() || null, created_by: employeeId };
    const { data, error: createError } = await supabase.from("smm_timelines").insert(payload).select().single();
    if (createError) setError(createError.message); else { setTimelines((current) => [data, ...current]); setSelectedId(data.id); setDialog(null); setTimelineForm(EMPTY_TIMELINE); }
    setSaving(false);
  };

  const duplicatePrevious = async () => {
    if (!selectedTimeline || !canManage) return;
    const nextMonth = selectedTimeline.month === 12 ? 1 : selectedTimeline.month + 1;
    const nextYear = selectedTimeline.month === 12 ? selectedTimeline.year + 1 : selectedTimeline.year;
    setSaving(true); setError("");
    const { data: newTimeline, error: timelineError } = await supabase.from("smm_timelines").insert({ client_id: selectedTimeline.client_id, month: nextMonth, year: nextYear, pic_name: selectedTimeline.pic_name, status: "Draft", general_notes: selectedTimeline.general_notes, created_by: employeeId }).select().single();
    if (timelineError) { setError(timelineError.message); setSaving(false); return; }
    if (items.length) {
      const copies = items.map(({ content, materials, reference, platform, format, output, notes, sort_order }) => ({ timeline_id: newTimeline.id, content, materials, reference, platform, format, output, notes, sort_order, status: "Idea", schedule: null, created_by: employeeId }));
      const { error: itemsError } = await supabase.from("smm_timeline_items").insert(copies);
      if (itemsError) setError(itemsError.message);
    }
    setTimelines((current) => [newTimeline, ...current]); setSelectedId(newTimeline.id); setSaving(false);
  };

  const updateTimelineStatus = async (value) => {
    if (!canManage || !selectedTimeline) return;
    setTimelines((current) => current.map((timeline) => timeline.id === selectedId ? { ...timeline, status: value } : timeline));
    const { error: statusError } = await supabase.from("smm_timelines").update({ status: value }).eq("id", selectedId);
    if (statusError) setError(statusError.message);
  };

  const filteredItems = useMemo(() => items.filter((item) => (statusFilter === "All" || item.status === statusFilter) && (platformFilter === "All" || item.platform === platformFilter)), [items, statusFilter, platformFilter]);
  const completed = items.filter((item) => item.status === "Published").length;

  const exportPdf = (internal) => {
    if (!selectedTimeline) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("PLUNO STUDIO", 14, 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100); doc.text(internal ? "INTERNAL CONTENT TIMELINE" : "CONTENT TIMELINE", 14, 21);
    doc.setTextColor(20); doc.setFontSize(11); doc.text(`${selectedClient?.name || "Client"} — ${MONTHS[selectedTimeline.month - 1]} ${selectedTimeline.year}`, 14, 30);
    doc.setFontSize(8); doc.setTextColor(90); doc.text(`PIC: ${selectedTimeline.pic_name || "-"}   |   Status: ${selectedTimeline.status}   |   Progress: ${completed}/${items.length} published`, 14, 36);
    const headers = internal ? [["No", "Content", "Materials", "Reference", "Platform", "Format", "Output", "Status", "Schedule", "Notes"]] : [["No", "Content", "Platform", "Format", "Output", "Status", "Schedule"]];
    const body = items.map((item, index) => internal ? [index + 1, item.content, item.materials, item.reference, item.platform, item.format, item.output, item.status, displaySchedule(item.schedule), item.notes] : [index + 1, item.content, item.platform, item.format, item.output, item.status, displaySchedule(item.schedule)]);
    autoTable(doc, { head: headers, body, startY: 42, theme: "grid", styles: { fontSize: 6.5, cellPadding: 2, textColor: 35, lineColor: 210, lineWidth: 0.15 }, headStyles: { fillColor: [24, 24, 24], textColor: 245, fontStyle: "bold" }, alternateRowStyles: { fillColor: [247, 247, 247] }, margin: { left: 14, right: 14 } });
    doc.setFontSize(6.5); doc.setTextColor(120); doc.text(`Generated ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, 14, 202);
    doc.save(`${safeFileName(selectedClient?.name)}-${MONTHS[selectedTimeline.month - 1]}-${selectedTimeline.year}-${internal ? "internal" : "client"}.pdf`);
  };

  return <div className="smm-page"><Sidebar activePage="smm-timeline" /><main className="smm-main">
    <header className="smm-header"><div><p>PLUNO STUDIO / SOCIAL MEDIA MANAGEMENT</p><h1>Content Timeline</h1></div>{canManage && <div className="smm-header-actions"><button className="secondary" onClick={() => setDialog("client")}>New Client</button><button onClick={() => { setTimelineForm({ ...EMPTY_TIMELINE, client_id: clients[0]?.id || "" }); setDialog("timeline"); }}>New Timeline</button></div>}</header>
    {error && <div className="smm-message error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
    <section className="smm-toolbar">
      <label>Timeline<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select timeline</option>{timelines.map((timeline) => <option key={timeline.id} value={timeline.id}>{clients.find((client) => client.id === timeline.client_id)?.name || "Client"} — {MONTHS[timeline.month - 1]} {timeline.year}</option>)}</select></label>
      {selectedTimeline && <><label>Status<select value={selectedTimeline.status} disabled={!canManage} onChange={(event) => updateTimelineStatus(event.target.value)}>{["Draft", "Active", "Completed"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="secondary" disabled={saving || !canManage} onClick={duplicatePrevious}>Duplicate to Next Month</button><div className="smm-export"><button className="secondary" onClick={() => exportPdf(false)}>Client PDF</button>{canManage && <button className="secondary" onClick={() => exportPdf(true)}>Internal PDF</button>}</div></>}
    </section>
    {loading ? <div className="smm-empty">Loading timeline...</div> : !selectedTimeline ? <div className="smm-empty"><strong>No timeline selected</strong><span>{canManage ? "Create a client and monthly timeline to get started." : "No timeline is available yet."}</span></div> : <>
      <section className="smm-summary"><div><span>CLIENT</span><strong>{selectedClient?.name || "-"}</strong></div><div><span>PERIOD</span><strong>{MONTHS[selectedTimeline.month - 1]} {selectedTimeline.year}</strong></div><div><span>PIC</span><strong>{selectedTimeline.pic_name || "-"}</strong></div><div><span>PROGRESS</span><strong>{completed} / {items.length}</strong><small>{items.length ? Math.round((completed / items.length) * 100) : 0}% published</small></div></section>
      <section className="smm-table-card"><div className="smm-table-tools"><div><select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}><option>All</option>{PLATFORMS.map((value) => <option key={value}>{value}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></div><span className="smm-save-state">{saveState}</span>{canManage && <button onClick={addItem} disabled={saving}>+ Add Content</button>}</div>
      <div className="smm-table-wrap"><table><thead><tr><th>No</th><th>Content</th><th>Materials</th><th>Reference</th><th>Platform</th><th>Format</th><th>Output</th><th>Status</th><th>Schedule</th><th>Notes</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{filteredItems.length === 0 ? <tr><td colSpan={canManage ? 11 : 10} className="smm-no-rows">No content found.</td></tr> : filteredItems.map((item) => { const absoluteIndex = items.findIndex((row) => row.id === item.id); return <tr key={item.id}><td>{absoluteIndex + 1}</td>{["content", "materials"].map((field) => <td key={field}><textarea value={item[field] || ""} disabled={!canManage} onChange={(event) => updateItem(item.id, field, event.target.value)} /></td>)}<td><input type="url" value={item.reference || ""} disabled={!canManage} placeholder="https://" onChange={(event) => updateItem(item.id, "reference", event.target.value)} />{item.reference && <a href={item.reference} target="_blank" rel="noreferrer">Open</a>}</td>{[["platform", PLATFORMS], ["format", FORMATS], ["output", OUTPUTS], ["status", STATUSES]].map(([field, options]) => <td key={field}><select className={field === "status" ? `status-${String(item.status).toLowerCase().replaceAll(" ", "-")}` : ""} value={item[field] || options[0]} disabled={!canManage && field !== "status"} onChange={(event) => updateItem(item.id, field, event.target.value)}>{options.map((value) => <option key={value}>{value}</option>)}</select></td>)}<td><input type="datetime-local" value={item.schedule ? item.schedule.slice(0, 16) : ""} disabled={!canManage} onChange={(event) => updateItem(item.id, "schedule", event.target.value ? new Date(event.target.value).toISOString() : null)} /></td><td><textarea value={item.notes || ""} disabled={!canManage} onChange={(event) => updateItem(item.id, "notes", event.target.value)} /></td>{canManage && <td><div className="smm-row-actions"><button title="Move up" disabled={absoluteIndex === 0} onClick={() => moveItem(absoluteIndex, -1)}>↑</button><button title="Move down" disabled={absoluteIndex === items.length - 1} onClick={() => moveItem(absoluteIndex, 1)}>↓</button><button title="Duplicate" onClick={() => duplicateItem(item)}>+</button><button className="danger" title="Delete" onClick={() => deleteItem(item)}>×</button></div></td>}</tr>; })}</tbody></table></div></section>
    </>}
    <footer className="smm-footer">PLUNO STUDIO · INTERNAL PORTAL <span>{role}</span></footer>
  </main>
  {dialog === "client" && <div className="smm-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}><form className="smm-modal" onSubmit={createClient}><header><div><span>CLIENT MANAGEMENT</span><h2>New SMM Client</h2></div><button type="button" onClick={() => setDialog(null)}>×</button></header><label>Client Name<input autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} required placeholder="Company or brand name" /></label><footer><button type="button" className="secondary" onClick={() => setDialog(null)}>Cancel</button><button disabled={saving}>Save Client</button></footer></form></div>}
  {dialog === "timeline" && <div className="smm-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}><form className="smm-modal" onSubmit={createTimeline}><header><div><span>MONTHLY WORKSPACE</span><h2>New Timeline</h2></div><button type="button" onClick={() => setDialog(null)}>×</button></header><div className="smm-form-grid"><label>Client<select value={timelineForm.client_id} onChange={(event) => setTimelineForm({ ...timelineForm, client_id: event.target.value })} required><option value="">Select client</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label>PIC<input value={timelineForm.pic_name} onChange={(event) => setTimelineForm({ ...timelineForm, pic_name: event.target.value })} placeholder="Internal staff" /></label><label>Month<select value={timelineForm.month} onChange={(event) => setTimelineForm({ ...timelineForm, month: event.target.value })}>{MONTHS.map((month, index) => <option value={index + 1} key={month}>{month}</option>)}</select></label><label>Year<input type="number" min="2020" max="2100" value={timelineForm.year} onChange={(event) => setTimelineForm({ ...timelineForm, year: event.target.value })} required /></label><label className="wide">General Notes<textarea value={timelineForm.general_notes} onChange={(event) => setTimelineForm({ ...timelineForm, general_notes: event.target.value })} /></label></div><footer><button type="button" className="secondary" onClick={() => setDialog(null)}>Cancel</button><button disabled={saving || !clients.length}>Create Timeline</button></footer></form></div>}
  </div>;
}

export default SmmTimeline;
