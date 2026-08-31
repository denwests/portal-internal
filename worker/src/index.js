import {
  authenticateOperator,
  createDatabase,
} from "./lib/database.js";
import {
  HttpError,
  assert,
  jsonResponse,
  readJson,
} from "./lib/http.js";
import {
  getIntegrationConfig,
  sendPlatformReply,
  SOCIAL_PLATFORMS,
  syncPlatforms,
} from "./sync.js";

const STATUS_FILTERS = new Set([
  "all",
  "need_reply",
  "new",
  "read",
  "replied",
  "resolved",
  "spam",
]);

const MUTABLE_STATUSES = new Set(["new", "read", "resolved", "spam"]);

const REPLY_LIMITS = {
  instagram: 2200,
  threads: 500,
  tiktok: 1200,
};

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean)
  );
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");

  if (!origin) return {};

  const allowed = allowedOrigins(env);
  if (!allowed.has(origin.replace(/\/$/, ""))) {
    throw new HttpError(403, "Origin tidak diizinkan oleh Social Media Worker.");
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withHeaders(response, headers) {
  const merged = new Headers(response.headers);

  Object.entries(headers).forEach(([key, value]) => merged.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

function sanitizeSearch(value) {
  const withoutControlCharacters = Array.from(String(value || ""))
    .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
    .join("");

  return withoutControlCharacters
    .replace(/[,%()'*"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function getInboxComment(database, id) {
  const result = await database.select("social_inbox", {
    select: "*",
    id: `eq.${id}`,
    limit: "1",
  });
  return result.data?.[0] || null;
}

async function handleSummary(env, database) {
  const [counts, accountsResult, runsResult] = await Promise.all([
    database.rpc("social_inbox_summary"),
    database.select("social_accounts", {
      select:
        "platform,platform_account_id,username,enabled,last_sync_at,last_sync_status,last_sync_error",
      order: "platform.asc",
    }),
    database.select("social_sync_runs", {
      select: "finished_at,started_at",
      order: "started_at.desc",
      limit: "1",
    }),
  ]);

  const accountMap = Object.fromEntries(
    (accountsResult.data || []).map((account) => [account.platform, account])
  );
  const integrations = getIntegrationConfig(env).map((integration) => ({
    ...integration,
    account: accountMap[integration.platform] || null,
  }));
  const lastRun = runsResult.data?.[0];

  return jsonResponse({
    counts: counts || {
      total: 0,
      need_reply: 0,
      instagram: 0,
      threads: 0,
      tiktok: 0,
    },
    integrations,
    last_sync_at: lastRun?.finished_at || lastRun?.started_at || null,
  });
}

async function handleComments(url, database) {
  const platform = url.searchParams.get("platform") || "all";
  const status = url.searchParams.get("status") || "need_reply";
  const search = sanitizeSearch(url.searchParams.get("search"));
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") || 25), 1),
    100
  );

  assert(
    platform === "all" || SOCIAL_PLATFORMS.includes(platform),
    400,
    "Filter platform tidak valid."
  );
  assert(STATUS_FILTERS.has(status), 400, "Filter status tidak valid.");

  const params = {
    select: "*",
    order: "commented_at.desc",
  };

  if (platform !== "all") params.platform = `eq.${platform}`;
  if (status === "need_reply") params.status = "in.(new,read)";
  else if (status !== "all") params.status = `eq.${status}`;

  if (search) {
    params.or = [
      `message.ilike.*${search}*`,
      `author_username.ilike.*${search}*`,
      `author_name.ilike.*${search}*`,
      `post_caption.ilike.*${search}*`,
    ].join(",");
  }

  const from = (page - 1) * limit;
  const result = await database.select("social_inbox", params, {
    range: { from, to: from + limit - 1 },
    count: true,
  });

  return jsonResponse({
    comments: result.data || [],
    total: result.total ?? (result.data || []).length,
    page,
    limit,
  });
}

async function handleStatusUpdate(request, database, user, commentId) {
  const body = await readJson(request);
  const nextStatus = String(body.status || "");

  assert(MUTABLE_STATUSES.has(nextStatus), 400, "Status tidak dapat digunakan.");

  const currentResult = await database.select("social_comments", {
    select: "id,status",
    id: `eq.${commentId}`,
    limit: "1",
  });
  const current = currentResult.data?.[0];
  assert(current, 404, "Komentar tidak ditemukan.");

  if (current.status === "replied" && nextStatus === "read") {
    return jsonResponse({ comment: await getInboxComment(database, commentId) });
  }

  const now = new Date().toISOString();
  const update = { status: nextStatus };

  if (nextStatus === "read") {
    update.read_at = now;
    update.read_by = user.id;
    update.resolved_at = null;
    update.resolved_by = null;
  } else if (nextStatus === "resolved") {
    update.resolved_at = now;
    update.resolved_by = user.id;
  } else if (nextStatus === "spam") {
    update.resolved_at = now;
    update.resolved_by = user.id;
    update.can_reply = false;
  } else if (nextStatus === "new") {
    update.read_at = null;
    update.read_by = null;
    update.resolved_at = null;
    update.resolved_by = null;
    update.can_reply = true;
  }

  if (nextStatus === "read" && current.status === "spam") {
    update.can_reply = true;
  }

  await database.update(
    "social_comments",
    { id: `eq.${commentId}` },
    update
  );

  return jsonResponse({ comment: await getInboxComment(database, commentId) });
}

async function handleReply(request, env, database, user, commentId) {
  const body = await readJson(request);
  const message = String(body.message || "").trim();
  const idempotencyKey = String(body.idempotency_key || "");
  const commentResult = await database.select("social_comments", {
    select: "*",
    id: `eq.${commentId}`,
    limit: "1",
  });
  const comment = commentResult.data?.[0];

  assert(comment, 404, "Komentar tidak ditemukan.");
  assert(comment.can_reply, 409, "Komentar ini tidak dapat dibalas.");
  assert(!comment.is_owned_reply, 409, "Balasan milik akun sendiri tidak dapat dibalas.");
  assert(message.length > 0, 400, "Isi balasan wajib diisi.");
  assert(
    message.length <= (REPLY_LIMITS[comment.platform] || 500),
    400,
    `Balasan terlalu panjang untuk ${comment.platform}.`
  );
  assert(validUuid(idempotencyKey), 400, "Idempotency key tidak valid.");

  const existingResult = await database.select("social_replies", {
    select: "*",
    idempotency_key: `eq.${idempotencyKey}`,
    limit: "1",
  });
  let replyRecord = existingResult.data?.[0];

  if (replyRecord?.status === "sent") {
    return jsonResponse({
      comment: await getInboxComment(database, commentId),
      reply: replyRecord,
      idempotent: true,
    });
  }

  if (replyRecord?.status === "pending") {
    throw new HttpError(
      409,
      "Balasan dengan permintaan yang sama masih diproses. Cek platform sebelum mencoba lagi."
    );
  }

  if (replyRecord) {
    assert(
      replyRecord.comment_id === commentId && replyRecord.message === message,
      409,
      "Idempotency key sudah digunakan untuk balasan lain."
    );
    replyRecord = await database.update(
      "social_replies",
      { id: `eq.${replyRecord.id}` },
      { status: "pending", error_message: null }
    );
  } else {
    replyRecord = await database.insert("social_replies", {
      comment_id: commentId,
      platform: comment.platform,
      idempotency_key: idempotencyKey,
      message,
      status: "pending",
      created_by: user.id,
    });
  }

  let platformReply;

  try {
    platformReply = await sendPlatformReply(env, comment, message);
  } catch (error) {
    await database.update(
      "social_replies",
      { id: `eq.${replyRecord.id}` },
      {
        status: "failed",
        error_message: String(error.details || error.message || error).slice(0, 1800),
      }
    ).catch(() => null);
    throw error;
  }

  const sentAt = new Date().toISOString();

  try {
    await database.update(
      "social_replies",
      { id: `eq.${replyRecord.id}` },
      {
        status: "sent",
        platform_reply_id: platformReply.platform_reply_id,
        sent_at: sentAt,
        error_message: null,
      }
    );
    await database.update(
      "social_comments",
      { id: `eq.${commentId}` },
      {
        status: "replied",
        replied_at: sentAt,
        replied_by: user.id,
        resolved_at: null,
        resolved_by: null,
      }
    );
  } catch (error) {
    throw new HttpError(
      500,
      "Balasan sudah terkirim ke platform, tetapi pencatatan Supabase gagal. Jangan kirim ulang sebelum memeriksa platform.",
      error.message
    );
  }

  return jsonResponse({
    comment: await getInboxComment(database, commentId),
    reply: {
      id: replyRecord.id,
      platform_reply_id: platformReply.platform_reply_id,
      sent_at: sentAt,
      status: "sent",
    },
  });
}

async function handleSync(request, env, database, user) {
  const body = await readJson(request);
  const platform = String(body.platform || "all").toLowerCase();

  assert(
    platform === "all" || SOCIAL_PLATFORMS.includes(platform),
    400,
    "Platform sync tidak valid."
  );

  const results = await syncPlatforms(env, database, platform, {
    triggerSource: "manual",
    userId: user.id,
  });

  return jsonResponse({
    ok: results.every((item) => item.ok),
    results,
  });
}

async function routeRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({
      ok: true,
      service: "pluno-social-inbox",
      time: new Date().toISOString(),
    });
  }

  const { user, database } = await authenticateOperator(request, env);

  if (request.method === "GET" && url.pathname === "/api/social/summary") {
    return handleSummary(env, database);
  }

  if (request.method === "GET" && url.pathname === "/api/social/comments") {
    return handleComments(url, database);
  }

  if (request.method === "POST" && url.pathname === "/api/social/sync") {
    return handleSync(request, env, database, user);
  }

  const statusMatch = url.pathname.match(
    /^\/api\/social\/comments\/([0-9a-f-]+)\/status$/i
  );
  if (request.method === "PATCH" && statusMatch) {
    assert(validUuid(statusMatch[1]), 400, "Comment ID tidak valid.");
    return handleStatusUpdate(request, database, user, statusMatch[1]);
  }

  const replyMatch = url.pathname.match(
    /^\/api\/social\/comments\/([0-9a-f-]+)\/reply$/i
  );
  if (request.method === "POST" && replyMatch) {
    assert(validUuid(replyMatch[1]), 400, "Comment ID tidak valid.");
    return handleReply(request, env, database, user, replyMatch[1]);
  }

  throw new HttpError(404, "Endpoint tidak ditemukan.");
}

export default {
  async fetch(request, env) {
    let cors = {};

    try {
      cors = corsHeaders(request, env);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      const response = await routeRequest(request, env);
      return withHeaders(response, cors);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message =
        error instanceof HttpError
          ? error.message
          : "Social Media Worker mengalami kesalahan.";

      if (status >= 500) {
        console.error("SOCIAL WORKER ERROR", {
          message: error?.message,
          details: error?.details,
          stack: error?.stack,
        });
      }

      return withHeaders(
        jsonResponse(
          {
            error: message,
            ...(error?.details ? { details: error.details } : {}),
          },
          status
        ),
        cors
      );
    }
  },

  async scheduled(_controller, env, ctx) {
    const task = (async () => {
      const database = createDatabase(env);

      try {
        const results = await syncPlatforms(env, database, "all", {
          triggerSource: "cron",
          userId: null,
        });
        console.log("SOCIAL CRON COMPLETE", results);
      } catch (error) {
        console.error("SOCIAL CRON FAILED", error.message);
      }
    })();

    ctx.waitUntil(task);
  },
};
