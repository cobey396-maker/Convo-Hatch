import { NextResponse } from "next/server";
import { DeliveryError, deliverDemoRequest, getDeliveryProvider } from "@/lib/delivery";
import { hasErrors, normalizeDemoRequest, validateDemoRequest } from "@/lib/demo-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_000;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Lets the form know whether submissions can be delivered. Reveals nothing about the configuration. */
export function GET() {
  return json({ available: getDeliveryProvider() !== null });
}

export async function POST(request: Request) {
  const provider = getDeliveryProvider();
  if (!provider) {
    return json({ ok: false, error: "unavailable" }, 503);
  }

  // Basic same-origin check: browsers always send Origin on cross-site POSTs.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ ok: false, error: "forbidden" }, 403);
    } catch {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Spam trap filled in: reject without delivering, and without claiming success.
  const trap = (body as Record<string, unknown> | null)?.company_fax;
  if (typeof trap === "string" && trap.trim() !== "") {
    return json({ ok: false, error: "rejected" }, 400);
  }

  const input = normalizeDemoRequest(body);
  const errors = validateDemoRequest(input);
  if (hasErrors(errors)) {
    return json({ ok: false, error: "invalid", errors }, 422);
  }

  try {
    await deliverDemoRequest(provider, input);
  } catch (error) {
    // Log only non-personal diagnostics. Never log the submitted fields.
    console.error("[demo-request] delivery failed", {
      provider,
      status: error instanceof DeliveryError ? error.status : "unknown",
    });
    return json({ ok: false, error: "delivery_failed" }, 502);
  }

  return json({ ok: true });
}
