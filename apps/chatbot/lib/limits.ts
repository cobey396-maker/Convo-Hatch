// Server-only: rate limits and usage caps for the hosted widget.
// Counters live in the database, so every server instance shares them. Environment variables set
// the defaults; a client's `limits` setting overrides the per-client daily caps.

import { createHash } from "node:crypto";
import type { StoredClient } from "./config.ts";
import type { Db } from "./db.ts";

export const MAX_MESSAGE_CHARS = 500;
export const HISTORY_FOR_AI = 12;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** Current limits. Read on every call so tests and config changes take effect without a restart. */
export function widgetLimits() {
  return {
    // Per visitor (hashed IP address) per client.
    visitorMessagesPer10Min: envInt("WIDGET_VISITOR_MESSAGES_PER_10_MIN", 20),
    visitorConversationsPerHour: envInt("WIDGET_VISITOR_CONVERSATIONS_PER_HOUR", 10),
    visitorLeadsPerHour: envInt("WIDGET_VISITOR_LEADS_PER_HOUR", 5),
    // Per conversation.
    maxVisitorMessagesPerConversation: envInt("WIDGET_MAX_MESSAGES_PER_CONVERSATION", 30),
    // Per client per UTC day.
    dailyConversations: envInt("WIDGET_CLIENT_DAILY_CONVERSATIONS", 500),
    dailyAiReplies: envInt("WIDGET_CLIENT_DAILY_AI_REPLIES", 400),
    dailyLeads: envInt("WIDGET_CLIENT_DAILY_LEADS", 100),
    // Across every client per UTC day: a hard ceiling on AI spend.
    globalDailyAiReplies: envInt("WIDGET_GLOBAL_DAILY_AI_REPLIES", 2000),
  };
}

export function clientLimit(
  client: StoredClient,
  key: "dailyConversations" | "dailyAiReplies" | "dailyLeads" | "maxVisitorMessagesPerConversation",
): number {
  return client.limits[key] ?? widgetLimits()[key];
}

/**
 * Hashes a visitor's IP address so raw addresses are never stored. Set WIDGET_HASH_SECRET in
 * production; the fallback keeps local development working.
 */
export function visitorKey(ip: string): string {
  const secret = process.env.WIDGET_HASH_SECRET?.trim() || "convohatch-dev-only";
  return createHash("sha256").update(`${secret}:${ip}`).digest("base64url").slice(0, 22);
}

export function ipFromHeaders(headers: Headers): string {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/**
 * Counts one use in a fixed time window and reports whether it's within `limit`.
 * A limit of 0 blocks everything.
 */
export async function consume(db: Db, scope: string, windowMs: number, limit: number, now = new Date()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const rows = await db.query<{ count: number }>(
    `INSERT INTO usage_counters (scope, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (scope, window_start) DO UPDATE SET count = usage_counters.count + 1
     RETURNING count`,
    [scope, windowStart],
  );
  return Number(rows[0].count) <= limit;
}

export const WINDOWS = { tenMinutes: 10 * MINUTE, hour: HOUR, day: DAY } as const;
