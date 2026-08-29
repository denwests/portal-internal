import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Privacy from "./pages/Privacy";

import Dashboard from "./pages/Dashboard";
import Booking from "./pages/Booking";
import Customer from "./pages/Customer";
import Spending from "./pages/Spending";
import Transactions from "./pages/Transactions";
import Bookkeeping from "./pages/Bookkeeping";
import Employee from "./pages/Employee";
import Documents from "./pages/Documents";

import GalleryManager from "./pages/GalleryManager";
import ClientGallery from "./pages/ClientGallery";

import ProtectedRoute from "./components/ProtectedRoute";


const ALL_ROLES = [
  "Founder",
  "Administrator",
  "Staff",
];


const OPERATIONAL_ROLES = [
  "Founder",
  "Administrator",
];


const FOUNDER_ONLY = [
  "Founder",
];


function App() {

  return (

    <BrowserRouter>

      <Routes>


        {/* =================================================
            PUBLIC
        ================================================= */}

        <Route
          path="/login"
          element={
            <Login />
          }
        />


        <Route
          path="/reset-password"
          element={
            <ResetPassword />
          }
        />


        {/* =================================================
            PRIVACY POLICY
            Public - digunakan juga untuk Google OAuth
        ================================================= */}

        <Route
          path="/privacy"
          element={
            <Privacy />
          }
        />


        {/* =================================================
            CLIENT GALLERY
            Public guest link
        ================================================= */}

        <Route
          path="/gallery/:slug"
          element={
            <ClientGallery />
          }
        />


        {/* =================================================
            DASHBOARD
            Founder / Administrator / Staff
        ================================================= */}

        <Route
          path="/dashboard"
          element={

            <ProtectedRoute
              allowedRoles={
                ALL_ROLES
              }
            >

              <Dashboard />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            BOOKING
            Founder / Administrator / Staff
        ================================================= */}

        <Route
          path="/booking"
          element={

            <ProtectedRoute
              allowedRoles={
                ALL_ROLES
              }
            >

              <Booking />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            CUSTOMER
            Founder / Administrator
        ================================================= */}

        <Route
          path="/customer"
          element={

            <ProtectedRoute
              allowedRoles={
                OPERATIONAL_ROLES
              }
            >

              <Customer />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            CLIENT GALLERY MANAGER
            Founder / Administrator
        ================================================= */}

        <Route
          path="/galleries"
          element={

            <ProtectedRoute
              allowedRoles={
                OPERATIONAL_ROLES
              }
            >

              <GalleryManager />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            SPENDING
            Founder / Administrator
        ================================================= */}

        <Route
          path="/spending"
          element={

            <ProtectedRoute
              allowedRoles={
                OPERATIONAL_ROLES
              }
            >

              <Spending />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            TRANSACTIONS
            Founder / Administrator
        ================================================= */}

        <Route
          path="/transactions"
          element={

            <ProtectedRoute
              allowedRoles={
                OPERATIONAL_ROLES
              }
            >

              <Transactions />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            BOOKKEEPING
            Founder / Administrator
        ================================================= */}

        <Route
          path="/bookkeeping"
          element={

            <ProtectedRoute
              allowedRoles={
                OPERATIONAL_ROLES
              }
            >

              <Bookkeeping />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            EMPLOYEE
            Founder only
        ================================================= */}

        <Route
          path="/employee"
          element={

            <ProtectedRoute
              allowedRoles={
                FOUNDER_ONLY
              }
            >

              <Employee />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            DOCUMENTS
            Founder only
        ================================================= */}

        <Route
          path="/documents"
          element={

            <ProtectedRoute
              allowedRoles={
                FOUNDER_ONLY
              }
            >

              <Documents />

            </ProtectedRoute>

          }
        />


        {/* =================================================
            ROOT
        ================================================= */}

        <Route
          path="/"
          element={

            <Navigate
              to="/dashboard"
              replace
            />

          }
        />


        {/* =================================================
            DEFAULT
        ================================================= */}

        <Route
          path="*"
          element={

            <Navigate
              to="/dashboard"
              replace
            />

          }
        />


      </Routes>

    </BrowserRouter>

  );
}


export default App;