import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { driveDownloadUrl } from "../lib/googleDrive";
import {
  downloadPhotosAsZip,
  downloadPhotosSequentially,
  isMobileDownloadDevice,
} from "../lib/downloadGallery";
import "./ClientGallery.css";

function getVisitorId() {
  const key = "plunoGalleryVisitorId";
  let value = localStorage.getItem(key);

  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }

  return value;
}

function getGuestName() {
  return localStorage.getItem("plunoGalleryGuestName") || "";
}

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getPreviewUrl(photo) {
  if (!photo?.preview_path) return "";

  const { data } = supabase.storage
    .from("gallery-previews")
    .getPublicUrl(photo.preview_path);

  return data?.publicUrl || "";
}

function getDrivePreviewUrl(photo, width = 1200) {
  if (!photo?.drive_file_id) {
    return getPreviewUrl(photo);
  }

  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(
    photo.drive_file_id
  )}&sz=w${width}`;
}

function ClientGallery() {
  const { slug } = useParams();

  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [activePhotoId, setActivePhotoId] = useState(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(() => new Set());

  const [activityOpen, setActivityOpen] = useState(false);

  const [guestName, setGuestName] = useState(getGuestName());
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const [downloadJob, setDownloadJob] = useState(null);

  const visitorId = useMemo(() => getVisitorId(), []);

  const loadGallery = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.rpc("get_guest_gallery", {
      p_slug: slug,
      p_visitor_id: visitorId,
    });

    if (error) {
      console.error(error);
      setGallery(null);
      setErrorMessage("Gallery tidak dapat dibuka.");
      setLoading(false);
      return;
    }

    if (!data) {
      setGallery(null);
      setErrorMessage(
        "Gallery tidak ditemukan, link sudah expired/dinonaktifkan, atau masa storage sudah habis."
      );
      setLoading(false);
      return;
    }

    setGallery(data);
    setLoading(false);
  };

  useEffect(() => {
    loadGallery();
  }, [slug, visitorId]);

  const photos = gallery?.photos || [];

  const activePhotoIndex = photos.findIndex(
    (photo) => photo.id === activePhotoId
  );

  const activePhoto =
    activePhotoIndex >= 0 ? photos[activePhotoIndex] : null;

  const activityPhotos = useMemo(
    () =>
      photos.filter(
        (photo) =>
          photo.liked ||
          Number(photo.like_count || 0) > 0 ||
          (photo.comments || []).length > 0
      ),
    [photos]
  );

  const selectedPhotoList = photos.filter((photo) =>
    selectedPhotos.has(photo.id)
  );

  const handlePreviewLoaded = (event) => {
    const image = event.currentTarget;

    if (!image.naturalWidth || !image.naturalHeight) return;

    const item = image.closest(".client-gallery-item");

    if (!item) return;

    const ratio = Math.min(
      Math.max(image.naturalWidth / image.naturalHeight, 0.58),
      2.4
    );

    item.style.flexGrow = String(ratio);
    item.style.flexBasis = `${Math.round(ratio * 215)}px`;
  };

  const handlePreviewError = (event, photo) => {
    const fallback = getPreviewUrl(photo);

    if (!fallback || event.currentTarget.src === fallback) return;

    event.currentTarget.src = fallback;
    event.currentTarget.removeAttribute("srcset");
  };

  const toggleLike = async (photo) => {
    const { data, error } = await supabase.rpc("guest_toggle_gallery_like", {
      p_slug: slug,
      p_photo_id: photo.id,
      p_visitor_id: visitorId,
    });

    if (error) {
      console.error(error);
      return;
    }

    setGallery((current) => ({
      ...current,
      photos: (current.photos || []).map((item) =>
        item.id === photo.id
          ? {
              ...item,
              liked: Boolean(data?.liked),
              like_count: Number(data?.like_count || 0),
            }
          : item
      ),
    }));
  };

  const toggleSelection = (photoId) => {
    setSelectedPhotos((current) => {
      const next = new Set(current);

      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }

      return next;
    });
  };

  const handlePhotoClick = (photo) => {
    if (selectionMode) {
      toggleSelection(photo.id);
      return;
    }

    setActivePhotoId(photo.id);
  };

  const closePhoto = () => {
    setActivePhotoId(null);
    setCommentText("");
  };

  const showPreviousPhoto = () => {
    if (photos.length <= 1 || activePhotoIndex < 0) return;

    const previousIndex =
      activePhotoIndex === 0 ? photos.length - 1 : activePhotoIndex - 1;

    setActivePhotoId(photos[previousIndex].id);
    setCommentText("");
  };

  const showNextPhoto = () => {
    if (photos.length <= 1 || activePhotoIndex < 0) return;

    const nextIndex =
      activePhotoIndex === photos.length - 1 ? 0 : activePhotoIndex + 1;

    setActivePhotoId(photos[nextIndex].id);
    setCommentText("");
  };

  useEffect(() => {
    if (!activePhotoId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closePhoto();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activePhotoId, activePhotoIndex, photos.length]);

  const addComment = async (event) => {
    event.preventDefault();

    if (!activePhoto || !commentText.trim()) return;

    const cleanName = guestName.trim() || "Client";

    localStorage.setItem("plunoGalleryGuestName", cleanName);

    setGuestName(cleanName);
    setCommentSaving(true);

    const { data, error } = await supabase.rpc("guest_add_gallery_comment", {
      p_slug: slug,
      p_photo_id: activePhoto.id,
      p_author_name: cleanName,
      p_comment: commentText.trim(),
    });

    if (error) {
      console.error(error);
      setCommentSaving(false);
      return;
    }

    setGallery((current) => ({
      ...current,
      photos: (current.photos || []).map((item) =>
        item.id === activePhoto.id
          ? {
              ...item,
              comments: [...(item.comments || []), data],
            }
          : item
      ),
    }));

    setCommentText("");
    setCommentSaving(false);
  };

  const sendPrintSelection = () => {
    if (selectedPhotoList.length === 0) return;

    const whatsappNumber = String(
      import.meta.env.VITE_PLUNO_WHATSAPP || ""
    ).replace(/\D/g, "");

    if (!whatsappNumber) {
      alert(
        "VITE_PLUNO_WHATSAPP belum diisi pada environment production."
      );
      return;
    }

    const guestUrl = window.location.href;

    const names = selectedPhotoList.map(
      (photo, index) => `${index + 1}. ${photo.filename}`
    );

    const message = [
      "Halo Pluno Studio,",
      "",
      "Saya ingin mencetak foto dari gallery:",
      `Client: ${gallery.client_name}`,
      gallery.session_name ? `Session: ${gallery.session_name}` : null,
      `Gallery: ${guestUrl}`,
      "",
      "Foto yang dipilih:",
      ...names,
      "",
      `Total: ${selectedPhotoList.length} foto`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const runDownload = async (targetPhotos, label) => {
    if (!targetPhotos.length || downloadJob) return;

    setDownloadJob({
      percent: 0,
      filename: "Preparing...",
      label,
    });

    const onProgress = ({ percent, filename }) => {
      setDownloadJob({
        percent,
        filename,
        label,
      });
    };

    try {
      if (isMobileDownloadDevice()) {
        await downloadPhotosSequentially(targetPhotos, onProgress);
      } else {
        try {
          await downloadPhotosAsZip(
            targetPhotos,
            `PLUNO-${gallery.client_name}-${gallery.session_name || "Gallery"}`,
            onProgress
          );
        } catch (zipError) {
          console.warn("ZIP DOWNLOAD FALLBACK TO SEQUENTIAL:", zipError);

          await downloadPhotosSequentially(targetPhotos, onProgress);
        }
      }
    } catch (error) {
      console.error("GALLERY DOWNLOAD ERROR:", error);

      alert(
        `Download gagal: ${
          error.message || "Tidak dapat mengambil file original."
        }`
      );
    } finally {
      window.setTimeout(() => setDownloadJob(null), 450);
    }
  };

  const focusActivityPhoto = (photo) => {
    setActivityOpen(false);
    setActivePhotoId(photo.id);
  };

  if (loading) {
    return (
      <div className="client-gallery-state">
        <div className="client-gallery-state-card">
          <strong>PLUNO STUDIO</strong>
          <span>Loading gallery...</span>
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="client-gallery-state">
        <div className="client-gallery-state-card">
          <strong>PLUNO STUDIO</strong>
          <h1>Gallery Unavailable</h1>
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="client-gallery-page">
      <div className="client-gallery-shell">
        <header className="client-gallery-header">
          <div className="client-gallery-identity">
            <div className="client-gallery-brand">PLUNO STUDIO</div>

            <div className="client-gallery-hero">
              <span>CLIENT GALLERY</span>

              <div>
                <h1>{gallery.client_name}</h1>

                {gallery.session_name && <p>{gallery.session_name}</p>}
              </div>
            </div>
          </div>

          <div className="client-gallery-header-center">
            <div className="client-gallery-meta">
              <div>
                <strong>{photos.length}</strong>
                <span>Photos</span>
              </div>

              {gallery.link_expires_at && (
                <div>
                  <strong>{formatDate(gallery.link_expires_at)}</strong>
                  <span>Link Active Until</span>
                </div>
              )}
            </div>

            <p className="client-gallery-preview-note">
              Preview ringan untuk akses lebih cepat. Download original untuk
              resolusi penuh.
            </p>
          </div>

          <div className="client-gallery-top-actions">
            <button
              type="button"
              onClick={() => runDownload(photos, "Download All")}
              disabled={photos.length === 0 || Boolean(downloadJob)}
            >
              Download All
            </button>

            <button
              type="button"
              className={selectionMode ? "active" : ""}
              onClick={() => setSelectionMode((current) => !current)}
            >
              {selectionMode ? `Done ${selectedPhotos.size}` : "Select"}
            </button>

            <button
              type="button"
              className={activityOpen ? "active" : ""}
              onClick={() => setActivityOpen((current) => !current)}
            >
              Activity
              {activityPhotos.length > 0 && (
                <span className="client-gallery-action-count">
                  {activityPhotos.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {photos.length === 0 ? (
          <div className="client-gallery-empty">Foto belum tersedia.</div>
        ) : (
          <main
            className={`client-gallery-grid ${
              selectionMode ? "selection-mode" : ""
            }`}
          >
            {photos.map((photo, index) => {
              const selected = selectedPhotos.has(photo.id);

              const preview900 = getDrivePreviewUrl(photo, 900);
              const preview1200 = getDrivePreviewUrl(photo, 1200);
              const preview1600 = getDrivePreviewUrl(photo, 1600);

              return (
                <article
                  className={`client-gallery-item ${
                    selected ? "selected" : ""
                  }`}
                  id={`gallery-photo-${photo.id}`}
                  key={photo.id}
                >
                  <button
                    type="button"
                    className="client-gallery-photo-button"
                    onClick={() => handlePhotoClick(photo)}
                  >
                    <img
                      src={preview1200}
                      srcSet={`${preview900} 900w, ${preview1200} 1200w, ${preview1600} 1600w`}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 28vw"
                      alt={photo.filename}
                      loading={index < 6 ? "eager" : "lazy"}
                      decoding="async"
                      onLoad={handlePreviewLoaded}
                      onError={(event) => handlePreviewError(event, photo)}
                    />

                    {selectionMode && (
                      <span className="client-gallery-select-mark">
                        {selected ? "✓" : ""}
                      </span>
                    )}
                  </button>

                  <div className="client-gallery-item-footer">
                    <button
                      type="button"
                      className={photo.liked ? "liked" : ""}
                      onClick={() => toggleLike(photo)}
                      aria-label="Like photo"
                    >
                      {photo.liked ? "♥" : "♡"}
                      {Number(photo.like_count || 0) > 0 && (
                        <span>{photo.like_count}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className={selected ? "selected" : ""}
                      onClick={() => toggleSelection(photo.id)}
                    >
                      {selected ? "Selected" : "Select"}
                    </button>

                    {(photo.comments || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActivePhotoId(photo.id)}
                      >
                        Comment {(photo.comments || []).length}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </main>
        )}
      </div>

      {activityOpen && (
        <>
          <button
            type="button"
            className="client-gallery-activity-backdrop"
            onClick={() => setActivityOpen(false)}
            aria-label="Close activity"
          />

          <aside className="client-gallery-activity-panel">
            <div className="client-gallery-activity-head">
              <div>
                <span>LIKES & COMMENTS</span>
                <strong>Activity</strong>
              </div>

              <button type="button" onClick={() => setActivityOpen(false)}>
                ×
              </button>
            </div>

            {activityPhotos.length === 0 ? (
              <div className="client-gallery-activity-empty">
                Belum ada foto yang di-like atau dikomentari.
              </div>
            ) : (
              <div className="client-gallery-activity-list">
                {activityPhotos.map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => focusActivityPhoto(photo)}
                  >
                    <img
                      src={getDrivePreviewUrl(photo, 500)}
                      alt=""
                      loading="lazy"
                      onError={(event) => handlePreviewError(event, photo)}
                    />

                    <span>
                      <strong>{photo.filename}</strong>

                      <small>
                        ♥ {Number(photo.like_count || 0)} · Comment{" "}
                        {(photo.comments || []).length}
                      </small>

                      {(photo.comments || []).slice(-1).map((comment) => (
                        <em key={comment.id}>{comment.body}</em>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </>
      )}

      {selectedPhotos.size > 0 && (
        <div className="client-gallery-selection-bar">
          <div>
            <strong>{selectedPhotos.size}</strong>
            <span>Photos Selected</span>
          </div>

          <div>
            <button
              type="button"
              onClick={() =>
                runDownload(selectedPhotoList, "Download Selected")
              }
              disabled={Boolean(downloadJob)}
            >
              Download Selected
            </button>

            <button type="button" className="primary" onClick={sendPrintSelection}>
              Send WA for Print
            </button>
          </div>
        </div>
      )}

      {activePhoto && (
        <div
          className="client-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePhoto();
            }
          }}
        >
          <button
            type="button"
            className="client-gallery-lightbox-close"
            onClick={closePhoto}
            aria-label="Close preview"
          >
            ×
          </button>

          <div className="client-gallery-lightbox-image-wrap">
            {photos.length > 1 && (
              <button
                type="button"
                className="client-gallery-lightbox-nav previous"
                onClick={showPreviousPhoto}
                aria-label="Previous photo"
              >
                ‹
              </button>
            )}

            <img
              src={getDrivePreviewUrl(activePhoto, 2400)}
              alt={activePhoto.filename}
              onError={(event) => handlePreviewError(event, activePhoto)}
            />

            {photos.length > 1 && (
              <button
                type="button"
                className="client-gallery-lightbox-nav next"
                onClick={showNextPhoto}
                aria-label="Next photo"
              >
                ›
              </button>
            )}
          </div>

          <aside className="client-gallery-lightbox-panel">
            <div className="client-gallery-lightbox-title">
              <span>
                PHOTO {activePhotoIndex + 1} / {photos.length}
              </span>

              <strong>{activePhoto.filename}</strong>
            </div>

            <div className="client-gallery-lightbox-actions">
              <button
                type="button"
                className={activePhoto.liked ? "liked" : ""}
                onClick={() => toggleLike(activePhoto)}
              >
                {activePhoto.liked ? "♥ Liked" : "♡ Like"}
              </button>

              <button
                type="button"
                className={
                  selectedPhotos.has(activePhoto.id) ? "selected" : ""
                }
                onClick={() => toggleSelection(activePhoto.id)}
              >
                {selectedPhotos.has(activePhoto.id) ? "Selected" : "Select"}
              </button>

              <a
                href={driveDownloadUrl(activePhoto.drive_file_id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Original
              </a>
            </div>

            <div className="client-gallery-comments">
              <div className="client-gallery-comments-title">
                <span>COMMENTS</span>
                <strong>{(activePhoto.comments || []).length}</strong>
              </div>

              <div className="client-gallery-comment-list">
                {(activePhoto.comments || []).length === 0 ? (
                  <div className="client-gallery-no-comment">
                    No comments yet.
                  </div>
                ) : (
                  (activePhoto.comments || []).map((comment) => (
                    <div className="client-gallery-comment" key={comment.id}>
                      <strong>{comment.author_name || "Client"}</strong>
                      <p>{comment.body}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={addComment}>
                <input
                  type="text"
                  placeholder="Your name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={60}
                />

                <textarea
                  rows="3"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  maxLength={500}
                  required
                />

                <button
                  type="submit"
                  className="primary"
                  disabled={commentSaving}
                >
                  {commentSaving ? "Sending..." : "Add Comment"}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {downloadJob && (
        <div className="client-gallery-download-overlay" role="status">
          <div className="client-gallery-download-box">
            <span>{downloadJob.label}</span>
            <strong>{downloadJob.percent}%</strong>

            <div className="client-gallery-download-track">
              <div style={{ width: `${downloadJob.percent}%` }} />
            </div>

            <p>{downloadJob.filename}</p>

            <small>
              {isMobileDownloadDevice()
                ? "Foto sedang diunduh satu per satu."
                : "Original sedang dikumpulkan menjadi ZIP."}
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientGallery;
