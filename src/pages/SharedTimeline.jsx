import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import "./SharedTimeline.css";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatSchedule(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function SharedTimeline() {
  const { token } = useParams();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data, error: loadError } = await supabase.rpc("get_shared_smm_timeline", { p_token: token });
      if (loadError) setError(loadError.message);
      else if (!data) setError("Timeline tidak ditemukan atau link sudah tidak aktif.");
      else setTimeline(data);
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token]);

  return <main className="shared-timeline-page">
    <header><div className="shared-brand">PLUNO STUDIO</div><div className="shared-label">SOCIAL MEDIA CONTENT TIMELINE</div></header>
    {loading ? <div className="shared-state">Loading timeline...</div> : error ? <div className="shared-state error">{error}</div> : <>
      <section className="shared-heading"><div><span>CLIENT</span><h1>{timeline.client_name}</h1></div><div><span>PERIOD</span><strong>{MONTHS[Number(timeline.month) - 1]} {timeline.year}</strong></div><div><span>STATUS</span><strong>{timeline.status}</strong></div></section>
      <div className="shared-table-wrap"><table><thead><tr><th>No</th><th>Content</th><th>Materials</th><th>Reference</th><th>Platform</th><th>Format</th><th>Status</th><th>Schedule</th><th>Notes</th></tr></thead><tbody>{(timeline.items || []).map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.content || "-"}</td><td>{item.materials || "-"}</td><td>{item.reference ? <a href={item.reference} target="_blank" rel="noreferrer">Open reference</a> : "-"}</td><td>{(item.platforms || []).join(", ") || "-"}</td><td>{(item.formats || []).join(", ") || "-"}</td><td><span className="shared-status">{item.status}</span></td><td>{formatSchedule(item.schedule_date)}</td><td>{item.notes || "-"}</td></tr>)}{!timeline.items?.length && <tr><td colSpan="9" className="shared-empty-row">Belum ada konten.</td></tr>}</tbody></table></div>
    </>}
    <footer>PLUNO STUDIO · TIMELINE PREVIEW</footer>
  </main>;
}

export default SharedTimeline;
