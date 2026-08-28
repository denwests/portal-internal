import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabase";

/**
 * Membungkus halaman yang butuh login.
 *
 * Cara kerja:
 * 1. Saat halaman dibuka, cek session Supabase (supabase.auth.getSession()).
 *    Session ini berisi JWT access_token yang diterbitkan Supabase Auth
 *    saat login berhasil dan disimpan otomatis oleh supabase-js.
 * 2. Selama proses cek berlangsung, tampilkan loading (supaya halaman
 *    tidak "kelihatan sekilas" sebelum di-redirect).
 * 3. Kalau tidak ada session/JWT valid -> redirect ke /login.
 * 4. Kalau ada -> render halaman yang diminta (children).
 * 5. onAuthStateChange dipasang supaya kalau token expired / user logout
 *    di tab lain, halaman ini langsung ikut ter-redirect juga.
 */
function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !session) {
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
      }

      setChecking(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        Memeriksa sesi login...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
