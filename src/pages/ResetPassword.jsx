import { useState } from "react";
import { supabase } from "../supabase";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage(
      "Password updated successfully. You can now log in."
    );

    setPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "360px",
          background: "#222",
          padding: "35px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            letterSpacing: "2px",
            color: "#999",
            marginBottom: "10px",
          }}
        >
          PLUNO INTERNAL PORTAL
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: "400",
            margin: "0 0 10px",
          }}
        >
          Reset Password
        </h1>

        <p
          style={{
            fontSize: "11px",
            color: "#999",
            marginBottom: "25px",
          }}
        >
          Create a new password for your account.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              marginBottom: "12px",
              background: "#171717",
              border: "1px solid #444",
              color: "white",
            }}
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              marginBottom: "18px",
              background: "#171717",
              border: "1px solid #444",
              color: "white",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: "white",
              color: "#171717",
              border: "none",
              cursor: "pointer",
            }}
          >
            {loading
              ? "Updating..."
              : "Update Password"}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: "18px",
              fontSize: "11px",
              color: "#aaa",
              lineHeight: "1.5",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;