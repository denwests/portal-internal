import Sidebar from "../components/Sidebar";
import "./Documents.css";

function Documents() {
  return (
    <div className="documents-page">
      <Sidebar activePage="documents" />

      <main className="documents-main">
        <div className="documents-page-header">
          <div>
            <h1>Documents</h1>
          </div>
        </div>

        <section className="documents-content documents-content-empty">
          <div className="documents-empty-state">
            <div className="documents-empty-mark">—</div>
            <h2>Internal Documents</h2>
            <p>Belum ada dokumen.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Documents;
