// Server-only: widget conversations. Every lookup is scoped to the client resolved from the
// public ID, so a conversation from one client can never be read or continued through another.

import {
  approvedInfoReply,
  contactDetailsReply,
  emergencyReply,
  findZip,
  guardAiReply,
  isEmergency,
  isRepairInstructionRequest,
  isServiceAreaOnly,
  redactContactDetails,
  repairReply,
  serviceAreaReply,
  unknownReply,
  type Reply,
} from "./answers.ts";
import { buildBusinessFacts, buildSystemPrompt, type ChatTurn } from "./ai.ts";
import { getActiveClient } from "./clients.ts";
import type { StoredClient } from "./config.ts";
import { HISTORY_FOR_AI, MAX_MESSAGE_CHARS, WINDOWS, clientLimit, consume, widgetLimits } from "./limits.ts";
import type { WidgetDeps } from "./deps.ts";

export type Failure = { ok: false; status: number; error: string; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function notFound(): Failure {
  return { ok: false, status: 404, error: "not_found" };
}

export function rateLimited(message = "You’re sending messages too quickly. Please wait a few minutes and try again."): Failure {
  return { ok: false, status: 429, error: "rate_limited", message };
}

/** The conversation, only if it belongs to this client. */
export async function findConversation(deps: WidgetDeps, client: StoredClient, conversationId: unknown) {
  if (typeof conversationId !== "string" || !UUID.test(conversationId)) return null;
  const rows = await deps.db.query<{ id: string; visitor_message_count: number }>(
    "SELECT id, visitor_message_count FROM conversations WHERE id = $1 AND client_id = $2",
    [conversationId, client.id],
  );
  return rows[0] ?? null;
}

export async function startConversation(
  deps: WidgetDeps,
  input: { publicId: unknown; visitor: string },
): Promise<{ ok: true; conversationId: string } | Failure> {
  const client = typeof input.publicId === "string" ? await getActiveClient(deps.db, input.publicId) : null;
  if (!client) return notFound();
  const now = deps.now();

  if (!(await consume(deps.db, `v:${input.visitor}:${client.id}:conv`, WINDOWS.hour, widgetLimits().visitorConversationsPerHour, now))) {
    return rateLimited("Too many chats were started from your connection. Please try again later.");
  }
  if (!(await consume(deps.db, `c:${client.id}:conv`, WINDOWS.day, clientLimit(client, "dailyConversations"), now))) {
    return {
      ok: false,
      status: 429,
      error: "client_busy",
      message: `The chat is unavailable right now.${client.profile.contact.phone ? ` You can call ${client.businessName} at ${client.profile.contact.phone}.` : ""}`,
    };
  }

  const rows = await deps.db.query<{ id: string }>(
    "INSERT INTO conversations (client_id, created_at, last_message_at) VALUES ($1, $2, $2) RETURNING id",
    [client.id, now],
  );
  return { ok: true, conversationId: rows[0].id };
}

export interface MessageResult {
  ok: true;
  reply: Reply;
  /** Whether live AI answers are currently available for this chat. */
  aiAvailable: boolean;
  /** The conversation hit its message limit; the widget should offer only the callback form. */
  conversationClosed?: boolean;
}

async function recentHistory(deps: WidgetDeps, conversationId: string): Promise<ChatTurn[]> {
  const rows = await deps.db.query<ChatTurn>(
    `SELECT role, content FROM (
       SELECT id, role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2
     ) recent ORDER BY id`,
    [conversationId, HISTORY_FOR_AI],
  );
  while (rows.length && rows[0].role !== "user") rows.shift();
  return rows;
}

function fallbackReply(client: StoredClient, text: string, aiUnavailable: boolean): Reply {
  return approvedInfoReply(client, text) ?? unknownReply(client, aiUnavailable);
}

export async function sendMessage(
  deps: WidgetDeps,
  input: { publicId: unknown; conversationId: unknown; message: unknown; visitor: string },
): Promise<MessageResult | Failure> {
  const text = typeof input.message === "string" ? input.message.trim() : "";
  if (!text) return { ok: false, status: 400, error: "empty" };
  if (text.length > MAX_MESSAGE_CHARS) {
    return { ok: false, status: 400, error: "too_long", message: `Please keep messages under ${MAX_MESSAGE_CHARS} characters.` };
  }

  const client = typeof input.publicId === "string" ? await getActiveClient(deps.db, input.publicId) : null;
  if (!client) return notFound();
  const conversation = await findConversation(deps, client, input.conversationId);
  if (!conversation) return notFound();
  const now = deps.now();
  const limits = widgetLimits();

  if (!(await consume(deps.db, `v:${input.visitor}:${client.id}:msg`, WINDOWS.tenMinutes, limits.visitorMessagesPer10Min, now))) {
    return rateLimited();
  }

  const counted = await deps.db.query<{ visitor_message_count: number }>(
    `UPDATE conversations SET visitor_message_count = visitor_message_count + 1, last_message_at = $3
     WHERE id = $1 AND client_id = $2 RETURNING visitor_message_count`,
    [conversation.id, client.id, now],
  );
  if (Number(counted[0].visitor_message_count) > clientLimit(client, "maxVisitorMessagesPerConversation")) {
    return {
      ok: true,
      aiAvailable: deps.ai !== null,
      conversationClosed: true,
      reply: {
        text: `This chat has reached its message limit. If you’d like ${client.businessName} to follow up, please send a callback request.`,
        source: "limit",
        suggestCallback: true,
      },
    };
  }

  // Contact details are removed before anything is stored or sent to the AI model.
  const { text: safeText, redacted } = redactContactDetails(text);
  await deps.db.query(
    "INSERT INTO conversation_messages (conversation_id, role, content, created_at) VALUES ($1, 'user', $2, $3)",
    [conversation.id, safeText, now],
  );

  let aiAvailable = deps.ai !== null;
  let reply: Reply;
  const zip = findZip(safeText);

  if (isEmergency(safeText)) {
    reply = emergencyReply(client);
  } else if (redacted) {
    reply = contactDetailsReply(client);
  } else if (isRepairInstructionRequest(safeText)) {
    reply = repairReply(client);
  } else if (zip && isServiceAreaOnly(safeText)) {
    reply = serviceAreaReply(client, zip);
  } else if (!deps.ai) {
    reply = zip ? serviceAreaReply(client, zip) : fallbackReply(client, safeText, true);
  } else if (
    !(await consume(deps.db, `c:${client.id}:ai`, WINDOWS.day, clientLimit(client, "dailyAiReplies"), now)) ||
    !(await consume(deps.db, "global:ai", WINDOWS.day, limits.globalDailyAiReplies, now))
  ) {
    // Usage cap reached: keep helping with approved answers, and say live AI is unavailable.
    aiAvailable = false;
    reply = zip ? serviceAreaReply(client, zip) : fallbackReply(client, safeText, true);
  } else {
    const zipReply = zip ? serviceAreaReply(client, zip) : null;
    const result = await deps.ai({
      system: buildSystemPrompt(client),
      note: zipReply
        ? `The visitor's message includes ZIP code ${zip}. The website has already shown them this service-area result: "${zipReply.text}" Don't repeat or contradict it, and don't mention ZIP codes; answer only the rest of their message.`
        : undefined,
      history: await recentHistory(deps, conversation.id),
    });
    const guard = result.ok ? guardAiReply(result.text, buildBusinessFacts(client)) : null;

    if (result.ok && guard?.ok) {
      reply = {
        text: zipReply ? `${zipReply.text} ${result.text}` : result.text,
        source: "ai",
        suggestCallback: zipReply ? true : undefined,
      };
    } else {
      // Diagnostics only: a reason code, never the conversation.
      const reason = result.ok ? `guard_${guard && !guard.ok ? guard.reason : "unknown"}` : result.reason;
      console.error("[widget] AI reply not used", { client: client.publicId, reason });
      reply = zipReply ?? fallbackReply(client, safeText, false);
    }
  }

  await deps.db.query(
    "INSERT INTO conversation_messages (conversation_id, role, content, source, created_at) VALUES ($1, 'assistant', $2, $3, $4)",
    [conversation.id, reply.text, reply.source, now],
  );
  return { ok: true, reply, aiAvailable };
}
