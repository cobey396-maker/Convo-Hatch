// Server-only: deletes old widget data. Run on a schedule (see docs/widget.md).

import type { Db } from "./db.ts";

function days(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function retentionSettings() {
  return {
    conversationDays: days("WIDGET_CONVERSATION_RETENTION_DAYS", 30),
    leadDays: days("WIDGET_LEAD_RETENTION_DAYS", 365),
  };
}

/** Deletes chats and leads past their retention period, plus expired usage counters. */
export async function purgeExpired(db: Db, now = new Date()) {
  const { conversationDays, leadDays } = retentionSettings();
  const conversationCutoff = new Date(now.getTime() - conversationDays * 86_400_000);
  const leadCutoff = new Date(now.getTime() - leadDays * 86_400_000);
  const counterCutoff = new Date(now.getTime() - 2 * 86_400_000);

  // Deleting a conversation deletes its messages; leads keep their details but lose the chat link.
  const conversations = await db.query("DELETE FROM conversations WHERE last_message_at < $1 RETURNING id", [conversationCutoff]);
  const leads = await db.query("DELETE FROM leads WHERE created_at < $1 RETURNING id", [leadCutoff]);
  const counters = await db.query("DELETE FROM usage_counters WHERE window_start < $1 RETURNING scope", [counterCutoff]);
  return { conversations: conversations.length, leads: leads.length, counters: counters.length };
}
