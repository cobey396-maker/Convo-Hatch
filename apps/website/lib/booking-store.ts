// Server-only: remembers booked slots so two visitors can't pick the same time.
// Uses Upstash Redis over its REST API when configured (Vercel Marketplace sets KV_REST_API_*).
// Without it, every slot stays open and you sort out any double booking when you send the Zoom link.

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function config(): { url: string; token: string } | null {
  const url = env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
  return url.startsWith("https://") && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function isStoreConfigured(): boolean {
  return config() !== null;
}

function key(slot: string): string {
  return `convohatch:booking:${slot}`;
}

async function command(args: (string | number)[]): Promise<unknown> {
  const store = config();
  if (!store) throw new Error("store not configured");
  const response = await fetch(store.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(String(response.status));
  return ((await response.json()) as { result?: unknown }).result;
}

/** Returns the subset of `slots` that are already booked. */
export async function getTakenSlots(slots: string[]): Promise<Set<string>> {
  if (!config() || slots.length === 0) return new Set();
  const result = await command(["MGET", ...slots.map(key)]);
  const values = Array.isArray(result) ? result : [];
  return new Set(slots.filter((_, index) => values[index] !== null && values[index] !== undefined));
}

/** Atomically claims a slot. Returns false if someone already has it. */
export async function claimSlot(slot: string): Promise<boolean> {
  if (!config()) return true;
  // Keep the record until a day after the call, then let Redis clean it up.
  const ttlSeconds = Math.max(60, Math.ceil((new Date(slot).getTime() - Date.now()) / 1000) + 86_400);
  return (await command(["SET", key(slot), "1", "NX", "EX", ttlSeconds])) === "OK";
}

export async function releaseSlot(slot: string): Promise<void> {
  if (!config()) return;
  await command(["DEL", key(slot)]);
}
