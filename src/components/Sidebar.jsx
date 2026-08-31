import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { getSocialSummary, isSocialApiConfigured } from "../lib/socialApi";
import "./Sidebar.css";

function Sidebar({ activePage }) {
  const employeeName = localStorage.getItem("employeeName") || "User";
  const employeeRole = localStorage.getItem("employeeRole") || "Staff";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [socialBadge, setSocialBadge] = useState(0);

  const closeMobileSidebar = () => {
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("employeeId");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("employeeRole");

    window.location.href = "/login";
  };

  const isActive = (page) => (activePage === page ? "active" : "");

  const isOperational =
    employeeRole === "Founder" || employeeRole === "Administrator";

  useEffect(() => {
    if (!isOperational || !isSocialApiConfigured()) {
      return undefined;
    }

    let active = true;

    const loadBadge = async () => {
      try {
        const summary = await getSocialSummary();

        if (active) {
          setSocialBadge(Number(summary?.counts?.need_reply || 0));
        }
      } catch {
        if (active) {
          setSocialBadge(0);
        }
      }
    };

    const handleInboxUpdate = () => {
      void loadBadge();
    };

    void loadBadge();

    const intervalId = window.setInterval(loadBadge, 60000);
    window.addEventListener("social-inbox-updated", handleInboxUpdate);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("social-inbox-updated", handleInboxUpdate);
    };
  }, [isOperational]);

  return (
    <>
      <div className="dashboard-mobile-rail" aria-hidden="true"></div>

      <button
        type="button"
        className={`dashboard-mobile-trigger ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen((current) => !current)}
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {sidebarOpen && (
        <div
          className="dashboard-mobile-overlay"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={`dashboard-sidebar ${sidebarOpen ? "mobile-open" : ""}`}
      >
        <div className="dashboard-sidebar-top">
          <div className="dashboard-brand">
            <div>
              <div className="dashboard-brand-name">PLUNO STUDIO</div>
              <div className="dashboard-brand-subtitle">INTERNAL PORTAL</div>
            </div>
          </div>

          <nav className="dashboard-navigation">
            <div className="dashboard-nav-section">WORKSPACE</div>

            <Link
              to="/dashboard"
              className={`dashboard-nav-item ${isActive("dashboard")}`}
              onClick={closeMobileSidebar}
            >
              <span>01</span>
              Dashboard
            </Link>

            <Link
              to="/booking"
              className={`dashboard-nav-item ${isActive("booking")}`}
              onClick={closeMobileSidebar}
            >
              <span>02</span>
              Booking List
            </Link>

            <Link
              to="/galleries"
              className={`dashboard-nav-item ${isActive("galleries")}`}
              onClick={closeMobileSidebar}
            >
              <span>03</span>
              Client Gallery
            </Link>

            {isOperational && (
              <Link
                to="/social-media"
                className={`dashboard-nav-item ${isActive("social-media")}`}
                onClick={closeMobileSidebar}
              >
                <span>04</span>
                <span className="dashboard-nav-label">Social Media</span>
                {socialBadge > 0 && (
                  <span
                    className="dashboard-nav-badge"
                    aria-label={`${socialBadge} komentar perlu dibalas`}
                  >
                    {socialBadge > 99 ? "99+" : socialBadge}
                  </span>
                )}
              </Link>
            )}

            {isOperational && (
              <div className="dashboard-nav-section second">FINANCE</div>
            )}

            {isOperational && (
              <Link
                to="/transactions"
                className={`dashboard-nav-item ${isActive("transactions")}`}
                onClick={closeMobileSidebar}
              >
                <span>05</span>
                Transactions
              </Link>
            )}

            {isOperational && (
              <Link
                to="/customer"
                className={`dashboard-nav-item ${isActive("customer")}`}
                onClick={closeMobileSidebar}
              >
                <span>06</span>
                Customer Data
              </Link>
            )}

            {isOperational && (
              <Link
                to="/spending"
                className={`dashboard-nav-item ${isActive("spending")}`}
                onClick={closeMobileSidebar}
              >
                <span>07</span>
                Spending
              </Link>
            )}

            {isOperational && (
              <Link
                to="/bookkeeping"
                className={`dashboard-nav-item ${isActive("bookkeeping")}`}
                onClick={closeMobileSidebar}
              >
                <span>08</span>
                Bookkeeping
              </Link>
            )}

            {isOperational && (
              <div className="dashboard-nav-section second">
                SOCIAL MEDIA MANAGEMENT
              </div>
            )}

            {isOperational && (
              <Link
                to="/smm-timeline"
                className={`dashboard-nav-item ${isActive("smm-timeline")}`}
                onClick={closeMobileSidebar}
              >
                <span>09</span>
                Timeline
              </Link>
            )}

            {employeeRole === "Founder" && (
              <div className="dashboard-nav-section second">MANAGEMENT</div>
            )}

            {employeeRole === "Founder" && (
              <Link
                to="/employee"
                className={`dashboard-nav-item ${isActive("employee")}`}
                onClick={closeMobileSidebar}
              >
                <span>10</span>
                Employee
              </Link>
            )}

            {employeeRole === "Founder" && (
              <Link
                to="/documents"
                className={`dashboard-nav-item ${isActive("documents")}`}
                onClick={closeMobileSidebar}
              >
                <span>11</span>
                Documents
              </Link>
            )}
          </nav>
        </div>

        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-user">
            <div className="dashboard-avatar">
              {employeeName.charAt(0).toUpperCase()}
            </div>

            <div className="dashboard-user-copy">
              <div className="dashboard-user-name">{employeeName}</div>
              <div className="dashboard-user-role">{employeeRole}</div>
            </div>
          </div>

          <div className="dashboard-sidebar-divider" />

          <button
            type="button"
            className="dashboard-logout"
            onClick={handleLogout}
          >
            <span>Logout</span>
            <span className="dashboard-logout-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
