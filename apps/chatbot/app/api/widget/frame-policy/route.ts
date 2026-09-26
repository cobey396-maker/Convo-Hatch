import { getActiveClient } from "@/lib/clients";
import { depsOrNull, json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Which websites may embed a client's widget. Used by middleware.ts to set the widget page's
 * Content-Security-Policy frame-ancestors header. These origins are visible in that header anyway.
 */
export async function GET(request: Request) {
  const publicId = new URL(request.url).searchParams.get("client") ?? "";
  const deps = await depsOrNull();
  if (!deps) return json({ origins: [] }, 503);
  try {
    const client = await getActiveClient(deps.db, publicId);
    return json({ origins: client?.allowedOrigins ?? [] }, client ? 200 : 404);
  } catch {
    return json({ origins: [] }, 500);
  }
}
