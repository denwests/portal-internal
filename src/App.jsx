import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Booking from "./pages/Booking";
import Customer from "./pages/Customer";
import Spending from "./pages/Spending";
import Transactions from "./pages/Transactions";
import Bookkeeping from "./pages/Bookkeeping";


function App() {

  return (

    <BrowserRouter>

      <Routes>


        {/* =================================================
            LOGIN
        ================================================= */}

        <Route
          path="/login"
          element={<Login />}
        />


        {/* =================================================
            DASHBOARD
        ================================================= */}

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />


        {/* =================================================
            BOOKING LIST
        ================================================= */}

        <Route
          path="/booking"
          element={<Booking />}
        />


        {/* =================================================
            CUSTOMER DATA
        ================================================= */}

        <Route
          path="/customer"
          element={<Customer />}
        />


        {/* =================================================
            SPENDING
        ================================================= */}

        <Route
          path="/spending"
          element={<Spending />}
        />


        {/* =================================================
            TRANSACTIONS
        ================================================= */}

        <Route
          path="/transactions"
          element={<Transactions />}
        />


        {/* =================================================
            BOOKKEEPING
        ================================================= */}

        <Route
          path="/bookkeeping"
          element={<Bookkeeping />}
        />


        {/* =================================================
            DEFAULT
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />


      </Routes>

    </BrowserRouter>

  );
}


export default App;