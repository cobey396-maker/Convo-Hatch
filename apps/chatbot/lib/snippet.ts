// Installation snippet for a client's website. Shared by the CLI and the server.

export const PLACEHOLDER_BASE_URL = "https://YOUR-CONVOHATCH-HOST";

/** The public base URL where this app is hosted, from WIDGET_PUBLIC_BASE_URL. */
export function widgetBaseUrl(): string | null {
  const value = process.env.WIDGET_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : null;
  } catch {
    return null;
  }
}

export function installationSnippet(publicId: string, baseUrl: string | null = widgetBaseUrl()): string {
  const base = baseUrl ?? PLACEHOLDER_BASE_URL;
  return `<script src="${base}/widget.js" data-client-id="${publicId}" async></script>`;
}
