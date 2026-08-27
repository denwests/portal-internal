import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

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

  return (
    <div className="login-page">

      <form
        className="login-box"
        onSubmit={handleLogin}
      >

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(event) =>
            setUsername(event.target.value)
          }
          autoComplete="username"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          autoComplete="current-password"
          required
        />

        {errorMessage && (
          <div className="login-error">
            {errorMessage}
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

      </form>

    </div>
  );
}

export default Login;