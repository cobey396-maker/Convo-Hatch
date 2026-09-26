import { startConversation } from "@/lib/conversations";
import { parseWidgetPost, respond, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Starts a chat for a client. Body: { publicId } */
export async function POST(request: Request) {
  const parsed = await parseWidgetPost(request, 1_000);
  if (!parsed.ok) return parsed.response;
  try {
    return respond(await startConversation(parsed.deps, { publicId: parsed.body.publicId, visitor: parsed.visitor }));
  } catch (error) {
    return serverError("conversations", error);
  }
}
