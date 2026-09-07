import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./index.css";
import App from "./App.jsx";
import { initializeNativeAuth } from "./lib/nativeAuth.js";
import "./pluno-theme.css";
import "./pluno-night.css";

async function startApp() {
  try {
    await initializeNativeAuth();
  } catch (error) {
    console.error("NATIVE AUTH INITIALIZATION ERROR:", error);
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp();
