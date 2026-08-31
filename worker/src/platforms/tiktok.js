import {
  HttpError,
  assert,
  fetchJson,
  mapWithConcurrency,
  toIsoDate,
  truncate,
} from "../lib/http.js";

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

function headers(env) {
  return {
    "Access-Token": env.TIKTOK_ACCESS_TOKEN,
    "Content-Type": "application/json",
  };
}

async function tiktokRequest(url, env, options = {}, label = "TikTok API") {
  const payload = await fetchJson(
    url,
    {
      ...options,
      headers: {
        ...headers(env),
        ...options.headers,
      },
    },
    label
  );

  if (payload?.code !== undefined && Number(payload.code) !== 0) {
    throw new HttpError(
      502,
      `${label} gagal.`,
      payload.message || payload.code
    );
  }

  return payload;
}

function pickList(data, candidates) {
  for (const key of candidates) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function commentId(item) {
  return item?.comment_id || item?.id;
}

function isOwnedReply(item, businessId) {
  return (
    item?.is_business_account === true ||
    item?.is_author === true ||
    String(item?.business_id || item?.user_id || item?.author?.id || "") ===
      String(businessId)
  );
}

export function isTikTokConfigured(env) {
  return Boolean(env.TIKTOK_ACCESS_TOKEN && env.TIKTOK_BUSINESS_ID);
}

export function normalizeTikTokComment(comment, context) {
  const author = comment?.user || comment?.author || {};
  const replies = context.replies || [];

  return {
    platform_post_id: String(context.postId),
    platform_comment_id: String(commentId(comment)),
    platform_parent_id: comment.parent_comment_id
      ? String(comment.parent_comment_id)
      : null,
    author_platform_id: author.id || comment.user_id
      ? String(author.id || comment.user_id)
      : null,
    author_username:
      author.username ||
      comment.username ||
      comment.user_name ||
      comment.unique_id ||
      null,
    author_name:
      author.display_name || comment.display_name || comment.nickname || null,
    message: String(comment.text || comment.comment_text || ""),
    commented_at: toIsoDate(
      comment.create_time || comment.created_at || comment.comment_time
    ),
    is_owned_reply: isOwnedReply(comment, context.businessId),
    can_reply: comment.status !== "HIDDEN" && comment.is_hidden !== true,
    reply_count: Number(comment.reply_count || replies.length || 0),
    has_owner_reply: replies.some((reply) =>
      isOwnedReply(reply, context.businessId)
    ),
  };
}

async function fetchTikTokReplies(env, videoId, comment) {
  const count = Number(comment.reply_count || 0);
  if (count <= 0) return [];

  const query = new URLSearchParams({
    business_id: String(env.TIKTOK_BUSINESS_ID),
    video_id: String(videoId),
    comment_id: String(commentId(comment)),
    status: "ALL",
    page_size: "100",
  });
  const payload = await tiktokRequest(
    `${TIKTOK_API}/business/comment/reply/list/?${query}`,
    env,
    { method: "GET" },
    "TikTok comment replies"
  );

  return pickList(payload.data, ["replies", "comments", "list", "reply_list"]);
}

export async function fetchTikTokInbox(env) {
  assert(isTikTokConfigured(env), 400, "TikTok belum dikonfigurasi.");

  const businessId = String(env.TIKTOK_BUSINESS_ID);
  const username = env.TIKTOK_USERNAME || "";
  const postLimit = Math.min(Math.max(Number(env.SYNC_POST_LIMIT || 25), 1), 100);
  const videoQuery = new URLSearchParams({
    business_id: businessId,
    fields: JSON.stringify([
      "item_id",
      "caption",
      "create_time",
      "comments",
    ]),
  });
  const videoPayload = await tiktokRequest(
    `${TIKTOK_API}/business/video/list/?${videoQuery}`,
    env,
    { method: "GET" },
    "TikTok video list"
  );
  const videos = pickList(videoPayload.data, [
    "videos",
    "video_list",
    "list",
    "items",
  ]).slice(0, postLimit);

  const posts = await mapWithConcurrency(videos, 3, async (video) => {
    const videoId = String(video.item_id || video.video_id || video.id);
    const commentQuery = new URLSearchParams({
      business_id: businessId,
      video_id: videoId,
      status: "PUBLIC",
      page_size: "100",
    });
    const commentPayload = await tiktokRequest(
      `${TIKTOK_API}/business/comment/list/?${commentQuery}`,
      env,
      { method: "GET" },
      "TikTok comment list"
    );
    const rawComments = pickList(commentPayload.data, [
      "comments",
      "comment_list",
      "list",
      "items",
    ]);
    const withReplies = await mapWithConcurrency(rawComments, 4, async (comment) => ({
      comment,
      replies: await fetchTikTokReplies(env, videoId, comment),
    }));

    return {
      platform_post_id: videoId,
      caption: truncate(video.caption || video.text || "TikTok post", 500),
      permalink: username
        ? `https://www.tiktok.com/@${username.replace(/^@/, "")}/video/${videoId}`
        : null,
      published_at: toIsoDate(video.create_time || video.created_at),
      comments: withReplies.map(({ comment, replies }) =>
        normalizeTikTokComment(comment, {
          businessId,
          postId: videoId,
          replies,
        })
      ),
    };
  });

  return {
    account: {
      platform: "tiktok",
      platform_account_id: businessId,
      username: username || null,
      display_name: username || "TikTok",
    },
    posts,
  };
}

export async function replyTikTok(env, comment, message) {
  assert(isTikTokConfigured(env), 400, "TikTok belum dikonfigurasi.");

  const payload = await tiktokRequest(
    `${TIKTOK_API}/business/comment/reply/create/`,
    env,
    {
      method: "POST",
      body: JSON.stringify({
        business_id: String(env.TIKTOK_BUSINESS_ID),
        video_id: String(comment.platform_post_id),
        comment_id: String(comment.platform_comment_id),
        text: message,
      }),
    },
    "TikTok reply"
  );
  const replyId =
    payload?.data?.comment_id || payload?.data?.reply_id || payload?.data?.id;

  assert(replyId, 502, "TikTok tidak mengembalikan ID balasan.", payload);
  return { platform_reply_id: String(replyId), raw: payload };
}
