import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../supabase";

import "./ResetPassword.css";


function ResetPassword() {

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [recoveryReady, setRecoveryReady] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [resetComplete, setResetComplete] =
    useState(false);


  const navigate =
    useNavigate();


  /* =================================================
     CHECK RECOVERY SESSION
  ================================================= */

  useEffect(() => {

    let isMounted = true;


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
          event === "PASSWORD_RECOVERY" &&
          session
        ) {

          setRecoveryReady(true);
          setErrorMessage("");
          setCheckingSession(false);

        }

      }
    );


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


        if (
          error ||
          !session
        ) {

          setRecoveryReady(false);

          setErrorMessage(
            "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta link baru dari halaman login."
          );

        } else {

          setRecoveryReady(true);

        }


        setCheckingSession(false);

      };


    checkSession();


    return () => {

      isMounted = false;

      subscription.unsubscribe();

    };

  }, []);


  /* =================================================
     UPDATE PASSWORD
  ================================================= */

  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setErrorMessage("");
      setSuccessMessage("");


      if (!recoveryReady) {

        setErrorMessage(
          "Session reset password tidak tersedia. Silakan minta link baru."
        );

        return;
      }


      if (
        password.length < 8
      ) {

        setErrorMessage(
          "Password minimal 8 karakter."
        );

        return;
      }


      if (
        password !==
        confirmPassword
      ) {

        setErrorMessage(
          "Konfirmasi password tidak sama."
        );

        return;
      }


      setLoading(true);


      const {
        error,
      } = await supabase.auth.updateUser({
        password,
      });


      if (error) {

        console.error(
          "UPDATE PASSWORD ERROR:",
          error
        );

        setErrorMessage(
          error.message ||
          "Gagal memperbarui password."
        );

        setLoading(false);

        return;
      }


      setPassword("");
      setConfirmPassword("");
      setResetComplete(true);

      setSuccessMessage(
        "Password berhasil diperbarui. Silakan login menggunakan password baru."
      );


      await supabase.auth.signOut();

      setLoading(false);

    };


  const goToLogin = () => {

    navigate(
      "/login",
      {
        replace: true,
      }
    );

  };


  return (

    <div className="reset-password-page">

      <div className="reset-password-box">


        <div className="reset-password-kicker">
          PLUNO STUDIO / INTERNAL PORTAL
        </div>

        <h1>
          Reset Password
        </h1>

        <p className="reset-password-description">
          Create a new password for your account.
        </p>


        {checkingSession ? (

          <div className="reset-password-status">
            Checking recovery link...
          </div>

        ) : (

          <>

            {!resetComplete &&
              recoveryReady && (

              <form
                onSubmit={
                  handleSubmit
                }
              >

                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                />


                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(
                    event
                  ) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  required
                />


                {errorMessage && (

                  <div className="reset-password-error">
                    {errorMessage}
                  </div>

                )}


                {successMessage && (

                  <div className="reset-password-success">
                    {successMessage}
                  </div>

                )}


                <button
                  type="submit"
                  className="reset-password-primary"
                  disabled={loading}
                >
                  {loading
                    ? "Updating..."
                    : "Update Password"}
                </button>

              </form>

            )}


            {!recoveryReady &&
              errorMessage && (

              <div className="reset-password-error standalone">
                {errorMessage}
              </div>

            )}


            {resetComplete &&
              successMessage && (

              <div className="reset-password-success standalone">
                {successMessage}
              </div>

            )}


            {(!recoveryReady ||
              resetComplete) && (

              <button
                type="button"
                className="reset-password-primary"
                onClick={
                  goToLogin
                }
              >
                Back to Sign in
              </button>

            )}

          </>

        )}


      </div>

    </div>

  );
}


export default ResetPassword;
