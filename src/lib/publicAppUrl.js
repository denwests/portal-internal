import { Capacitor } from "@capacitor/core";

const DEFAULT_PUBLIC_APP_URL = "https://internal.plunostudio.com";

export function getPublicAppUrl(path = "") {
  const configuredUrl = String(
    import.meta.env.VITE_PUBLIC_APP_URL || ""
  )
    .trim()
    .replace(/\/$/, "");
  const baseUrl = Capacitor.isNativePlatform()
    ? configuredUrl || DEFAULT_PUBLIC_APP_URL
    : window.location.origin;
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
