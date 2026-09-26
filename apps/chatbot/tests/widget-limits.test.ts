import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import { upsertClient } from "../lib/clients.ts";
import { sendMessage, startConversation } from "../lib/conversations.ts";
import { submitLead } from "../lib/leads.ts";
import { consume, visitorKey } from "../lib/limits.ts";
import { purgeExpired } from "../lib/retention.ts";
import { clientConfig, idempotencyKey, setup, validLead, type Fixture } from "./widget-fixtures.ts";

let f: Fixture;
before(async () => {
  f = await setup();
});
after(async () => {
  await f.db.close();
});

const ENV_KEYS = [
  "WIDGET_VISITOR_MESSAGES_PER_10_MIN",
  "WIDGET_VISITOR_CONVERSATIONS_PER_HOUR",
  "WIDGET_VISITOR_LEADS_PER_HOUR",
  "WIDGET_MAX_MESSAGES_PER_CONVERSATION",
  "WIDGET_GLOBAL_DAILY_AI_REPLIES",
];
afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

async function freshClient(publicId: string, limits = {}) {
  return upsertClient(f.db, clientConfig({ publicId, businessName: `Client ${publicId}`, limits }));
}

async function start(publicId: string, visitor: string) {
  const result = await startConversation(f.deps(), { publicId, visitor });
  assert.ok(result.ok, JSON.stringify(result));
  return result.conversationId;
}

test("fixed-window counters allow up to the limit, then block, then reset", async () => {
  const now = new Date("2026-09-28T15:00:00Z");
  assert.equal(await consume(f.db, "test:window", 60_000, 2, now), true);
  assert.equal(await consume(f.db, "test:window", 60_000, 2, now), true);
  assert.equal(await consume(f.db, "test:window", 60_000, 2, now), false);
  assert.equal(await consume(f.db, "test:window", 60_000, 2, new Date(now.getTime() + 60_000)), true);
  assert.equal(await consume(f.db, "test:zero", 60_000, 0, now), false);
});

test("visitor IP addresses are hashed, not stored", () => {
  const key = visitorKey("203.0.113.9");
  assert.doesNotMatch(key, /203/);
  assert.equal(key, visitorKey("203.0.113.9"));
  assert.notEqual(key, visitorKey("203.0.113.10"));
});

test("per-visitor message rate limit", async () => {
  process.env.WIDGET_VISITOR_MESSAGES_PER_10_MIN = "3";
  await freshClient("rate-messages");
  const conversationId = await start("rate-messages", "busy-visitor");
  const statuses: (number | "ok")[] = [];
  for (let index = 0; index < 5; index += 1) {
    const result = await sendMessage(f.deps(), { publicId: "rate-messages", conversationId, message: "hours?", visitor: "busy-visitor" });
    statuses.push(result.ok ? "ok" : result.status);
  }
  assert.deepEqual(statuses, ["ok", "ok", "ok", 429, 429]);

  // Another visitor isn't affected.
  const other = await start("rate-messages", "calm-visitor");
  const result = await sendMessage(f.deps(), { publicId: "rate-messages", conversationId: other, message: "hours?", visitor: "calm-visitor" });
  assert.ok(result.ok);
});

test("per-visitor conversation and lead limits", async () => {
  process.env.WIDGET_VISITOR_CONVERSATIONS_PER_HOUR = "2";
  process.env.WIDGET_VISITOR_LEADS_PER_HOUR = "1";
  await freshClient("rate-conversations");
  await start("rate-conversations", "starter");
  const conversationId = await start("rate-conversations", "starter");
  const third = await startConversation(f.deps(), { publicId: "rate-conversations", visitor: "starter" });
  assert.equal(!third.ok && third.status, 429);

  const body = () => ({ confirmed: true, idempotencyKey: idempotencyKey(), lead: validLead({ email: `${Math.random()}@example.com` }) });
  const first = await submitLead(f.deps(), { publicId: "rate-conversations", conversationId, visitor: "starter", body: body() });
  assert.ok(first.ok);
  const second = await submitLead(f.deps(), { publicId: "rate-conversations", conversationId, visitor: "starter", body: body() });
  assert.equal(!second.ok && second.status, 429);
});

test("conversation length limit ends the chat and offers a callback", async () => {
  process.env.WIDGET_MAX_MESSAGES_PER_CONVERSATION = "2";
  await freshClient("short-chats");
  const conversationId = await start("short-chats", "talker");
  f.ai.requests.length = 0;
  const replies = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await sendMessage(f.deps(), { publicId: "short-chats", conversationId, message: "Tell me more", visitor: "talker" });
    assert.ok(result.ok);
    replies.push(result);
  }
  assert.equal(replies[2].conversationClosed, true);
  assert.equal(replies[2].reply.source, "limit");
  assert.equal(f.ai.requests.length, 2, "no AI call once the limit is reached");
});

test("a client's daily AI cap switches to approved answers and reports AI as unavailable", async () => {
  await freshClient("ai-capped", { dailyAiReplies: 1 });
  const conversationId = await start("ai-capped", "capper");
  f.ai.requests.length = 0;
  const first = await sendMessage(f.deps(), { publicId: "ai-capped", conversationId, message: "Tell me about you", visitor: "capper" });
  const second = await sendMessage(f.deps(), { publicId: "ai-capped", conversationId, message: "Do you offer free estimates?", visitor: "capper" });
  assert.ok(first.ok && second.ok);
  assert.equal(first.reply.source, "ai");
  assert.equal(second.reply.source, "faq");
  assert.equal(second.aiAvailable, false);
  assert.equal(f.ai.requests.length, 1);

  // The cap is per client: another client still gets AI replies.
  const other = await start("alpha-heating", "capper-2");
  const third = await sendMessage(f.deps(), { publicId: "alpha-heating", conversationId: other, message: "Tell me about you", visitor: "capper-2" });
  assert.ok(third.ok && third.reply.source === "ai");
});

test("the global daily AI cap limits spend across every client", async () => {
  process.env.WIDGET_GLOBAL_DAILY_AI_REPLIES = "0";
  f.ai.requests.length = 0;
  const conversationId = await start("alpha-heating", "global-cap");
  const result = await sendMessage(f.deps(), { publicId: "alpha-heating", conversationId, message: "Tell me about you", visitor: "global-cap" });
  assert.ok(result.ok);
  assert.equal(result.aiAvailable, false);
  assert.equal(f.ai.requests.length, 0);
});

test("a client's daily conversation and lead caps", async () => {
  await freshClient("daily-caps", { dailyConversations: 1, dailyLeads: 1 });
  const conversationId = await start("daily-caps", "cap-a");
  const blocked = await startConversation(f.deps(), { publicId: "daily-caps", visitor: "cap-b" });
  assert.equal(!blocked.ok && blocked.error, "client_busy");
  assert.match(!blocked.ok ? blocked.message ?? "" : "", /call Client daily-caps at \(555\) 010-0111/);

  const lead = (email: string) => ({ confirmed: true, idempotencyKey: idempotencyKey(), lead: validLead({ email }) });
  const first = await submitLead(f.deps(), { publicId: "daily-caps", conversationId, visitor: "cap-a", body: lead("one@example.com") });
  assert.ok(first.ok);
  const second = await submitLead(f.deps(), { publicId: "daily-caps", conversationId, visitor: "cap-a", body: lead("two@example.com") });
  assert.equal(!second.ok && second.error, "client_lead_limit");
});

test("retention purge deletes old chats and leads but keeps recent ones", async () => {
  await freshClient("retention");
  const oldConversation = await start("retention", "old");
  const newConversation = await start("retention", "new");
  const old = new Date("2026-01-01T00:00:00Z");
  await f.db.query("UPDATE conversations SET last_message_at = $2 WHERE id = $1", [oldConversation, old]);
  const result = await purgeExpired(f.db, new Date("2026-09-28T15:00:00Z"));
  assert.ok(result.conversations >= 1);
  const remaining = await f.db.query<{ id: string }>("SELECT id FROM conversations WHERE id = ANY($1::uuid[])", [[oldConversation, newConversation]]);
  assert.deepEqual(remaining.map((row) => row.id), [newConversation]);
});
