import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "./Sidebar.css";

function Sidebar({ activePage }) {
  const employeeName = localStorage.getItem("employeeName") || "User";
  const employeeRole = localStorage.getItem("employeeRole") || "Staff";

  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <div>
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

            {isOperational && (
              <Link
                to="/customer"
                className={`dashboard-nav-item ${isActive("customer")}`}
                onClick={closeMobileSidebar}
              >
                <span>03</span>
                Customer Data
              </Link>
            )}

            {isOperational && (
              <Link
                to="/galleries"
                className={`dashboard-nav-item ${isActive("galleries")}`}
                onClick={closeMobileSidebar}
              >
                <span>04</span>
                Client Gallery
              </Link>
            )}

            {isOperational && (
              <div className="dashboard-nav-section second">FINANCE</div>
            )}

            {isOperational && (
              <Link
                to="/spending"
                className={`dashboard-nav-item ${isActive("spending")}`}
                onClick={closeMobileSidebar}
              >
                <span>05</span>
                Spending
              </Link>
            )}

            {isOperational && (
              <Link
                to="/transactions"
                className={`dashboard-nav-item ${isActive("transactions")}`}
                onClick={closeMobileSidebar}
              >
                <span>06</span>
                Transactions
              </Link>
            )}

            {isOperational && (
              <Link
                to="/bookkeeping"
                className={`dashboard-nav-item ${isActive("bookkeeping")}`}
                onClick={closeMobileSidebar}
              >
                <span>07</span>
                Bookkeeping
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
                <span>08</span>
                Employee
              </Link>
            )}

            {employeeRole === "Founder" && (
              <Link
                to="/documents"
                className={`dashboard-nav-item ${isActive("documents")}`}
                onClick={closeMobileSidebar}
              >
                <span>09</span>
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

            <div>
              <div className="dashboard-user-name">{employeeName}</div>
              <div className="dashboard-user-role">{employeeRole}</div>
            </div>
          </div>

          <button className="dashboard-logout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
