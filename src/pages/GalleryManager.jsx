import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import Sidebar from "../components/Sidebar";
import {
  createGalleryFolder,
  deleteDriveItem,
  hasDriveAccess,
  requestDriveAccess,
  uploadPhotoToFolder,
} from "../lib/googleDrive";
import "./GalleryManager.css";

function makeRandomSlug() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16)
    .toUpperCase();
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(value) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

function addDays(days) {
  return new Date(
    Date.now() + Math.max(1, Number(days || 1)) * 24 * 60 * 60 * 1000
  );
}

function safeFolderName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function createPreviewBlob(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const bitmap = await createImageBitmap(file);
      const maxDimension = 1200;
      const scale = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height)
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        bitmap.close?.();
        reject(new Error(`Gagal membuat preview ${file.name}.`));
        return;
      }

      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error(`Gagal membuat preview ${file.name}.`));
            return;
          }

          resolve(blob);
        },
        "image/webp",
        0.7
      );
    } catch (error) {
      reject(
        new Error(
          `Gagal membuat preview ${file.name}: ${
            error.message || "format gambar tidak didukung"
          }`
        )
      );
    }
  });
}

function GalleryManager() {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingGalleryId, setUploadingGalleryId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [driveConnected, setDriveConnected] = useState(hasDriveAccess());
  const [showCreate, setShowCreate] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGalleryForUpload, setSelectedGalleryForUpload] = useState(null);

  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    clientName: "",
    sessionName: "",
    linkDays: "7",
    storageDays: "30",
  });

  const fetchGalleries = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("galleries")
      .select(
        `
          id,
          client_name,
          session_name,
          slug,
          status,
          drive_folder_id,
          drive_folder_url,
          expires_at,
          link_expires_at,
          storage_expires_at,
          link_days,
          storage_days,
          created_at,
          gallery_photos (
            id,
            size_bytes,
            preview_path
          )
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setGalleries([]);
      setErrorMessage(
        "Gagal mengambil gallery. Jalankan E2E_DATABASE_PATCH.sql terlebih dahulu."
      );
      setLoading(false);
      return;
    }

    setGalleries(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchGalleries();
  }, []);

  const normalizedGalleries = useMemo(
    () =>
      galleries.map((gallery) => {
        const photos = gallery.gallery_photos || [];
        const size = photos.reduce(
          (sum, photo) => sum + Number(photo.size_bytes || 0),
          0
        );
        const linkExpiresAt = gallery.link_expires_at || gallery.expires_at;
        const storageExpired = isExpired(gallery.storage_expires_at);
        const linkExpired = isExpired(linkExpiresAt);

        return {
          ...gallery,
          linkExpiresAt,
          storageExpired,
          linkExpired,
          photoCount: photos.length,
          sizeBytes: size,
        };
      }),
    [galleries]
  );

  const filteredGalleries = normalizedGalleries.filter((gallery) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;

    return `${gallery.client_name || ""} ${gallery.session_name || ""} ${
      gallery.slug || ""
    }`
      .toLowerCase()
      .includes(keyword);
  });

  const totalPhotos = normalizedGalleries.reduce(
    (sum, gallery) => sum + gallery.photoCount,
    0
  );

  const totalStorage = normalizedGalleries.reduce(
    (sum, gallery) => sum + gallery.sizeBytes,
    0
  );

  const totalActive = normalizedGalleries.filter(
    (gallery) =>
      gallery.status === "active" &&
      !gallery.linkExpired &&
      !gallery.storageExpired
  ).length;

  const removeGalleryStorage = async (gallery, token) => {
    if (gallery.drive_folder_id) {
      await deleteDriveItem(gallery.drive_folder_id, token);
    }

    const previewPaths = (gallery.gallery_photos || [])
      .map((photo) => photo.preview_path)
      .filter(Boolean);

    if (previewPaths.length > 0) {
      const { error: previewDeleteError } = await supabase.storage
        .from("gallery-previews")
        .remove(previewPaths);

      if (previewDeleteError) {
        throw previewDeleteError;
      }
    }

    const { error: deleteError } = await supabase
      .from("galleries")
      .delete()
      .eq("id", gallery.id);

    if (deleteError) throw deleteError;
  };

  const cleanupExpiredGalleries = async (token) => {
    const expired = normalizedGalleries.filter(
      (gallery) => gallery.storageExpired
    );

    if (expired.length === 0) return 0;

    let deleted = 0;

    for (const gallery of expired) {
      try {
        await removeGalleryStorage(gallery, token);
        deleted += 1;
      } catch (error) {
        console.error("EXPIRED GALLERY CLEANUP ERROR:", gallery.id, error);
      }
    }

    if (deleted > 0) {
      await fetchGalleries();
    }

    return deleted;
  };

  const connectGoogleDrive = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await requestDriveAccess();
      setDriveConnected(true);
      const cleaned = await cleanupExpiredGalleries(token);
      setSuccessMessage(
        cleaned > 0
          ? `Google Drive terhubung. ${cleaned} gallery dengan storage expired dibersihkan.`
          : "Google Drive terhubung untuk sesi ini."
      );
    } catch (error) {
      console.error(error);
      setDriveConnected(false);
      setErrorMessage(error.message || "Gagal menghubungkan Google Drive.");
    }
  };

  const createGallery = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.clientName.trim()) {
      setErrorMessage("Nama client wajib diisi.");
      return;
    }

    const linkDays = Math.max(1, Number(form.linkDays || 7));
    const storageDays = Math.max(1, Number(form.storageDays || 30));

    if (storageDays < linkDays) {
      setErrorMessage(
        "Masa storage harus sama atau lebih lama daripada masa aktif link."
      );
      return;
    }

    setSaving(true);

    const linkExpiresAt = addDays(linkDays);
    const storageExpiresAt = addDays(storageDays);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from("galleries").insert({
      client_name: form.clientName.trim(),
      session_name: form.sessionName.trim() || null,
      slug: makeRandomSlug(),
      status: "active",
      expires_at: linkExpiresAt.toISOString(),
      link_expires_at: linkExpiresAt.toISOString(),
      storage_expires_at: storageExpiresAt.toISOString(),
      link_days: linkDays,
      storage_days: storageDays,
      created_by: authData?.user?.id || null,
    });

    if (error) {
      console.error(error);
      setErrorMessage(error.message || "Gagal membuat gallery.");
      setSaving(false);
      return;
    }

    setForm({
      clientName: "",
      sessionName: "",
      linkDays: "7",
      storageDays: "30",
    });
    setShowCreate(false);
    setSaving(false);
    setSuccessMessage("Gallery berhasil dibuat. Sekarang upload foto.");
    await fetchGalleries();
  };

  const getGuestUrl = (gallery) =>
    `${window.location.origin}/gallery/${gallery.slug}`;

  const copyGuestLink = async (gallery) => {
    const url = getGuestUrl(gallery);

    try {
      await navigator.clipboard.writeText(url);
      setSuccessMessage(`Guest link ${gallery.client_name} berhasil disalin.`);
      setErrorMessage("");
    } catch {
      window.prompt("Copy guest link:", url);
    }
  };

  const choosePhotos = (gallery) => {
    if (gallery.storageExpired) {
      setErrorMessage("Storage gallery ini sudah expired.");
      return;
    }

    setSelectedGalleryForUpload(gallery);
    fileInputRef.current?.click();
  };

  const ensureDriveFolder = async (gallery, token) => {
    if (gallery.drive_folder_id) {
      return {
        id: gallery.drive_folder_id,
        url:
          gallery.drive_folder_url ||
          `https://drive.google.com/drive/folders/${gallery.drive_folder_id}`,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const folder = await createGalleryFolder(
      safeFolderName(
        `PLUNO - ${gallery.client_name} - ${
          gallery.session_name || "Gallery"
        } - ${today}`
      ),
      token
    );

    const { error } = await supabase
      .from("galleries")
      .update({
        drive_folder_id: folder.id,
        drive_folder_url: folder.url,
      })
      .eq("id", gallery.id);

    if (error) {
      await deleteDriveItem(folder.id, token).catch(() => {});
      throw new Error(
        `Folder sudah dibuat tetapi gagal disimpan: ${error.message}`
      );
    }

    return folder;
  };

  const handlePhotoFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    const gallery = selectedGalleryForUpload;
    setSelectedGalleryForUpload(null);

    if (!gallery || files.length === 0) return;

    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setErrorMessage(`${invalid.name} bukan file gambar.`);
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setUploadingGalleryId(gallery.id);
    setUploadProgress(0);

    try {
      const token = await requestDriveAccess();
      setDriveConnected(true);
      await cleanupExpiredGalleries(token);

      const folder = await ensureDriveFolder(gallery, token);
      const existingPhotoCount = Number(gallery.photoCount || 0);

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadLabel(`${index + 1}/${files.length} · ${file.name}`);

        let uploadedFile = null;
        let previewPath = "";

        try {
          uploadedFile = await uploadPhotoToFolder({
            file,
            folderId: folder.id,
            token,
            onProgress: (filePercent) => {
              const overall = Math.round(
                ((index + filePercent / 100) / files.length) * 100
              );
              setUploadProgress(overall);
            },
          });

          const previewBlob = await createPreviewBlob(file);
          previewPath = `${gallery.id}/${crypto.randomUUID()}.webp`;

          const { error: previewError } = await supabase.storage
            .from("gallery-previews")
            .upload(previewPath, previewBlob, {
              contentType: "image/webp",
              cacheControl: "31536000",
              upsert: false,
            });

          if (previewError) {
            throw new Error(
              `Preview ${file.name} gagal disimpan: ${previewError.message}`
            );
          }

          const { error: photoError } = await supabase
            .from("gallery_photos")
            .insert({
              gallery_id: gallery.id,
              drive_file_id: uploadedFile.id,
              filename: uploadedFile.name || file.name,
              mime_type: uploadedFile.mimeType || file.type,
              size_bytes: Number(uploadedFile.size || file.size),
              preview_path: previewPath,
              sort_order: existingPhotoCount + index,
            });

          if (photoError) throw photoError;
        } catch (error) {
          if (previewPath) {
            await supabase.storage
              .from("gallery-previews")
              .remove([previewPath])
              .catch(() => {});
          }

          if (uploadedFile?.id) {
            await deleteDriveItem(uploadedFile.id, token).catch(() => {});
          }

          throw error;
        }
      }

      setUploadProgress(100);
      setSuccessMessage(
        `${files.length} foto berhasil diupload. Original di Drive, preview di Supabase.`
      );
      await fetchGalleries();
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Upload foto gagal.");
    } finally {
      setUploadingGalleryId(null);
      setUploadLabel("");
      setUploadProgress(0);
    }
  };

  const toggleGalleryStatus = async (gallery) => {
    if (gallery.storageExpired) {
      setErrorMessage(
        "Storage gallery sudah expired. Link tidak dapat diaktifkan kembali."
      );
      return;
    }

    const nextStatus = gallery.status === "active" ? "disabled" : "active";
    const updates = { status: nextStatus };

    if (nextStatus === "active" && gallery.linkExpired) {
      const nextExpiry = addDays(gallery.link_days || 7).toISOString();
      updates.link_expires_at = nextExpiry;
      updates.expires_at = nextExpiry;
    }

    const { error } = await supabase
      .from("galleries")
      .update(updates)
      .eq("id", gallery.id);

    if (error) {
      setErrorMessage(error.message || "Gagal mengubah status gallery.");
      return;
    }

    setSuccessMessage(
      nextStatus === "active"
        ? "Guest link diaktifkan kembali."
        : "Guest link dinonaktifkan. Storage tetap disimpan sampai masa storage habis."
    );
    await fetchGalleries();
  };

  const deleteGallery = async (gallery) => {
    const confirmed = window.confirm(
      `Hapus gallery ${gallery.client_name}?\n\nFolder Google Drive dan preview juga akan dihapus.`
    );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await requestDriveAccess();
      setDriveConnected(true);
      await removeGalleryStorage(gallery, token);
      setSuccessMessage("Gallery, foto Drive, dan preview berhasil dihapus.");
      await fetchGalleries();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error.message ||
          "Gallery belum dihapus. Hubungkan Google Drive lalu coba kembali."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gallery-manager-page">
      <Sidebar activePage="galleries" />

      <main className="gallery-manager-main">
        <div className="gallery-manager-header">
          <div>
            <div className="gallery-manager-eyebrow">
              PLUNO STUDIO / CLIENT DELIVERY
            </div>
            <h1>Client Galleries</h1>
          </div>

          <div className="gallery-manager-header-actions">
            <button
              type="button"
              className={`gallery-drive-button ${
                driveConnected ? "connected" : ""
              }`}
              onClick={connectGoogleDrive}
            >
              {driveConnected ? "Drive Connected" : "Connect Google Drive"}
            </button>

            <button
              type="button"
              className="gallery-primary-button"
              onClick={() => {
                setShowCreate(true);
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              Add Gallery
            </button>
          </div>
        </div>

        {errorMessage && <div className="gallery-alert error">{errorMessage}</div>}
        {successMessage && (
          <div className="gallery-alert success">{successMessage}</div>
        )}

        <section className="gallery-stats">
          <div className="gallery-stat-card">
            <span>TOTAL GALLERY</span>
            <strong>{loading ? "..." : normalizedGalleries.length}</strong>
          </div>
          <div className="gallery-stat-card">
            <span>ACTIVE LINK</span>
            <strong>{loading ? "..." : totalActive}</strong>
          </div>
          <div className="gallery-stat-card">
            <span>TOTAL PHOTOS</span>
            <strong>{loading ? "..." : totalPhotos}</strong>
          </div>
          <div className="gallery-stat-card">
            <span>DRIVE STORAGE</span>
            <strong>{loading ? "..." : formatBytes(totalStorage)}</strong>
          </div>
        </section>

        <section className="gallery-list-card">
          <div className="gallery-list-header">
            <div>
              <div className="gallery-manager-eyebrow">GALLERY DATABASE</div>
              <h2>Delivery List</h2>
            </div>

            <div className="gallery-search-box">
              <span>/</span>
              <input
                type="text"
                placeholder="Search gallery..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="gallery-table-scroll">
            <table className="gallery-table gallery-table-e2e">
              <thead>
                <tr>
                  <th>CLIENT</th>
                  <th>SESSION</th>
                  <th>PHOTOS</th>
                  <th>SIZE</th>
                  <th>LINK</th>
                  <th>STORAGE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="gallery-empty table-empty-cell"
                    >
                      <span className="table-empty-viewport">
                        Loading gallery...
                      </span>
                    </td>
                  </tr>
                ) : filteredGalleries.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="gallery-empty table-empty-cell"
                    >
                      <span className="table-empty-viewport">
                        Belum ada gallery.
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredGalleries.map((gallery) => {
                    const linkActive =
                      gallery.status === "active" &&
                      !gallery.linkExpired &&
                      !gallery.storageExpired;

                    return (
                      <tr key={gallery.id}>
                        <td data-label="Client">
                          <div className="gallery-client-name">
                            {gallery.client_name}
                          </div>
                          <div className="gallery-slug">{gallery.slug}</div>
                        </td>
                        <td data-label="Session">
                          <span className="table-ellipsis">
                            {gallery.session_name || "-"}
                          </span>
                        </td>
                        <td data-label="Photos">{gallery.photoCount}</td>
                        <td data-label="Size">{formatBytes(gallery.sizeBytes)}</td>
                        <td data-label="Link">
                          {formatDate(gallery.linkExpiresAt)}
                        </td>
                        <td data-label="Storage">
                          {formatDate(gallery.storage_expires_at)}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`gallery-status ${
                              gallery.storageExpired
                                ? "disabled"
                                : linkActive
                                ? "active"
                                : "disabled"
                            }`}
                          >
                            {gallery.storageExpired
                              ? "Storage Expired"
                              : linkActive
                              ? "Active"
                              : gallery.linkExpired
                              ? "Link Expired"
                              : "Disabled"}
                          </span>
                        </td>
                        <td data-label="Action">
                          <div className="gallery-row-actions">
                            <button
                              type="button"
                              onClick={() => choosePhotos(gallery)}
                              disabled={
                                gallery.storageExpired ||
                                uploadingGalleryId === gallery.id
                              }
                            >
                              {uploadingGalleryId === gallery.id
                                ? `${uploadProgress}%`
                                : "Upload"}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyGuestLink(gallery)}
                              disabled={gallery.storageExpired}
                            >
                              Copy Link
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                window.open(
                                  getGuestUrl(gallery),
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              disabled={gallery.storageExpired}
                            >
                              Preview
                            </button>
                            {gallery.drive_folder_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(
                                    gallery.drive_folder_url,
                                    "_blank",
                                    "noopener,noreferrer"
                                  )
                                }
                              >
                                Drive
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleGalleryStatus(gallery)}
                              disabled={gallery.storageExpired}
                            >
                              {gallery.status === "active" && !gallery.linkExpired
                                ? "Disable"
                                : "Enable"}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => deleteGallery(gallery)}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>

                          {uploadingGalleryId === gallery.id && (
                            <div className="gallery-upload-status">
                              <div className="gallery-upload-track">
                                <div style={{ width: `${uploadProgress}%` }} />
                              </div>
                              <span>{uploadLabel}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="gallery-hidden-input"
          onChange={handlePhotoFiles}
        />

        {showCreate && (
          <div className="gallery-modal-overlay">
            <div className="gallery-modal">
              <div className="gallery-modal-header">
                <div>
                  <div className="gallery-manager-eyebrow">
                    NEW CLIENT DELIVERY
                  </div>
                  <h2>Create Gallery</h2>
                </div>
                <button
                  type="button"
                  className="gallery-modal-close"
                  onClick={() => setShowCreate(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={createGallery}>
                <label>
                  CLIENT NAME
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        clientName: event.target.value,
                      }))
                    }
                    placeholder="Client name"
                    required
                  />
                </label>

                <label>
                  SESSION / PACKAGE
                  <input
                    type="text"
                    value={form.sessionName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sessionName: event.target.value,
                      }))
                    }
                    placeholder="Family Session, Graduation, etc."
                  />
                </label>

                <div className="gallery-retention-grid">
                  <label>
                    GUEST LINK ACTIVE
                    <select
                      value={form.linkDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          linkDays: event.target.value,
                        }))
                      }
                    >
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                    </select>
                  </label>

                  <label>
                    STORAGE ACTIVE
                    <select
                      value={form.storageDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          storageDays: event.target.value,
                        }))
                      }
                    >
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                      <option value="90">90 days</option>
                    </select>
                  </label>
                </div>

                <div className="gallery-modal-note">
                  Link dapat dinonaktifkan lalu diaktifkan kembali selama storage
                  belum expired. Saat storage expired, guest link otomatis tidak
                  dapat dibuka. File expired dibersihkan otomatis saat portal
                  kembali terhubung ke Google Drive.
                </div>

                <div className="gallery-modal-actions">
                  <button type="button" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={saving}>
                    {saving ? "Creating..." : "Create Gallery"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default GalleryManager;
