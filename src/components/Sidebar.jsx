import {
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  supabase,
} from "../supabase";

import "./Sidebar.css";

function Sidebar({
  activePage,
}) {

  const employeeName =
    localStorage.getItem(
      "employeeName"
    ) || "User";

  const employeeRole =
    localStorage.getItem(
      "employeeRole"
    ) || "Staff";


  /* =================================================
     MOBILE SIDEBAR
  ================================================= */

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);


  const closeMobileSidebar = () => {

    setSidebarOpen(false);

  };


  /* =================================================
     LOGOUT
  ================================================= */

  const handleLogout =
    async () => {

      await supabase.auth.signOut();


      localStorage.removeItem(
        "isLoggedIn"
      );

      localStorage.removeItem(
        "employeeId"
      );

      localStorage.removeItem(
        "employeeName"
      );

      localStorage.removeItem(
        "employeeRole"
      );


      window.location.href =
        "/login";

    };


  /* =================================================
     ACTIVE PAGE
  ================================================= */

  const isActive = (
    page
  ) => {

    return activePage === page
      ? "active"
      : "";

  };


  return (

    <>

      {/* =================================================
          MOBILE LEFT RAIL
      ================================================= */}

      <div
        className="dashboard-mobile-rail"
        aria-hidden="true"
      ></div>


      {/* =================================================
          MOBILE MENU BUTTON
      ================================================= */}

      <button
        type="button"
        className={`dashboard-mobile-trigger ${
          sidebarOpen
            ? "open"
            : ""
        }`}
        onClick={() =>
          setSidebarOpen(
            (current) =>
              !current
          )
        }
        aria-label={
          sidebarOpen
            ? "Close navigation"
            : "Open navigation"
        }
      >

        <span></span>
        <span></span>
        <span></span>

      </button>


      {/* =================================================
          MOBILE OVERLAY
      ================================================= */}

      {sidebarOpen && (

        <div
          className="dashboard-mobile-overlay"
          onClick={
            closeMobileSidebar
          }
        />

      )}


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen
            ? "mobile-open"
            : ""
        }`}
      >

        {/* =================================================
            TOP
        ================================================= */}

        <div>


          {/* =================================================
              BRAND
          ================================================= */}

          <div className="dashboard-brand">

            <div className="dashboard-brand-mark">
              P
            </div>

            <div>

              <div className="dashboard-brand-name">
                PLUNO
              </div>

              <div className="dashboard-brand-subtitle">
                INTERNAL PORTAL
              </div>

            </div>

          </div>


          {/* =================================================
              NAVIGATION
          ================================================= */}

          <nav className="dashboard-navigation">


            {/* =================================================
                WORKSPACE
            ================================================= */}

            <div className="dashboard-nav-section">
              WORKSPACE
            </div>


            {/* 01 DASHBOARD */}

            <Link
              to="/dashboard"
              className={`dashboard-nav-item ${
                isActive(
                  "dashboard"
                )
              }`}
              onClick={
                closeMobileSidebar
              }
            >

              <span>
                01
              </span>

              Dashboard

            </Link>


            {/* 02 BOOKING */}

            <Link
              to="/booking"
              className={`dashboard-nav-item ${
                isActive(
                  "booking"
                )
              }`}
              onClick={
                closeMobileSidebar
              }
            >

              <span>
                02
              </span>

              Booking List

            </Link>


            {/* 03 CUSTOMER */}

            {(employeeRole ===
              "Founder" ||
              employeeRole ===
              "Administrator") && (

              <Link
                to="/customer"
                className={`dashboard-nav-item ${
                  isActive(
                    "customer"
                  )
                }`}
                onClick={
                  closeMobileSidebar
                }
              >

                <span>
                  03
                </span>

                Customer Data

              </Link>

            )}


            {/* =================================================
                FINANCE
            ================================================= */}

            {(employeeRole ===
              "Founder" ||
              employeeRole ===
              "Administrator") && (

              <div className="dashboard-nav-section second">
                FINANCE
              </div>

            )}


            {/* 04 SPENDING */}

            {(employeeRole ===
              "Founder" ||
              employeeRole ===
              "Administrator") && (

              <Link
                to="/spending"
                className={`dashboard-nav-item ${
                  isActive(
                    "spending"
                  )
                }`}
                onClick={
                  closeMobileSidebar
                }
              >

                <span>
                  04
                </span>

                Spending

              </Link>

            )}


            {/* 05 TRANSACTIONS */}

            {(employeeRole ===
              "Founder" ||
              employeeRole ===
              "Administrator") && (

              <Link
                to="/transactions"
                className={`dashboard-nav-item ${
                  isActive(
                    "transactions"
                  )
                }`}
                onClick={
                  closeMobileSidebar
                }
              >

                <span>
                  05
                </span>

                Transactions

              </Link>

            )}


            {/* 06 BOOKKEEPING */}

            {(employeeRole ===
              "Founder" ||
              employeeRole ===
              "Administrator") && (

              <Link
                to="/bookkeeping"
                className={`dashboard-nav-item ${
                  isActive(
                    "bookkeeping"
                  )
                }`}
                onClick={
                  closeMobileSidebar
                }
              >

                <span>
                  06
                </span>

                Bookkeeping

              </Link>

            )}


            {/* =================================================
                MANAGEMENT
            ================================================= */}

            {employeeRole ===
              "Founder" && (

              <div className="dashboard-nav-section second">
                MANAGEMENT
              </div>

            )}


            {/* 07 DOCUMENTS */}

            {employeeRole ===
              "Founder" && (

              <Link
                to="/documents"
                className={`dashboard-nav-item ${
                  isActive(
                    "documents"
                  )
                }`}
                onClick={
                  closeMobileSidebar
                }
              >

                <span>
                  07
                </span>

                Documents

              </Link>

            )}

          </nav>

        </div>


        {/* =================================================
            USER AREA
        ================================================= */}

        <div className="dashboard-sidebar-bottom">


          <div className="dashboard-user">

            <div className="dashboard-avatar">

              {employeeName
                .charAt(0)
                .toUpperCase()}

            </div>


            <div>

              <div className="dashboard-user-name">
                {employeeName}
              </div>

              <div className="dashboard-user-role">
                {employeeRole}
              </div>

            </div>

          </div>


          <button
            className="dashboard-logout"
            onClick={
              handleLogout
            }
          >
            Sign out
          </button>


        </div>

      </aside>

    </>

  );

}


export default Sidebar;