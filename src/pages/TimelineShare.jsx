import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import "./TimelineShare.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function displaySchedule(value) {
  if (!value) return "—";

  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function statusClass(status) {
  if (status === "Complete") return "is-complete";
  if (status === "In Progress") return "is-progress";
  return "is-not-started";
}

function hasPublicContent(item) {
  return Boolean(
    String(item?.content || "").trim() ||
      String(item?.materials || "").trim() ||
      String(item?.reference || "").trim() ||
      String(item?.notes || "").trim() ||
      (Array.isArray(item?.platforms) && item.platforms.length) ||
      (Array.isArray(item?.formats) && item.formats.length) ||
      item?.schedule_date
  );
}

function TimelineShare() {
  const { token } = useParams();

  const [timeline, setTimeline] = useState(null);
  const [client, setClient] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      setLoading(true);
      setError("");

      if (!token) {
        setError("Invalid preview link.");
        setLoading(false);
        return;
      }

      const { data: timelineData, error: timelineError } = await supabase
        .from("smm_timelines")
        .select("*")
        .eq("share_token", token)
        .maybeSingle();

      if (!active) return;

      if (timelineError) {
        setError(timelineError.message || "Unable to load preview.");
        setLoading(false);
        return;
      }

      if (!timelineData) {
        setError("This timeline preview is unavailable.");
        setLoading(false);
        return;
      }

      const [clientResult, itemsResult] = await Promise.all([
        supabase
          .from("smm_clients")
          .select("id,name")
          .eq("id", timelineData.client_id)
          .maybeSingle(),

        supabase
          .from("smm_timeline_items")
          .select("*")
          .eq("timeline_id", timelineData.id)
          .order("sort_order", { ascending: true }),
      ]);

      if (!active) return;

      if (clientResult.error) {
        setError(clientResult.error.message || "Unable to load client.");
        setLoading(false);
        return;
      }

      if (itemsResult.error) {
        setError(itemsResult.error.message || "Unable to load timeline content.");
        setLoading(false);
        return;
      }

      setTimeline(timelineData);
      setClient(clientResult.data || null);
      setItems(itemsResult.data || []);
      setLoading(false);
    };

    void loadPreview();

    return () => {
      active = false;
    };
  }, [token]);

  const publicItems = useMemo(
    () => items.filter(hasPublicContent),
    [items]
  );

  const completed = useMemo(
    () => publicItems.filter((item) => item.status === "Complete").length,
    [publicItems]
  );

  const progress = publicItems.length
    ? Math.round((completed / publicItems.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="timeline-share-page">
        <main className="timeline-share-state">
          <div className="timeline-share-spinner" />
          <span>Loading timeline...</span>
        </main>
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="timeline-share-page">
        <main className="timeline-share-state timeline-share-error">
          <span>PLUNO STUDIO</span>
          <h1>Preview unavailable</h1>
          <p>{error || "The requested timeline could not be found."}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="timeline-share-page">
      <main className="timeline-share-container">
        <header className="timeline-share-header">
          <div className="timeline-share-brand">
            <span>PLUNO STUDIO</span>
            <strong>SOCIAL MEDIA CONTENT TIMELINE</strong>
          </div>

          <div className="timeline-share-period">
            <span>PERIOD</span>
            <strong>
              {MONTHS[Number(timeline.month) - 1]} {timeline.year}
            </strong>
          </div>
        </header>

        <section className="timeline-share-hero">
          <div className="timeline-share-client">
            <span>CLIENT</span>
            <h1>{client?.name || "Client"}</h1>
            <p>
              {MONTHS[Number(timeline.month) - 1]} {timeline.year}
            </p>
          </div>

          <div className="timeline-share-progress">
            <div className="timeline-share-progress-top">
              <span>PROGRESS</span>
              <strong>{progress}%</strong>
            </div>

            <div className="timeline-share-progress-count">
              {completed} of {publicItems.length} content completed
            </div>

            <div className="timeline-share-progress-track">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section className="timeline-share-content">
          <div className="timeline-share-section-head">
            <div>
              <span>CONTENT PLAN</span>
              <h2>Monthly Timeline</h2>
            </div>

            <div className="timeline-share-count">
              {publicItems.length} content
            </div>
          </div>

          {publicItems.length === 0 ? (
            <div className="timeline-share-empty">
              No content has been added to this timeline.
            </div>
          ) : (
            <div className="timeline-share-table-wrap">
              <table className="timeline-share-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Content</th>
                    <th>Materials</th>
                    <th>Reference</th>
                    <th>Platform</th>
                    <th>Format</th>
                    <th>Status</th>
                    <th>Schedule</th>
                    <th>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {publicItems.map((item, index) => (
                    <tr key={item.id}>
                      <td data-label="No" className="timeline-share-number">
                        {index + 1}
                      </td>

                      <td data-label="Content">
                        <div className="timeline-share-main-text">
                          {item.content || "—"}
                        </div>
                      </td>

                      <td data-label="Materials">
                        {item.materials || "—"}
                      </td>

                      <td data-label="Reference">
                        {item.reference ? (
                          <a
                            href={item.reference}
                            target="_blank"
                            rel="noreferrer"
                            className="timeline-share-link"
                          >
                            Open reference
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td data-label="Platform">
                        <div className="timeline-share-tags">
                          {(item.platforms || []).length ? (
                            item.platforms.map((platform) => (
                              <span key={platform}>{platform}</span>
                            ))
                          ) : (
                            <span className="is-empty">—</span>
                          )}
                        </div>
                      </td>

                      <td data-label="Format">
                        <div className="timeline-share-tags">
                          {(item.formats || []).length ? (
                            item.formats.map((format) => (
                              <span key={format}>{format}</span>
                            ))
                          ) : (
                            <span className="is-empty">—</span>
                          )}
                        </div>
                      </td>

                      <td data-label="Status">
                        <span
                          className={`timeline-share-status ${statusClass(
                            item.status
                          )}`}
                        >
                          {item.status || "Not Started"}
                        </span>
                      </td>

                      <td data-label="Schedule">
                        <span className="timeline-share-date">
                          {displaySchedule(item.schedule_date)}
                        </span>
                      </td>

                      <td data-label="Notes">
                        {item.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="timeline-share-footer">
          <span>PLUNO STUDIO</span>
          <p>Social Media Content Timeline</p>
        </footer>
      </main>
    </div>
  );
}

export default TimelineShare;
