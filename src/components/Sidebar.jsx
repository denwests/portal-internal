import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import PortalIcon from "./PortalIcon";
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
        <div className="dashboard-sidebar-top">
          <div className="dashboard-brand">
            <div className="dashboard-brand-copy">
              <div className="dashboard-brand-name">PLUNO STUDIO</div>
              <div className="dashboard-brand-subtitle">INTERNAL PORTAL</div>
            </div>
            <span className="dashboard-brand-chevron" aria-hidden="true">⌄</span>
          </div>

          <nav className="dashboard-navigation">
            <div className="dashboard-nav-section">WORKSPACE</div>

            <Link
              to="/dashboard"
              className={`dashboard-nav-item ${isActive("dashboard")}`}
              onClick={closeMobileSidebar}
            >
              <PortalIcon name="dashboard" />
              Dashboard
            </Link>

            <Link
              to="/booking"
              className={`dashboard-nav-item ${isActive("booking")}`}
              onClick={closeMobileSidebar}
            >
              <PortalIcon name="booking" />
              Booking List
            </Link>

            {isOperational && (
              <div className="dashboard-nav-section second">FINANCE</div>
            )}

            {isOperational && (
              <Link
                to="/transactions"
                className={`dashboard-nav-item ${isActive("transactions")}`}
                onClick={closeMobileSidebar}
              >
                <PortalIcon name="transactions" />
                Transactions
              </Link>
            )}

            {isOperational && (
              <Link
                to="/customer"
                className={`dashboard-nav-item ${isActive("customer")}`}
                onClick={closeMobileSidebar}
              >
                <PortalIcon name="customer" />
                Customer Data
              </Link>
            )}

            {isOperational && (
              <Link
                to="/spending"
                className={`dashboard-nav-item ${isActive("spending")}`}
                onClick={closeMobileSidebar}
              >
                <PortalIcon name="spending" />
                Spending
              </Link>
            )}

            {isOperational && (
              <Link
                to="/bookkeeping"
                className={`dashboard-nav-item ${isActive("bookkeeping")}`}
                onClick={closeMobileSidebar}
              >
                <PortalIcon name="bookkeeping" />
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
                <PortalIcon name="timeline" />
                Timeline
              </Link>
            )}

            {isOperational && (
              <Link
                to="/smm-invoice"
                className={`dashboard-nav-item ${isActive("smm-invoice")}`}
                onClick={closeMobileSidebar}
              >
                <PortalIcon name="invoice" />
                Invoice
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
                <PortalIcon name="employee" />
                Employee
              </Link>
            )}

            {employeeRole === "Founder" && (
              <Link
                to="/documents"
                className={`dashboard-nav-item ${isActive("documents")}`}
                onClick={closeMobileSidebar}
              >
                <PortalIcon name="documents" />
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
