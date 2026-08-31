import { supabase } from "../supabase";

const SOCIAL_API_URL = String(
  import.meta.env.VITE_SOCIAL_API_URL || ""
).replace(/\/$/, "");

export function isSocialApiConfigured() {
  return Boolean(SOCIAL_API_URL);
}

async function socialRequest(path, options = {}) {
  if (!SOCIAL_API_URL) {
    throw new Error(
      "VITE_SOCIAL_API_URL belum diatur. Ikuti SOCIAL-MEDIA-SETUP.md."
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
  }

  const response = await fetch(`${SOCIAL_API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error || payload?.message || "Social Media API tidak dapat dihubungi."
    );

    error.status = response.status;
    error.details = payload?.details;
    throw error;
  }

  return payload;
}

export function getSocialSummary() {
  return socialRequest("/api/social/summary");
}

export function getSocialComments({
  platform = "all",
  status = "need_reply",
  search = "",
  page = 1,
  limit = 25,
} = {}) {
  const query = new URLSearchParams({
    platform,
    status,
    search,
    page: String(page),
    limit: String(limit),
  });

  return socialRequest(`/api/social/comments?${query.toString()}`);
}

export function syncSocialComments(platform = "all") {
  return socialRequest("/api/social/sync", {
    method: "POST",
    body: JSON.stringify({ platform }),
  });
}

export function updateSocialCommentStatus(commentId, status) {
  return socialRequest(`/api/social/comments/${commentId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function replyToSocialComment(commentId, message, idempotencyKey) {
  return socialRequest(`/api/social/comments/${commentId}/reply`, {
    method: "POST",
    body: JSON.stringify({
      message,
      idempotency_key: idempotencyKey,
    }),
  });
}
