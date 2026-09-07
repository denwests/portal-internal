import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

import { supabase } from "../supabase";

const NATIVE_AUTH_SCHEME = "com.plunostudio.portalinternal";
const RESET_PASSWORD_ROUTE = "/reset-password";

export function getPasswordResetRedirectUrl() {
  if (Capacitor.isNativePlatform()) {
    return `${NATIVE_AUTH_SCHEME}://reset-password`;
  }

  return `${window.location.origin}${RESET_PASSWORD_ROUTE}`;
}

async function openNativeAuthUrl(url) {
  if (!url?.startsWith(`${NATIVE_AUTH_SCHEME}://`)) {
    return;
  }

  const parsedUrl = new URL(url);
  const route =
    parsedUrl.hostname === "reset-password"
      ? RESET_PASSWORD_ROUTE
      : parsedUrl.pathname;

  if (route !== RESET_PASSWORD_ROUTE) {
    return;
  }

  const query = parsedUrl.searchParams;
  const fragment = new URLSearchParams(
    parsedUrl.hash.replace(/^#/, "")
  );
  const errorDescription =
    query.get("error_description") ||
    fragment.get("error_description");

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const accessToken =
    query.get("access_token") ||
    fragment.get("access_token");
  const refreshToken =
    query.get("refresh_token") ||
    fragment.get("refresh_token");
  const code = query.get("code");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }
  } else if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }
  }

  window.history.replaceState({}, "", RESET_PASSWORD_ROUTE);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export async function initializeNativeAuth() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await CapacitorApp.addListener(
    "appUrlOpen",
    ({ url }) => {
      openNativeAuthUrl(url).catch((error) => {
        console.error("NATIVE AUTH LINK ERROR:", error);
      });
    }
  );

  const launchUrl = await CapacitorApp.getLaunchUrl();

  if (launchUrl?.url) {
    await openNativeAuthUrl(launchUrl.url);
  }
}
