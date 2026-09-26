import { NextResponse } from "next/server";
import { generateReply, isAiConfigured, parseHistory } from "@/lib/site-assistant/ai";
import { allowRequest } from "@/lib/site-assistant/rate-limit";
import { containsPersonalDetails } from "@/lib/site-assistant/scripted";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 20_000;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Tells the widget whether AI replies are available. The widget uses scripted replies otherwise. */
export function GET() {
  return json({ ai: isAiConfigured() });
}

export async function POST(request: Request) {
  if (!isAiConfigured()) return json({ error: "unavailable" }, 503);

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: "forbidden" }, 403);
    } catch {
      return json({ error: "forbidden" }, 403);
    }
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const history = parseHistory((body as { messages?: unknown } | null)?.messages);
  if (!history) return json({ error: "invalid" }, 400);

  // Personal details are handled in the browser and never need to reach the model.
  if (history.some((turn) => turn.role === "user" && containsPersonalDetails(turn.content))) {
    return json({ error: "personal_details" }, 400);
  }

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRequest(visitor)) return json({ error: "rate_limited" }, 429);

  const result = await generateReply(history);
  if (!result.ok) {
    // Diagnostics only. Never log the conversation.
    console.error("[assistant] AI reply unavailable", { reason: result.reason });
    return json({ error: "ai_failed" }, 502);
  }

  return json({ reply: result.text });
}
