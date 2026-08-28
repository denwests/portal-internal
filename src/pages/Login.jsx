import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();

  /* =========================
     LOGIN
  ========================= */

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    /* =========================
       FIND EMPLOYEE BY USERNAME
    ========================= */

    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select("*")
      .eq("username", username.trim())
      .single();

    if (employeeError || !employee) {
      console.error("EMPLOYEE ERROR:", employeeError);

      setErrorMessage(
        "Username tidak ditemukan."
      );

      setLoading(false);
      return;
    }

    /* =========================
       CHECK STATUS
    ========================= */

    if (employee.status !== "Aktif") {
      setErrorMessage(
        "This account is inactive."
      );

      setLoading(false);
      return;
    }

    /* =========================
       LOGIN SUPABASE AUTH
    ========================= */

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email: employee.email,
      password: password,
    });

    if (authError) {
      console.error("AUTH ERROR:", authError);

      setErrorMessage(
        authError.message ||
        "Login gagal."
      );

      setLoading(false);
      return;
    }

    /* =========================
       CHECK USER ID
    ========================= */

    if (
      !authData.user ||
      authData.user.id !== employee.id
    ) {
      console.error(
        "USER ID MISMATCH:",
        {
          authUserId: authData.user?.id,
          employeeId: employee.id,
        }
      );

      await supabase.auth.signOut();

      setErrorMessage(
        "Account configuration error."
      );

      setLoading(false);
      return;
    }

    /* =========================
       SAVE LOGIN DATA
    ========================= */

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
      employee.name
    );

    localStorage.setItem(
      "employeeRole",
      employee.role
    );

    /* =========================
       GO TO DASHBOARD
    ========================= */

    navigate("/dashboard");

    setLoading(false);
  };

  /* =========================
     RESET PASSWORD
  ========================= */

  const handleResetPassword = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const email = resetEmail.trim();

    if (!email) {
      setErrorMessage(
        "Masukkan email terlebih dahulu."
      );

      setLoading(false);
      return;
    }

    /* =========================
       CHECK EMPLOYEE
    ========================= */

    const {
      data: employee,
      error: employeeError,
    } = await supabase
      .from("employees")
      .select("email, status")
      .eq("email", email)
      .single();

    if (employeeError || !employee) {
      setErrorMessage(
        "Email tidak terdaftar."
      );

      setLoading(false);
      return;
    }

    /* =========================
       CHECK STATUS
    ========================= */

    if (employee.status !== "Aktif") {
      setErrorMessage(
        "This account is inactive."
      );

      setLoading(false);
      return;
    }

    /* =========================
       SEND RESET EMAIL
    ========================= */

    const { error } =
      await supabase.auth.resetPasswordForEmail(
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

    setSuccessMessage(
      "Reset password link has been sent to your email."
    );

    setLoading(false);
  };

  /* =========================
     SWITCH TO LOGIN
  ========================= */

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
              onChange={(event) =>
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
              onChange={(event) =>
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
              onChange={(event) =>
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
              onClick={handleBackToLogin}
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