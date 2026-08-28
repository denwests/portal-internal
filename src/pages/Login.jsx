import {
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../supabase";

import "./Login.css";


function Login() {

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [resetEmail, setResetEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [resetMode, setResetMode] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");


  const navigate =
    useNavigate();

  const location =
    useLocation();


  /* =================================================
     SAFE RETURN PATH
     Digunakan ketika user membuka share link Booking,
     lalu harus login terlebih dahulu.
  ================================================= */

  const getReturnPath = () => {

    const from =
      location.state?.from;


    if (
      typeof from === "string" &&
      from.startsWith("/") &&
      !from.startsWith("//")
    ) {
      return from;
    }


    return "/dashboard";

  };


  /* =================================================
     LOGIN
  ================================================= */

  const handleLogin =
    async (event) => {

      event.preventDefault();

      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");


      const normalizedUsername =
        username.trim();


      /* =================================================
         FIND EMPLOYEE BY USERNAME
      ================================================= */

      const {
        data: employee,
        error: employeeError,
      } = await supabase
        .from("employees")
        .select(
          "id, name, email, role, status"
        )
        .eq(
          "username",
          normalizedUsername
        )
        .maybeSingle();


      if (
        employeeError ||
        !employee
      ) {

        console.error(
          "EMPLOYEE ERROR:",
          employeeError
        );

        setErrorMessage(
          "Username atau password salah."
        );

        setLoading(false);

        return;
      }


      /* =================================================
         CHECK STATUS
      ================================================= */

      if (
        employee.status !==
        "Aktif"
      ) {

        setErrorMessage(
          "This account is inactive."
        );

        setLoading(false);

        return;
      }


      /* =================================================
         LOGIN SUPABASE AUTH
      ================================================= */

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email: employee.email,
        password,
      });


      if (authError) {

        console.error(
          "AUTH ERROR:",
          authError
        );

        setErrorMessage(
          "Username atau password salah."
        );

        setLoading(false);

        return;
      }


      /* =================================================
         CHECK AUTH USER = EMPLOYEE
      ================================================= */

      if (
        !authData.user ||
        authData.user.id !==
          employee.id
      ) {

        console.error(
          "USER ID MISMATCH:",
          {
            authUserId:
              authData.user?.id,
            employeeId:
              employee.id,
          }
        );

        await supabase.auth.signOut();

        setErrorMessage(
          "Account configuration error."
        );

        setLoading(false);

        return;
      }


      /* =================================================
         SAVE DISPLAY DATA
         ProtectedRoute akan memverifikasi ulang data ini
         langsung dari database ketika halaman dibuka.
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


      /* =================================================
         GO TO ORIGINAL PAGE / DASHBOARD
      ================================================= */

      navigate(
        getReturnPath(),
        {
          replace: true,
        }
      );

      setLoading(false);

    };


  /* =================================================
     RESET PASSWORD REQUEST
  ================================================= */

  const handleResetPassword =
    async (event) => {

      event.preventDefault();

      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");


      const email =
        resetEmail
          .trim()
          .toLowerCase();


      if (!email) {

        setErrorMessage(
          "Masukkan email terlebih dahulu."
        );

        setLoading(false);

        return;
      }


      const {
        error,
      } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}/reset-password`,
        }
      );


      if (error) {

        console.error(
          "RESET PASSWORD ERROR:",
          error
        );

        setErrorMessage(
          error.message ||
          "Gagal mengirim link reset password."
        );

        setLoading(false);

        return;
      }


      /* =================================================
         Pesan dibuat umum agar halaman login tidak
         membocorkan apakah sebuah email terdaftar.
      ================================================= */

      setSuccessMessage(
        "Jika email terdaftar, link reset password akan dikirim ke email tersebut."
      );

      setLoading(false);

    };


  /* =================================================
     BACK TO LOGIN
  ================================================= */

  const handleBackToLogin = () => {

    setResetMode(false);
    setResetEmail("");
    setErrorMessage("");
    setSuccessMessage("");

  };


  return (

    <div className="login-page">

      <form
        className="login-box"
        onSubmit={
          resetMode
            ? handleResetPassword
            : handleLogin
        }
      >


        {!resetMode ? (

          <>

            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(
                event
              ) =>
                setUsername(
                  event.target.value
                )
              }
              autoComplete="username"
              required
            />


            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(
                event
              ) =>
                setPassword(
                  event.target.value
                )
              }
              autoComplete="current-password"
              required
            />


            {errorMessage && (

              <div className="login-error">
                {errorMessage}
              </div>

            )}


            {successMessage && (

              <div className="login-success">
                {successMessage}
              </div>

            )}


            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>


            <button
              type="button"
              className="reset-password-link"
              onClick={() => {
                setResetMode(true);
                setErrorMessage("");
                setSuccessMessage("");
              }}
            >
              Reset Password
            </button>

          </>

        ) : (

          <>

            <input
              type="email"
              placeholder="Email"
              value={resetEmail}
              onChange={(
                event
              ) =>
                setResetEmail(
                  event.target.value
                )
              }
              autoComplete="email"
              required
            />


            {errorMessage && (

              <div className="login-error">
                {errorMessage}
              </div>

            )}


            {successMessage && (

              <div className="login-success">
                {successMessage}
              </div>

            )}


            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Sending..."
                : "Send Reset Link"}
            </button>


            <button
              type="button"
              className="reset-password-link"
              onClick={
                handleBackToLogin
              }
            >
              Back to Sign in
            </button>

          </>

        )}


      </form>

    </div>

  );
}


export default Login;
