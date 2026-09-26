import { json, parseWidgetPost, respond, serverError } from "@/lib/http";
import { submitLead } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stores a reviewed service request, then attempts the email notification.
 * Body: { publicId, conversationId, idempotencyKey, confirmed: true, lead: {...} }
 */
export async function POST(request: Request) {
  const parsed = await parseWidgetPost(request, 6_000);
  if (!parsed.ok) return parsed.response;
  const { publicId, conversationId } = parsed.body;
  try {
    const result = await submitLead(parsed.deps, { publicId, conversationId, body: parsed.body, visitor: parsed.visitor });
    if (!result.ok) return respond(result);
    // The notification outcome stays on the server: the visitor is told the request was received,
    // never that an email was delivered.
    return json({ ok: true, reference: result.reference, duplicate: result.duplicate, inServiceArea: result.inServiceArea });
  } catch (error) {
    return serverError("leads", error);
  }
}
