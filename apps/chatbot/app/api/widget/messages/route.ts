import { sendMessage } from "@/lib/conversations";
import { parseWidgetPost, respond, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sends one visitor message and returns the reply. Body: { publicId, conversationId, message } */
export async function POST(request: Request) {
  const parsed = await parseWidgetPost(request, 4_000);
  if (!parsed.ok) return parsed.response;
  const { publicId, conversationId, message } = parsed.body;
  try {
    return respond(await sendMessage(parsed.deps, { publicId, conversationId, message, visitor: parsed.visitor }));
  } catch (error) {
    return serverError("messages", error);
  }
}
