import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInstagramComment } from "../src/platforms/instagram.js";
import { normalizeThreadsConversation } from "../src/platforms/threads.js";
import { normalizeTikTokComment } from "../src/platforms/tiktok.js";

test("Instagram normalizer detects an owner reply", () => {
  const result = normalizeInstagramComment(
    {
      id: "comment-1",
      text: "Berapa harganya?",
      timestamp: "2026-08-30T03:00:00+0000",
      from: { id: "visitor-1", username: "visitor" },
      replies: {
        data: [
          {
            id: "reply-1",
            from: { id: "pluno-account", username: "pluno" },
          },
        ],
      },
    },
    { accountId: "pluno-account", postId: "post-1" }
  );

  assert.equal(result.platform_comment_id, "comment-1");
  assert.equal(result.author_username, "visitor");
  assert.equal(result.has_owner_reply, true);
  assert.equal(result.is_owned_reply, false);
});

test("Threads normalizer maps nested replies and ownership", () => {
  const result = normalizeThreadsConversation(
    [
      {
        id: "visitor-reply",
        text: "Lokasinya di mana?",
        username: "visitor",
        timestamp: "2026-08-30T03:00:00+0000",
        is_reply_owned_by_me: false,
        replied_to: { id: "root-post" },
      },
      {
        id: "owner-reply",
        text: "Di Jakarta Barat.",
        username: "pluno",
        timestamp: "2026-08-30T03:05:00+0000",
        is_reply_owned_by_me: true,
        replied_to: { id: "visitor-reply" },
      },
    ],
    { postId: "root-post" }
  );

  assert.equal(result[0].has_owner_reply, true);
  assert.equal(result[1].is_owned_reply, true);
  assert.equal(result[0].platform_parent_id, "root-post");
});

test("TikTok normalizer accepts current and legacy response field names", () => {
  const result = normalizeTikTokComment(
    {
      comment_id: "comment-tt",
      comment_text: "Bisa untuk 10 orang?",
      create_time: 1788058800,
      user: { id: "user-tt", username: "visitor_tt" },
      reply_count: 1,
    },
    {
      businessId: "business-tt",
      postId: "video-tt",
      replies: [
        { comment_id: "reply-tt", business_id: "business-tt", text: "Bisa." },
      ],
    }
  );

  assert.equal(result.platform_comment_id, "comment-tt");
  assert.equal(result.author_username, "visitor_tt");
  assert.equal(result.has_owner_reply, true);
  assert.equal(result.reply_count, 1);
});
