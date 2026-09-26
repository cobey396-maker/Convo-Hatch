import { NextResponse, type NextRequest } from "next/server";

// Sets which websites may show a client's widget in an iframe, using the client's allowed origins
// (Content-Security-Policy frame-ancestors). Browsers refuse to render the widget anywhere else.
// This is a browser control only; the API enforces its own checks and limits on the server.

const CACHE_MS = 60_000;
const cache = new Map<string, { origins: string[]; expires: number }>();

async function allowedOrigins(request: NextRequest, publicId: string): Promise<string[]> {
  const cached = cache.get(publicId);
  if (cached && cached.expires > Date.now()) return cached.origins;
  let origins: string[] = [];
  try {
    const url = new URL("/api/widget/frame-policy", request.nextUrl.origin);
    url.searchParams.set("client", publicId);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3_000) });
    if (response.ok) {
      const data = (await response.json()) as { origins?: unknown };
      origins = Array.isArray(data.origins) ? data.origins.filter((item): item is string => typeof item === "string") : [];
    }
  } catch {
    // Fail closed: no origins means the widget can't be framed.
  }
  // Only valid origin strings reach the header.
  origins = origins.filter((origin) => /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(origin));
  if (cache.size > 1000) cache.clear();
  cache.set(publicId, { origins, expires: Date.now() + CACHE_MS });
  return origins;
}

export async function middleware(request: NextRequest) {
  const publicId = request.nextUrl.pathname.split("/")[2] ?? "";
  const origins = /^[a-z0-9][a-z0-9-]{2,62}$/.test(publicId) ? await allowedOrigins(request, publicId) : [];
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", `frame-ancestors ${origins.length ? origins.join(" ") : "'none'"}`);
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = {
  matcher: ["/embed/:path*"],
};
