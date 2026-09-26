import { parseWidgetPost, respond, serverError } from "@/lib/http";
import { checkServiceArea } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Checks a ZIP code against the client's service area. Body: { publicId, zip } */
export async function POST(request: Request) {
  const parsed = await parseWidgetPost(request, 500);
  if (!parsed.ok) return parsed.response;
  try {
    return respond(await checkServiceArea(parsed.deps, { publicId: parsed.body.publicId, zip: parsed.body.zip, visitor: parsed.visitor }));
  } catch (error) {
    return serverError("service-area", error);
  }
}
