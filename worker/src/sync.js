import { HttpError, mapWithConcurrency } from "./lib/http.js";
import {
  fetchInstagramInbox,
  isInstagramConfigured,
  replyInstagram,
} from "./platforms/instagram.js";
import {
  fetchThreadsInbox,
  isThreadsConfigured,
  replyThreads,
} from "./platforms/threads.js";
import {
  fetchTikTokInbox,
  isTikTokConfigured,
  replyTikTok,
} from "./platforms/tiktok.js";

const ADAPTERS = {
  instagram: {
    configured: isInstagramConfigured,
    fetchInbox: fetchInstagramInbox,
    reply: replyInstagram,
  },
  threads: {
    configured: isThreadsConfigured,
    fetchInbox: fetchThreadsInbox,
    reply: replyThreads,
  },
  tiktok: {
    configured: isTikTokConfigured,
    fetchInbox: fetchTikTokInbox,
    reply: replyTikTok,
  },
};

export const SOCIAL_PLATFORMS = Object.freeze(Object.keys(ADAPTERS));

export function getIntegrationConfig(env) {
  return SOCIAL_PLATFORMS.map((platform) => ({
    platform,
    configured: ADAPTERS[platform].configured(env),
    account_id:
      platform === "instagram"
        ? env.INSTAGRAM_ACCOUNT_ID || null
        : platform === "threads"
          ? env.THREADS_USER_ID || null
          : env.TIKTOK_BUSINESS_ID || null,
    username:
      platform === "instagram"
        ? env.INSTAGRAM_USERNAME || null
        : platform === "threads"
          ? env.THREADS_USERNAME || null
          : env.TIKTOK_USERNAME || null,
  }));
}

function errorDetails(error) {
  if (typeof error?.details === "string") return error.details;
  if (error?.details) return JSON.stringify(error.details).slice(0, 1800);
  return String(error?.message || error || "Unknown sync error").slice(0, 1800);
}

export async function syncPlatform(
  env,
  database,
  platform,
  { triggerSource = "manual", userId = null } = {}
) {
  const adapter = ADAPTERS[platform];

  if (!adapter) {
    throw new HttpError(400, `Platform ${platform} tidak dikenali.`);
  }

  if (!adapter.configured(env)) {
    throw new HttpError(400, `${platform} belum dikonfigurasi.`);
  }

  const run = await database.insert("social_sync_runs", {
    platform,
    trigger_source: triggerSource,
    status: "running",
    triggered_by: userId,
  });

  try {
    const inbox = await adapter.fetchInbox(env);
    const account = await database.upsert(
      "social_accounts",
      {
        ...inbox.account,
        enabled: true,
        last_sync_at: new Date().toISOString(),
        last_sync_status: "running",
        last_sync_error: null,
      },
      "platform,platform_account_id"
    );

    if (!account?.id) {
      throw new Error("Supabase tidak mengembalikan social account ID.");
    }

    let commentCount = 0;

    await mapWithConcurrency(inbox.posts || [], 3, async (post) => {
      const postRecord = await database.upsert(
        "social_posts",
        {
          account_id: account.id,
          platform,
          platform_post_id: post.platform_post_id,
          caption: post.caption || null,
          permalink: post.permalink || null,
          published_at: post.published_at || null,
          last_synced_at: new Date().toISOString(),
        },
        "platform,platform_post_id"
      );

      if (!postRecord?.id) {
        throw new Error(`Supabase tidak mengembalikan post ID ${post.platform_post_id}.`);
      }

      await mapWithConcurrency(post.comments || [], 6, async (comment) => {
        if (!comment.platform_comment_id) return;

        await database.rpc("upsert_social_inbox_comment", {
          p_payload: {
            ...comment,
            account_id: account.id,
            post_id: postRecord.id,
            platform,
          },
        });
        commentCount += 1;
      });
    });

    const finishedAt = new Date().toISOString();

    await database.update(
      "social_accounts",
      { id: `eq.${account.id}` },
      {
        last_sync_at: finishedAt,
        last_sync_status: "success",
        last_sync_error: null,
      }
    );
    await database.update(
      "social_sync_runs",
      { id: `eq.${run.id}` },
      {
        status: "success",
        posts_count: inbox.posts?.length || 0,
        comments_count: commentCount,
        finished_at: finishedAt,
      }
    );

    return {
      platform,
      ok: true,
      posts: inbox.posts?.length || 0,
      comments: commentCount,
      finished_at: finishedAt,
    };
  } catch (error) {
    const details = errorDetails(error);
    const finishedAt = new Date().toISOString();

    await database.update(
      "social_sync_runs",
      { id: `eq.${run.id}` },
      {
        status: "failed",
        error_message: details,
        finished_at: finishedAt,
      }
    ).catch(() => null);

    const accountId =
      platform === "instagram"
        ? env.INSTAGRAM_ACCOUNT_ID
        : platform === "threads"
          ? env.THREADS_USER_ID
          : env.TIKTOK_BUSINESS_ID;

    if (accountId) {
      await database.update(
        "social_accounts",
        {
          platform: `eq.${platform}`,
          platform_account_id: `eq.${accountId}`,
        },
        {
          last_sync_at: finishedAt,
          last_sync_status: "failed",
          last_sync_error: details,
        }
      ).catch(() => null);
    }

    return {
      platform,
      ok: false,
      error: error.message || "Sync gagal.",
      details,
      finished_at: finishedAt,
    };
  }
}

export async function syncPlatforms(
  env,
  database,
  requestedPlatform = "all",
  options = {}
) {
  const integrations = getIntegrationConfig(env);
  const selected = integrations.filter(
    (item) =>
      item.configured &&
      (requestedPlatform === "all" || item.platform === requestedPlatform)
  );

  if (selected.length === 0) {
    throw new HttpError(
      400,
      requestedPlatform === "all"
        ? "Belum ada platform Social Media yang dikonfigurasi."
        : `${requestedPlatform} belum dikonfigurasi.`
    );
  }

  return Promise.all(
    selected.map((item) =>
      syncPlatform(env, database, item.platform, options)
    )
  );
}

export async function sendPlatformReply(env, comment, message) {
  const adapter = ADAPTERS[comment.platform];

  if (!adapter) {
    throw new HttpError(400, `Platform ${comment.platform} tidak didukung.`);
  }

  return adapter.reply(env, comment, message);
}
