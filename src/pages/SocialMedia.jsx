import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  getSocialComments,
  getSocialSummary,
  isSocialApiConfigured,
  replyToSocialComment,
  syncSocialComments,
  updateSocialCommentStatus,
} from "../lib/socialApi";
import "./SocialMedia.css";

const PLATFORM_META = {
  instagram: { label: "Instagram", short: "IG" },
  threads: { label: "Threads", short: "TH" },
  tiktok: { label: "TikTok", short: "TT" },
};

const PLATFORM_FILTERS = ["all", "instagram", "tiktok", "threads"];

const STATUS_OPTIONS = [
  { value: "need_reply", label: "Need Reply" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "resolved", label: "Resolved" },
  { value: "spam", label: "Spam" },
  { value: "all", label: "All Status" },
];

const REPLY_LIMITS = {
  instagram: 2200,
  threads: 500,
  tiktok: 1200,
};

const EMPTY_SUMMARY = {
  total: 0,
  need_reply: 0,
  instagram: 0,
  tiktok: 0,
  threads: 0,
};

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function makeIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function SocialMedia() {
  const configured = isSocialApiConfigured();
  const [comments, setComments] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [integrations, setIntegrations] = useState([]);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("need_reply");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [selectedComment, setSelectedComment] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const replyLimit = selectedComment
    ? REPLY_LIMITS[selectedComment.platform] || 500
    : 500;

  const integrationMap = useMemo(
    () =>
      Object.fromEntries(
        integrations.map((integration) => [integration.platform, integration])
      ),
    [integrations]
  );

  const loadSummary = useCallback(async () => {
    if (!configured) return;

    const data = await getSocialSummary();
    setSummary({ ...EMPTY_SUMMARY, ...(data.counts || {}) });
    setIntegrations(data.integrations || []);
    setLastSyncAt(data.last_sync_at || null);
  }, [configured]);

  const loadComments = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const data = await getSocialComments({
        platform,
        status,
        search,
        page,
        limit: pageSize,
      });

      setComments(data.comments || []);
      setTotal(Number(data.total || 0));
    } catch (error) {
      setComments([]);
      setTotal(0);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [configured, page, platform, search, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadComments();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadComments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadSummary().catch((error) => {
        setErrorMessage(error.message);
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSummary]);

  const announceInboxUpdate = () => {
    window.dispatchEvent(new Event("social-inbox-updated"));
  };

  const refreshAll = async () => {
    await Promise.all([loadComments(), loadSummary()]);
    announceInboxUpdate();
  };

  const changePlatform = (nextPlatform) => {
    setPlatform(nextPlatform);
    setPage(1);
    setNoticeMessage("");
  };

  const changeStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
    setNoticeMessage("");
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const result = await syncSocialComments(platform);
      const synced = (result.results || [])
        .filter((item) => item.ok)
        .map((item) => `${PLATFORM_META[item.platform]?.label}: ${item.comments || 0}`)
        .join(" · ");

      setNoticeMessage(
        synced ? `Sync selesai · ${synced}` : "Sync selesai."
      );
      await refreshAll();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const openComment = async (comment) => {
    setSelectedComment(comment);
    setReplyText("");
    setErrorMessage("");
    setNoticeMessage("");

    if (comment.status !== "new") return;

    try {
      const result = await updateSocialCommentStatus(comment.id, "read");
      const updated = result.comment || { ...comment, status: "read" };

      setSelectedComment(updated);
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
    } catch {
      // Opening the detail remains useful even when the read marker cannot be saved.
    }
  };

  const closeDetail = () => {
    if (replying || statusSaving) return;
    setSelectedComment(null);
    setReplyText("");
  };

  const handleReply = async (event) => {
    event.preventDefault();

    const message = replyText.trim();

    if (!selectedComment || !message) return;

    setReplying(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const result = await replyToSocialComment(
        selectedComment.id,
        message,
        makeIdempotencyKey()
      );

      const updated = result.comment || {
        ...selectedComment,
        status: "replied",
        replied_at: new Date().toISOString(),
      };

      setSelectedComment(updated);
      setReplyText("");
      setNoticeMessage("Balasan berhasil dikirim ke platform.");
      await refreshAll();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setReplying(false);
    }
  };

  const handleStatus = async (nextStatus) => {
    if (!selectedComment) return;

    setStatusSaving(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const result = await updateSocialCommentStatus(
        selectedComment.id,
        nextStatus
      );
      const updated = result.comment || {
        ...selectedComment,
        status: nextStatus,
      };

      setSelectedComment(updated);
      setNoticeMessage(
        nextStatus === "resolved"
          ? "Komentar ditandai selesai."
          : nextStatus === "spam"
            ? "Komentar ditandai spam."
            : "Komentar dibuka kembali."
      );
      await refreshAll();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="social-page">
      <Sidebar activePage="social-media" />

      <main className="social-main">
        <header className="social-page-header">
          <div>
            <div className="social-eyebrow">WORKSPACE / SOCIAL INBOX</div>
            <h1>Social Media Monitoring</h1>
            <p>
              Komentar Instagram, TikTok, dan Threads dalam satu inbox tanpa
              memuat foto atau video.
            </p>
          </div>

          <div className="social-header-actions">
            <button
              type="button"
              className="social-secondary-button"
              onClick={() => void refreshAll()}
              disabled={!configured || loading || syncing}
            >
              Refresh
            </button>
            <button
              type="button"
              className="social-primary-button"
              onClick={handleSync}
              disabled={!configured || syncing}
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </header>

        {!configured && (
          <div className="social-setup-message">
            <strong>Backend Social Media belum dihubungkan.</strong>
            <span>
              Deploy folder <code>worker</code>, lalu isi
              <code>VITE_SOCIAL_API_URL</code> sesuai panduan
              <code>SOCIAL-MEDIA-SETUP.md</code>.
            </span>
          </div>
        )}

        {errorMessage && <div className="social-message error">{errorMessage}</div>}
        {noticeMessage && <div className="social-message success">{noticeMessage}</div>}

        <section className="social-summary-grid" aria-label="Social inbox summary">
          <article className="social-summary-card emphasis">
            <span>NEED REPLY</span>
            <strong>{summary.need_reply}</strong>
            <small>New + read comments</small>
          </article>
          {PLATFORM_FILTERS.slice(1).map((item) => (
            <article className="social-summary-card" key={item}>
              <div className="social-summary-title">
                <span>{PLATFORM_META[item].label.toUpperCase()}</span>
                <i className={`social-connection ${integrationMap[item]?.configured ? "ready" : ""}`} />
              </div>
              <strong>{summary[item]}</strong>
              <small>
                {integrationMap[item]?.configured ? "Connected" : "Not configured"}
              </small>
            </article>
          ))}
        </section>

        <section className="social-inbox-section">
          <div className="social-inbox-header">
            <div>
              <span className="social-section-label">COMMENT QUEUE</span>
              <h2>Unified Inbox</h2>
              <small>
                {lastSyncAt ? `Last sync ${formatDate(lastSyncAt)}` : "Not synced yet"}
              </small>
            </div>

            <form className="social-search" onSubmit={submitSearch}>
              <input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search username, comment, post..."
                aria-label="Search social comments"
              />
              <button type="submit">Search</button>
            </form>
          </div>

          <div className="social-filter-row">
            <div className="social-platform-tabs" role="tablist" aria-label="Platform filter">
              {PLATFORM_FILTERS.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={platform === item ? "active" : ""}
                  onClick={() => changePlatform(item)}
                >
                  {item === "all" ? "All" : PLATFORM_META[item].label}
                </button>
              ))}
            </div>

            <select value={status} onChange={changeStatus} aria-label="Status filter">
              {STATUS_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="social-table-wrap">
            <table className="social-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Username</th>
                  <th>Comment</th>
                  <th>Post</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="social-empty">Loading comments...</td>
                  </tr>
                ) : comments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="social-empty">
                      {configured
                        ? "No comments match this filter."
                        : "Connect the Social Media Worker to start."}
                    </td>
                  </tr>
                ) : (
                  comments.map((comment) => (
                    <tr key={comment.id} className={comment.status === "new" ? "unread" : ""}>
                      <td>
                        <span className={`social-platform-mark ${comment.platform}`}>
                          {PLATFORM_META[comment.platform]?.short || "--"}
                        </span>
                        {PLATFORM_META[comment.platform]?.label || comment.platform}
                      </td>
                      <td>
                        <strong className="social-username">
                          @{comment.author_username || "unknown"}
                        </strong>
                      </td>
                      <td>
                        <p className="social-comment-copy">{comment.message}</p>
                      </td>
                      <td>
                        <p className="social-post-copy">
                          {comment.post_caption || "Untitled post"}
                        </p>
                      </td>
                      <td className="social-time">{formatDate(comment.commented_at)}</td>
                      <td>
                        <span className={`social-status ${comment.status}`}>
                          {comment.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="social-row-action"
                          onClick={() => void openComment(comment)}
                        >
                          {comment.status === "replied" ? "View" : "Reply"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="social-pagination">
            <span>{total} comments</span>
            <div>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                aria-label="Halaman komentar sebelumnya"
              >
                ←
              </button>
              <span>{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                aria-label="Halaman komentar berikutnya"
              >
                →
              </button>
            </div>
          </div>
        </section>

        <footer className="social-footer">
          <span>PLUNO SOCIAL INBOX</span>
          <span>Instagram · TikTok · Threads</span>
        </footer>
      </main>

      {selectedComment && (
        <div
          className="social-detail-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <aside className="social-detail-panel" aria-label="Comment detail">
            <header>
              <div>
                <span>COMMENT DETAIL</span>
                <h2>@{selectedComment.author_username || "unknown"}</h2>
              </div>
              <button type="button" onClick={closeDetail} aria-label="Close comment detail">
                ×
              </button>
            </header>

            <div className="social-detail-scroll">
              {errorMessage && (
                <div className="social-detail-message error">{errorMessage}</div>
              )}
              {noticeMessage && (
                <div className="social-detail-message success">{noticeMessage}</div>
              )}

              <div className="social-detail-meta">
                <span className={`social-platform-mark ${selectedComment.platform}`}>
                  {PLATFORM_META[selectedComment.platform]?.short || "--"}
                </span>
                <div>
                  <strong>{PLATFORM_META[selectedComment.platform]?.label}</strong>
                  <span>{formatDate(selectedComment.commented_at)}</span>
                </div>
                <span className={`social-status ${selectedComment.status}`}>
                  {selectedComment.status}
                </span>
              </div>

              <section className="social-detail-block">
                <span>POST</span>
                <p>{selectedComment.post_caption || "Untitled post"}</p>
                {selectedComment.post_permalink && (
                  <a href={selectedComment.post_permalink} target="_blank" rel="noreferrer">
                    Open original post ↗
                  </a>
                )}
              </section>

              <section className="social-detail-block comment">
                <span>COMMENT</span>
                <p>{selectedComment.message}</p>
              </section>

              {selectedComment.latest_reply && (
                <section className="social-detail-block reply">
                  <span>LAST REPLY</span>
                  <p>{selectedComment.latest_reply.message}</p>
                  <small>{formatDate(selectedComment.latest_reply.sent_at)}</small>
                </section>
              )}

              {selectedComment.can_reply &&
                !["spam", "resolved"].includes(selectedComment.status) && (
                <form className="social-reply-form" onSubmit={handleReply}>
                  <label htmlFor="social-reply">REPLY ON PLATFORM</label>
                  <textarea
                    id="social-reply"
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    maxLength={replyLimit}
                    rows="6"
                    placeholder={`Reply to @${selectedComment.author_username || "user"}...`}
                    disabled={replying}
                  />
                  <div className="social-reply-footer">
                    <span>{replyText.length} / {replyLimit}</span>
                    <button type="submit" disabled={replying || !replyText.trim()}>
                      {replying ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <footer className="social-detail-actions">
              {selectedComment.status === "resolved" || selectedComment.status === "spam" ? (
                <button
                  type="button"
                  onClick={() => void handleStatus("read")}
                  disabled={statusSaving}
                >
                  Reopen
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleStatus("spam")}
                    disabled={statusSaving}
                  >
                    Mark Spam
                  </button>
                  <button
                    type="button"
                    className="resolve"
                    onClick={() => void handleStatus("resolved")}
                    disabled={statusSaving}
                  >
                    Mark Resolved
                  </button>
                </>
              )}
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}

export default SocialMedia;
