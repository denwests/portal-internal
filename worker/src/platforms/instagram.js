import {
  assert,
  fetchJson,
  mapWithConcurrency,
  toIsoDate,
  truncate,
} from "../lib/http.js";

function graphBase(env) {
  const host = String(
    env.INSTAGRAM_GRAPH_BASE_URL || "https://graph.instagram.com"
  ).replace(/\/$/, "");
  const version = String(env.META_GRAPH_VERSION || "v25.0").replace(/^\//, "");
  return `${host}/${version}`;
}

function authHeaders(env) {
  return {
    Authorization: `Bearer ${env.INSTAGRAM_ACCESS_TOKEN}`,
  };
}

async function fetchCollection(initialUrl, env, maxPages = 5) {
  const items = [];
  let nextUrl = initialUrl;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const payload = await fetchJson(
      nextUrl,
      { headers: authHeaders(env) },
      "Instagram API"
    );

    items.push(...(payload.data || []));
    nextUrl = payload?.paging?.next || null;
    page += 1;
  }

  return items;
}

export function isInstagramConfigured(env) {
  return Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID);
}

export function normalizeInstagramComment(comment, context) {
  const author = comment?.from || {};
  const replies = comment?.replies?.data || [];
  const hasOwnerReply = replies.some(
    (reply) => String(reply?.from?.id || "") === String(context.accountId)
  );

  return {
    platform_post_id: String(context.postId),
    platform_comment_id: String(comment.id),
    platform_parent_id: comment.parent_id ? String(comment.parent_id) : null,
    author_platform_id: author.id ? String(author.id) : null,
    author_username: author.username || comment.username || null,
    author_name: author.username || comment.username || null,
    message: String(comment.text || ""),
    commented_at: toIsoDate(comment.timestamp),
    is_owned_reply: String(author.id || "") === String(context.accountId),
    can_reply: comment.hidden !== true,
    reply_count: Number(comment.reply_count || replies.length || 0),
    has_owner_reply: hasOwnerReply,
  };
}

export async function fetchInstagramInbox(env) {
  assert(isInstagramConfigured(env), 400, "Instagram belum dikonfigurasi.");

  const accountId = String(env.INSTAGRAM_ACCOUNT_ID);
  const postLimit = Math.min(Math.max(Number(env.SYNC_POST_LIMIT || 25), 1), 100);
  const mediaQuery = new URLSearchParams({
    fields: "id,caption,permalink,timestamp",
    limit: String(postLimit),
  });
  const media = await fetchCollection(
    `${graphBase(env)}/${encodeURIComponent(accountId)}/media?${mediaQuery}`,
    env,
    1
  );

  const posts = await mapWithConcurrency(media.slice(0, postLimit), 4, async (item) => {
    const commentQuery = new URLSearchParams({
      fields:
        "id,text,timestamp,from,parent_id,hidden,replies{id,text,timestamp,from,parent_id}",
      limit: "100",
    });
    const rawComments = await fetchCollection(
      `${graphBase(env)}/${encodeURIComponent(item.id)}/comments?${commentQuery}`,
      env,
      5
    );

    return {
      platform_post_id: String(item.id),
      caption: truncate(item.caption || "Instagram post", 500),
      permalink: item.permalink || null,
      published_at: toIsoDate(item.timestamp),
      comments: rawComments.map((comment) =>
        normalizeInstagramComment(comment, {
          accountId,
          postId: item.id,
        })
      ),
    };
  });

  return {
    account: {
      platform: "instagram",
      platform_account_id: accountId,
      username: env.INSTAGRAM_USERNAME || null,
      display_name: env.INSTAGRAM_USERNAME || "Instagram",
    },
    posts,
  };
}

export async function replyInstagram(env, comment, message) {
  assert(isInstagramConfigured(env), 400, "Instagram belum dikonfigurasi.");

  const body = new URLSearchParams({ message });
  const payload = await fetchJson(
    `${graphBase(env)}/${encodeURIComponent(comment.platform_comment_id)}/replies`,
    {
      method: "POST",
      headers: {
        ...authHeaders(env),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    "Instagram reply"
  );

  assert(payload?.id, 502, "Instagram tidak mengembalikan ID balasan.", payload);
  return { platform_reply_id: String(payload.id), raw: payload };
}
