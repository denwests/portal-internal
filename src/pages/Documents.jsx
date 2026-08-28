import Sidebar from "../components/Sidebar";
import "./Documents.css";


function Documents() {

  return (

    <div className="documents-page">

      <Sidebar
        activePage="documents"
      />


      <main className="documents-main">

        <div className="documents-page-header">

          <div>

            <div className="documents-eyebrow">
              PLUNO STUDIO / DOCUMENT MANAGEMENT
            </div>

            <h1>
              Documents
            </h1>

          </div>

        </div>


        <section className="documents-content">

          <div className="documents-section-label">
            DOCUMENT MANAGEMENT
          </div>

          <h2>
            Documents workspace
          </h2>

          <p>
            Document management will be added in the next development stage.
          </p>

        </section>


        <footer className="documents-footer">

          <span>
            PLUNO INTERNAL SYSTEM
          </span>

          <span>
            v1.0 · 2026
          </span>

        </footer>

      </main>

    </div>

  );
}


export default Documents;
