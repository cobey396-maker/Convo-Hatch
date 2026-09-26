// Server-only: request handling shared by the widget API routes.

import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError } from "./db.ts";
import { defaultDeps, type WidgetDeps } from "./deps.ts";
import { ipFromHeaders, visitorKey } from "./limits.ts";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * The widget's API is only called from the widget page, which is served from this app's own
 * origin inside the iframe. Browsers always send Origin on cross-site POSTs, so this blocks other
 * websites from calling the API directly from a visitor's browser. (It doesn't stop scripts
 * outside a browser; the rate limits and caps handle those.)
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type Parsed =
  | { ok: true; body: Record<string, unknown>; deps: WidgetDeps; visitor: string }
  | { ok: false; response: NextResponse };

/** Common checks for a widget POST: origin, content type, size, JSON, and database availability. */
export async function parseWidgetPost(request: Request, maxBytes: number): Promise<Parsed> {
  if (!isSameOrigin(request)) return { ok: false, response: json({ error: "forbidden" }, 403) };
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, response: json({ error: "unsupported_media_type" }, 415) };
  }
  const raw = await request.text();
  if (raw.length > maxBytes) return { ok: false, response: json({ error: "too_large" }, 413) };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, response: json({ error: "invalid_json" }, 400) };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, response: json({ error: "invalid" }, 400) };

  const deps = await depsOrNull();
  if (!deps) return { ok: false, response: unavailable() };
  return { ok: true, body: body as Record<string, unknown>, deps, visitor: visitorKey(ipFromHeaders(request.headers)) };
}

export async function depsOrNull(): Promise<WidgetDeps | null> {
  try {
    return await defaultDeps();
  } catch (error) {
    if (!(error instanceof DatabaseNotConfiguredError)) console.error("[widget] database unavailable", { error: (error as Error).name });
    return null;
  }
}

export function unavailable() {
  return json({ error: "unavailable", message: "The chat is unavailable right now." }, 503);
}

/** Turns a service result into a response. Failures carry only a code and a visitor-safe message. */
export function respond(result: { ok: boolean; status?: number }) {
  if (result.ok) return json(result);
  const { status = 400, ...rest } = result;
  return json(rest, status);
}

/** Unexpected errors: log a category, never request contents. */
export function serverError(route: string, error: unknown) {
  console.error(`[widget] ${route} failed`, { error: error instanceof Error ? error.name : "unknown" });
  return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
}
