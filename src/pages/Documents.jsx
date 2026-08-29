import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../supabase";
import "./Documents.css";

const EMPTY_FORM = {
  title: "",
  category: "Internal",
  url: "",
  description: "",
};

function normalizeUrl(value) {
  const url = String(value || "").trim();

  if (!/^https:\/\//i.test(url)) {
    throw new Error("Gunakan link HTTPS yang valid.");
  }

  return url;
}

function formatDocumentDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function Documents() {
  const employeeId = localStorage.getItem("employeeId");

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchDocuments = async () => {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("id,title,category,url,description,created_by,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("DOCUMENT FETCH ERROR:", error);
      setDocuments([]);
      setErrorMessage(
        "Gagal memuat dokumen. Pastikan migration documents sudah dijalankan."
      );
    } else {
      setDocuments(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      fetchDocuments();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  const filteredDocuments = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return documents;

    return documents.filter((document) =>
      `${document.title || ""} ${document.category || ""} ${
        document.description || ""
      }`
        .toLowerCase()
        .includes(keyword)
    );
  }, [documents, search]);

  const openAddForm = () => {
    setSelectedDocument(null);
    setFormData(EMPTY_FORM);
    setErrorMessage("");
    setMessage("");
    setModalMode("add");
  };

  const openEditForm = (document) => {
    setSelectedDocument(document);
    setFormData({
      title: document.title || "",
      category: document.category || "Internal",
      url: document.url || "",
      description: document.description || "",
    });
    setErrorMessage("");
    setMessage("");
    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) return;

    setModalMode(null);
    setSelectedDocument(null);
    setFormData(EMPTY_FORM);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setMessage("");

    try {
      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        url: normalizeUrl(formData.url),
        description: formData.description.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (!payload.title) {
        throw new Error("Nama dokumen wajib diisi.");
      }

      if (modalMode === "edit" && selectedDocument) {
        const { error } = await supabase
          .from("documents")
          .update(payload)
          .eq("id", selectedDocument.id);

        if (error) throw error;
        setMessage("Dokumen berhasil diperbarui.");
      } else {
        const { error } = await supabase.from("documents").insert({
          ...payload,
          created_by: employeeId,
        });

        if (error) throw error;
        setMessage("Dokumen berhasil ditambahkan.");
      }

      setModalMode(null);
      setSelectedDocument(null);
      setFormData(EMPTY_FORM);
      await fetchDocuments();
    } catch (error) {
      console.error("DOCUMENT SAVE ERROR:", error);
      setErrorMessage(error.message || "Gagal menyimpan dokumen.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (document) => {
    const confirmed = window.confirm(
      `Hapus dokumen “${document.title}”? Tindakan ini tidak dapat dibatalkan.`
    );

    if (!confirmed) return;

    setErrorMessage("");
    setMessage("");

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", document.id);

    if (error) {
      console.error("DOCUMENT DELETE ERROR:", error);
      setErrorMessage(error.message || "Gagal menghapus dokumen.");
      return;
    }

    setDocuments((current) =>
      current.filter((item) => item.id !== document.id)
    );
    setMessage("Dokumen berhasil dihapus.");
  };

  return (
    <div className="documents-page">
      <Sidebar activePage="documents" />

      <main className="documents-main">
        <div className="documents-page-header">
          <div>
            <div className="documents-eyebrow">
              PLUNO STUDIO / DOCUMENT MANAGEMENT
            </div>
            <h1>Documents</h1>
          </div>

          <button type="button" className="documents-add" onClick={openAddForm}>
            Add Document
          </button>
        </div>

        {errorMessage && (
          <div className="documents-message error" role="alert">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="documents-message success" role="status">
            {message}
          </div>
        )}

        <section className="documents-content">
          <div className="documents-list-header">
            <div>
              <div className="documents-section-label">DOCUMENT LIBRARY</div>
              <h2>Internal Documents</h2>
            </div>

            <div className="documents-list-tools">
              <span>{filteredDocuments.length} DOCUMENT</span>
              <input
                type="search"
                placeholder="Search document..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="documents-empty" role="status">
              Loading documents...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="documents-empty" role="status">
              Belum ada dokumen.
            </div>
          ) : (
            <div className="documents-grid">
              {filteredDocuments.map((document) => (
                <article className="document-card" key={document.id}>
                  <div className="document-card-top">
                    <span>{document.category || "Internal"}</span>
                    <time>{formatDocumentDate(document.created_at)}</time>
                  </div>

                  <h3>{document.title}</h3>
                  <p>{document.description || "Tidak ada keterangan."}</p>

                  <div className="document-card-actions">
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Open
                    </a>
                    <button type="button" onClick={() => openEditForm(document)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDelete(document)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="documents-footer">
          <span>PLUNO INTERNAL SYSTEM</span>
          <span>v1.0 · 2026</span>
        </footer>
      </main>

      {modalMode && (
        <div
          className="documents-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <form className="documents-modal" onSubmit={handleSubmit}>
            <div className="documents-modal-header">
              <div>
                <span>DOCUMENT DATA</span>
                <h2>{modalMode === "edit" ? "Edit Document" : "Add Document"}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <div className="documents-form-grid">
              <label>
                DOCUMENT NAME
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Document name"
                  required
                />
              </label>

              <label>
                CATEGORY
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="Internal">Internal</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Legal">Legal</option>
                </select>
              </label>

              <label className="wide">
                DOCUMENT LINK
                <input
                  name="url"
                  type="url"
                  value={formData.url}
                  onChange={handleChange}
                  placeholder="https://..."
                  required
                />
              </label>

              <label className="wide">
                DESCRIPTION
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Optional description"
                />
              </label>
            </div>

            <div className="documents-modal-actions">
              <button type="button" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Saving..." : "Save Document"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Documents;
