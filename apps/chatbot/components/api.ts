// Browser helper for the widget's own API (same origin as the widget page).

export interface ApiResult<T> {
  status: number;
  data: T & { error?: string; message?: string };
}

/** Null means the request never got a response (offline, timed out); anything else is the server's answer. */
export async function post<T>(path: string, body: unknown): Promise<ApiResult<T> | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      // The server gives up on the AI after about 20 seconds; this only catches a dead connection.
      signal: AbortSignal.timeout(35_000),
    });
    const data = (await response.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { status: response.status, data };
  } catch {
    return null;
  }
}

/** Tells the page that embeds the widget to do something (the loader script listens). */
export function tellHost(message: Record<string, unknown>) {
  if (window.parent !== window) window.parent.postMessage({ source: "convohatch-widget", ...message }, "*");
}
