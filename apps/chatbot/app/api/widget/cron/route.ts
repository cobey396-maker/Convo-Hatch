import { timingSafeEqual } from "node:crypto";
import { depsOrNull, json, unavailable } from "@/lib/http";
import { retryDueNotifications } from "@/lib/notify";
import { purgeExpired } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled maintenance: retries lead notifications that failed or were waiting for email setup,
 * then deletes data past its retention period. Requires `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron sends this automatically when CRON_SECRET is set). Disabled without CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);
  const deps = await depsOrNull();
  if (!deps) return unavailable();
  const notifications = await retryDueNotifications(deps, 50);
  const purged = await purgeExpired(deps.db, deps.now());
  return json({ ok: true, notifications, purged });
}
