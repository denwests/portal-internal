export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export function assert(condition, status, message, details) {
  if (!condition) {
    throw new HttpError(status, message, details);
  }
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body harus berupa JSON yang valid.");
  }
}

export async function fetchJson(url, options = {}, label = "External API") {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new HttpError(
        502,
        `${label} gagal (${response.status}).`,
        payload?.error?.message || payload?.message || payload
      );
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new HttpError(504, `${label} tidak merespons dalam 25 detik.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function toIsoDate(value, fallback = new Date().toISOString()) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    const milliseconds = numeric > 100000000000 ? numeric : numeric * 1000;
    const parsed = new Date(milliseconds);

    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

export function truncate(value, length = 500) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
