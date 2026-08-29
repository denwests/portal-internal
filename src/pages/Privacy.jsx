import "./Privacy.css";

function Privacy() {
  return (
    <div className="privacy-page">

      <main className="privacy-container">

        <header className="privacy-header">

          <div className="privacy-brand">
            PLUNO STUDIO
          </div>

          <div className="privacy-kicker">
            CLIENT GALLERY / PRIVACY
          </div>

          <h1>
            Privacy Policy
          </h1>

          <p className="privacy-updated">
            Last updated: 29 August 2026
          </p>

        </header>


        <section className="privacy-section">

          <h2>
            About PLUNO Client Gallery
          </h2>

          <p>
            PLUNO Client Gallery is a private client
            photo gallery service operated by PLUNO
            Studio. The service allows PLUNO Studio to
            upload, organize, preview, and deliver
            photographs to clients through a unique
            guest gallery link.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Google Drive Access
          </h2>

          <p>
            PLUNO Client Gallery uses Google Drive as
            photo storage. The application requests the
            Google Drive scope:
          </p>

          <div className="privacy-code">
            https://www.googleapis.com/auth/drive.file
          </div>

          <p>
            This permission is used only to create,
            upload, access, manage, and delete files
            and folders that are created or selected
            through PLUNO Client Gallery.
          </p>

          <p>
            The application does not request access to
            unrelated files stored in the connected
            Google Drive account.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            How Google Data Is Used
          </h2>

          <p>
            Google Drive data is used exclusively for
            providing the client gallery functionality,
            including:
          </p>

          <ul>
            <li>
              Creating folders for client galleries.
            </li>

            <li>
              Uploading client photographs.
            </li>

            <li>
              Displaying photographs in client
              galleries.
            </li>

            <li>
              Allowing photographs to be downloaded.
            </li>

            <li>
              Managing or deleting gallery files when
              requested by authorized PLUNO Studio
              staff.
            </li>
          </ul>

        </section>


        <section className="privacy-section">

          <h2>
            Google Authentication
          </h2>

          <p>
            Google OAuth access tokens are used to
            communicate with Google Drive while an
            authorized PLUNO Studio user is using the
            application.
          </p>

          <p>
            Google OAuth access tokens are not stored
            permanently in the PLUNO Client Gallery
            database.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Gallery Information
          </h2>

          <p>
            PLUNO Client Gallery may store limited
            gallery information in its database,
            including:
          </p>

          <ul>
            <li>
              Client and gallery identification.
            </li>

            <li>
              Gallery file names and Google Drive file
              references.
            </li>

            <li>
              Gallery availability and expiration
              information.
            </li>

            <li>
              Photo likes.
            </li>

            <li>
              Photo comments.
            </li>

            <li>
              Photos selected for printing.
            </li>
          </ul>

          <p>
            Original photograph files are stored in
            Google Drive and are not stored directly
            in the PLUNO Client Gallery database.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Guest Gallery Links
          </h2>

          <p>
            Client galleries may be accessed through a
            unique and randomly generated guest link.
            Clients do not need a PLUNO Studio account
            to access an active guest gallery.
          </p>

          <p>
            Anyone who receives a valid guest link may
            be able to access that gallery while the
            gallery remains active. Clients should
            avoid sharing their gallery link with
            people they do not wish to have access.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Data Retention
          </h2>

          <p>
            Guest gallery access may expire after the
            period configured by PLUNO Studio.
          </p>

          <p>
            Gallery expiration does not necessarily
            delete the original photographs from
            Google Drive. Photograph files may remain
            stored until they are manually deleted by
            authorized PLUNO Studio staff.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Data Sharing
          </h2>

          <p>
            PLUNO Studio does not sell Google user
            data or client gallery information.
          </p>

          <p>
            Information is used only as necessary to
            operate the gallery service and provide
            requested photography-related services.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Security
          </h2>

          <p>
            Internal gallery management features are
            limited to authorized PLUNO Studio users.
            Client galleries use unique guest links to
            reduce unauthorized discovery of gallery
            pages.
          </p>

        </section>


        <section className="privacy-section">

          <h2>
            Contact
          </h2>

          <p>
            Questions regarding this Privacy Policy or
            PLUNO Client Gallery can be directed to
            PLUNO Studio.
          </p>

          <p>
            Email:
            {" "}
            <a href="mailto:EMAIL_KAMU">
              vanguenawork@gmail.com
            </a>
          </p>

        </section>


        <footer className="privacy-footer">

          <span>
            PLUNO STUDIO
          </span>

          <span>
            CLIENT GALLERY
          </span>

        </footer>

      </main>

    </div>
  );
}

export default Privacy;