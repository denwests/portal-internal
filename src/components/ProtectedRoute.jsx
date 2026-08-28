import {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  supabase,
} from "../supabase";


const KNOWN_ROLES = [
  "Founder",
  "Administrator",
  "Staff",
];


function clearLocalLoginData() {

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

}


function ProtectedRoute({
  children,
  allowedRoles = KNOWN_ROLES,
}) {

  const location =
    useLocation();

  const [checking, setChecking] =
    useState(true);

  const [accessState, setAccessState] =
    useState("checking");


  useEffect(() => {

    let isMounted = true;


    const validateSession =
      async (session) => {

        if (!session?.user) {

          clearLocalLoginData();

          if (isMounted) {
            setAccessState(
              "unauthenticated"
            );
            setChecking(false);
          }

          return;
        }


        const {
          data: employee,
          error: employeeError,
        } = await supabase
          .from("employees")
          .select(
            "id, name, role, status"
          )
          .eq(
            "id",
            session.user.id
          )
          .maybeSingle();


        if (!isMounted) {
          return;
        }


        const employeeIsValid =
          !employeeError &&
          employee &&
          employee.status === "Aktif" &&
          KNOWN_ROLES.includes(
            employee.role
          );


        if (!employeeIsValid) {

          clearLocalLoginData();

          setAccessState(
            "unauthenticated"
          );

          setChecking(false);

          await supabase.auth.signOut();

          return;
        }


        /* =================================================
           REFRESH LOCAL DISPLAY DATA
           localStorage hanya dipakai untuk tampilan Sidebar.
           Permission tetap ditentukan dari data DB di atas.
        ================================================= */

        localStorage.setItem(
          "isLoggedIn",
          "true"
        );

        localStorage.setItem(
          "employeeId",
          employee.id
        );

        localStorage.setItem(
          "employeeName",
          employee.name || "User"
        );

        localStorage.setItem(
          "employeeRole",
          employee.role
        );


        const roleAllowed =
          allowedRoles.includes(
            employee.role
          );


        setAccessState(
          roleAllowed
            ? "allowed"
            : "forbidden"
        );

        setChecking(false);

      };


    const checkSession =
      async () => {

        const {
          data: {
            session,
          },
          error,
        } = await supabase.auth.getSession();


        if (!isMounted) {
          return;
        }


        if (error || !session) {

          clearLocalLoginData();

          setAccessState(
            "unauthenticated"
          );

          setChecking(false);

          return;
        }


        await validateSession(
          session
        );

      };


    checkSession();


    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {

        if (!isMounted) {
          return;
        }


        if (
          event === "SIGNED_OUT" ||
          !session
        ) {

          clearLocalLoginData();

          setAccessState(
            "unauthenticated"
          );

          setChecking(false);

        }

      }
    );


    return () => {

      isMounted = false;

      subscription.unsubscribe();

    };

  }, [allowedRoles]);


  if (checking) {

    return (

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#777",
          fontFamily:
            '"Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: "10px",
          letterSpacing: "1px",
        }}
      >
        CHECKING SESSION
      </div>

    );
  }


  if (
    accessState ===
    "unauthenticated"
  ) {

    const returnTo =
      `${location.pathname}${location.search}${location.hash}`;


    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: returnTo,
        }}
      />
    );

  }


  if (
    accessState ===
    "forbidden"
  ) {

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );

  }


  return children;
}


export default ProtectedRoute;
