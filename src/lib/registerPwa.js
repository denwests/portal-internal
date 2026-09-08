import { Capacitor } from "@capacitor/core";

export function registerPwa() {
  if (!import.meta.env.PROD || Capacitor.isNativePlatform() ||
      !window.isSecureContext || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .catch((error) => console.warn("Web app registration failed", error));
  }, { once: true });
}
