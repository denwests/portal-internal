import {
  assert,
  fetchJson,
  mapWithConcurrency,
  toIsoDate,
  truncate,
} from "../lib/http.js";

function graphBase(env) {
  const host = String(
    env.THREADS_GRAPH_BASE_URL || "https://graph.threads.net"
  ).replace(/\/$/, "");
  const version = String(env.META_GRAPH_VERSION || "v25.0").replace(/^\//, "");
  return `${host}/${version}`;
}

function authHeaders(env) {
  return {
    Authorization: `Bearer ${env.THREADS_ACCESS_TOKEN}`,
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
      "Threads API"
    );

    items.push(...(payload.data || []));
    nextUrl = payload?.paging?.next || null;
    page += 1;
  }

  return items;
}

export function isThreadsConfigured(env) {
  return Boolean(env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID);
}

export function normalizeThreadsConversation(conversation, context) {
  const ownedReplyTargets = new Set(
    conversation
      .filter((item) => item.is_reply_owned_by_me === true)
      .map((item) => String(item?.replied_to?.id || ""))
      .filter(Boolean)
  );

  return conversation.map((item) => ({
    platform_post_id: String(context.postId),
    platform_comment_id: String(item.id),
    platform_parent_id: item?.replied_to?.id
      ? String(item.replied_to.id)
      : null,
    author_platform_id: null,
    author_username: item.username || null,
    author_name: item.username || null,
    message: String(item.text || ""),
    commented_at: toIsoDate(item.timestamp),
    is_owned_reply: item.is_reply_owned_by_me === true,
    can_reply: item.is_reply_owned_by_me !== true,
    reply_count: item.has_replies ? 1 : 0,
    has_owner_reply: ownedReplyTargets.has(String(item.id)),
  }));
}

export async function fetchThreadsInbox(env) {
  assert(isThreadsConfigured(env), 400, "Threads belum dikonfigurasi.");

  const userId = String(env.THREADS_USER_ID);
  const postLimit = Math.min(Math.max(Number(env.SYNC_POST_LIMIT || 25), 1), 100);
  const postQuery = new URLSearchParams({
    fields: "id,text,timestamp,permalink,username,has_replies,is_reply",
    limit: String(postLimit),
  });
  const media = await fetchCollection(
    `${graphBase(env)}/${encodeURIComponent(userId)}/threads?${postQuery}`,
    env,
    1
  );

  const rootPosts = media.filter((item) => item.is_reply !== true).slice(0, postLimit);
  const posts = await mapWithConcurrency(rootPosts, 4, async (item) => {
    const replyQuery = new URLSearchParams({
      fields:
        "id,text,timestamp,username,permalink,is_reply,is_reply_owned_by_me,has_replies,root_post,replied_to",
      reverse: "false",
      limit: "100",
    });
    const conversation = await fetchCollection(
      `${graphBase(env)}/${encodeURIComponent(item.id)}/conversation?${replyQuery}`,
      env,
      5
    );

    return {
      platform_post_id: String(item.id),
      caption: truncate(item.text || "Threads post", 500),
      permalink: item.permalink || null,
      published_at: toIsoDate(item.timestamp),
      comments: normalizeThreadsConversation(conversation, { postId: item.id }),
    };
  });

  return {
    account: {
      platform: "threads",
      platform_account_id: userId,
      username: env.THREADS_USERNAME || null,
      display_name: env.THREADS_USERNAME || "Threads",
    },
    posts,
  };
}

export async function replyThreads(env, comment, message) {
  assert(isThreadsConfigured(env), 400, "Threads belum dikonfigurasi.");

  const body = new URLSearchParams({
    media_type: "TEXT",
    text: message,
    reply_to_id: String(comment.platform_comment_id),
    auto_publish_text: "true",
  });
  const payload = await fetchJson(
    `${graphBase(env)}/${encodeURIComponent(env.THREADS_USER_ID)}/threads`,
    {
      method: "POST",
      headers: {
        ...authHeaders(env),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    "Threads reply"
  );

  assert(payload?.id, 502, "Threads tidak mengembalikan ID balasan.", payload);
  return { platform_reply_id: String(payload.id), raw: payload };
}
