import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { driveDownloadUrl } from "../lib/googleDrive";
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
  if (!photo?.preview_path) {
    return "";
  }

  const { data } = supabase.storage
    .from("gallery-previews")
    .getPublicUrl(photo.preview_path);

  return data?.publicUrl || "";
}

function ClientGallery() {
  const { slug } = useParams();
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activePhotoId, setActivePhotoId] = useState(null);
  const [printSelection, setPrintSelection] = useState(() => new Set());
  const [guestName, setGuestName] = useState(getGuestName());
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

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
      setErrorMessage("Gallery tidak ditemukan, sudah expired, atau dinonaktifkan.");
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

  const activePhoto = photos.find((photo) => photo.id === activePhotoId) || null;

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

  const togglePrintSelection = (photoId) => {
    setPrintSelection((current) => {
      const next = new Set(current);

      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }

      return next;
    });
  };

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
    const selectedPhotos = photos.filter((photo) => printSelection.has(photo.id));

    if (selectedPhotos.length === 0) return;

    const whatsappNumber = String(import.meta.env.VITE_PLUNO_WHATSAPP || "").replace(
      /\D/g,
      ""
    );

    if (!whatsappNumber) {
      alert("VITE_PLUNO_WHATSAPP belum diisi pada environment website.");
      return;
    }

    const guestUrl = window.location.href;
    const names = selectedPhotos.map((photo, index) => `${index + 1}. ${photo.filename}`);

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
      `Total: ${selectedPhotos.length} foto`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (loading) {
    return (
      <div className="client-gallery-state">
        <div className="client-gallery-brand">PLUNO STUDIO</div>
        <p>Loading gallery...</p>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="client-gallery-state">
        <div className="client-gallery-brand">PLUNO STUDIO</div>
        <h1>Gallery Unavailable</h1>
        <p>{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="client-gallery-page">
      <header className="client-gallery-header">
        <div className="client-gallery-brand">PLUNO STUDIO</div>

        <div className="client-gallery-hero">
          <div className="client-gallery-kicker">CLIENT GALLERY</div>
          <h1>{gallery.client_name}</h1>
          {gallery.session_name && <p>{gallery.session_name}</p>}
        </div>

        <div className="client-gallery-meta">
          <span>{photos.length} PHOTOS</span>
          {gallery.expires_at && <span>ACTIVE UNTIL {formatDate(gallery.expires_at)}</span>}
        </div>

        <div className="client-gallery-top-actions">
          {gallery.drive_folder_url && (
            <button
              type="button"
              onClick={() =>
                window.open(gallery.drive_folder_url, "_blank", "noopener,noreferrer")
              }
            >
              Download All
            </button>
          )}
        </div>
      </header>

      {photos.length === 0 ? (
        <div className="client-gallery-empty">Foto belum tersedia.</div>
      ) : (
        <main className="client-gallery-grid">
          {photos.map((photo) => {
            const selected = printSelection.has(photo.id);

            return (
              <article className="client-gallery-item" key={photo.id}>
                <button
                  type="button"
                  className="client-gallery-photo-button"
                  onClick={() => setActivePhotoId(photo.id)}
                >
                  <img
                    src={getPreviewUrl(photo)}
                    alt={photo.filename}
                    loading="lazy"
                  />
                </button>

                <div className="client-gallery-item-footer">
                  <button
                    type="button"
                    className={photo.liked ? "liked" : ""}
                    onClick={() => toggleLike(photo)}
                    aria-label="Like photo"
                  >
                    {photo.liked ? "♥" : "♡"} {photo.like_count || ""}
                  </button>

                  <button
                    type="button"
                    className={selected ? "selected" : ""}
                    onClick={() => togglePrintSelection(photo.id)}
                  >
                    {selected ? "Selected" : "Print"}
                  </button>
                </div>
              </article>
            );
          })}
        </main>
      )}

      {printSelection.size > 0 && (
        <div className="client-gallery-print-bar">
          <div>
            <strong>{printSelection.size}</strong>
            <span>PHOTOS SELECTED FOR PRINT</span>
          </div>
          <button type="button" onClick={sendPrintSelection}>
            Send to WhatsApp
          </button>
        </div>
      )}

      {activePhoto && (
        <div className="client-gallery-lightbox" role="dialog" aria-modal="true">
          <button
            type="button"
            className="client-gallery-lightbox-close"
            onClick={() => setActivePhotoId(null)}
            aria-label="Close preview"
          >
            ×
          </button>

          <div className="client-gallery-lightbox-image-wrap">
            <img
              src={getPreviewUrl(activePhoto)}
              alt={activePhoto.filename}
            />
          </div>

          <aside className="client-gallery-lightbox-panel">
            <div className="client-gallery-lightbox-title">
              <span>PHOTO</span>
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
                className={printSelection.has(activePhoto.id) ? "selected" : ""}
                onClick={() => togglePrintSelection(activePhoto.id)}
              >
                {printSelection.has(activePhoto.id) ? "Selected for Print" : "Select for Print"}
              </button>

              <a href={driveDownloadUrl(activePhoto.drive_file_id)}>Download</a>
            </div>

            <div className="client-gallery-comments">
              <div className="client-gallery-comments-title">COMMENTS</div>

              <div className="client-gallery-comment-list">
                {(activePhoto.comments || []).length === 0 ? (
                  <div className="client-gallery-no-comment">No comments yet.</div>
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
                <button type="submit" disabled={commentSaving}>
                  {commentSaving ? "Sending..." : "Add Comment"}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default ClientGallery;
