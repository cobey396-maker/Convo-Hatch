import { NextResponse } from "next/server";
import { schedule } from "@/content/site";
import { getBookingDays, hasBookingErrors, isBookableSlot, normalizeBooking, validateBooking } from "@/lib/booking";
import { AllChannelsFailedError, confirmToVisitor, getNotifyChannels, notifyOwner } from "@/lib/booking-notify";
import { claimSlot, getTakenSlots, releaseSlot } from "@/lib/booking-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4_000;
const NO_STORE = { "Cache-Control": "no-store" };

// Best-effort, per-instance limit on booking attempts. Add host-level rate limiting too.
const WINDOW_MS = 10 * 60 * 1000;
const PER_VISITOR_LIMIT = 5;
const attempts = new Map<string, { count: number; start: number }>();

function allowAttempt(visitor: string, now = Date.now()): boolean {
  const entry = attempts.get(visitor);
  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(visitor, { count: 1, start: now });
    if (attempts.size > 5000) {
      for (const [key, value] of attempts) if (now - value.start > WINDOW_MS) attempts.delete(key);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= PER_VISITOR_LIMIT;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Open slots for the calendar, minus any already booked. Reveals nothing about the configuration. */
export async function GET() {
  if (getNotifyChannels().length === 0) {
    return json({ available: false, timeZone: schedule.timeZone, days: [] });
  }

  const days = getBookingDays();
  let taken = new Set<string>();
  try {
    taken = await getTakenSlots(days.flatMap((day) => day.slots));
  } catch (error) {
    console.error("[booking] could not read booked slots", { status: error instanceof Error ? error.message : "unknown" });
  }

  const open = days
    .map((day) => ({ date: day.date, slots: day.slots.filter((slot) => !taken.has(slot)) }))
    .filter((day) => day.slots.length > 0);
  return json({ available: true, timeZone: schedule.timeZone, days: open });
}

export async function POST(request: Request) {
  const channels = getNotifyChannels();
  if (channels.length === 0) return json({ ok: false, error: "unavailable" }, 503);

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

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowAttempt(visitor)) return json({ ok: false, error: "rate_limited" }, 429);

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "too_large" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Spam trap filled in: reject without booking, and without claiming success.
  const trap = (body as Record<string, unknown> | null)?.company_fax;
  if (typeof trap === "string" && trap.trim() !== "") return json({ ok: false, error: "rejected" }, 400);

  const input = normalizeBooking(body);
  const errors = validateBooking(input);
  if (hasBookingErrors(errors)) return json({ ok: false, error: "invalid", errors }, 422);
  if (!isBookableSlot(input.slot)) return json({ ok: false, error: "slot_unavailable" }, 409);

  let claimed = false;
  try {
    if (!(await claimSlot(input.slot))) return json({ ok: false, error: "slot_taken" }, 409);
    claimed = true;
  } catch (error) {
    // Storage is only a guard against double booking. Still take the booking if it's down.
    console.error("[booking] could not claim slot", { status: error instanceof Error ? error.message : "unknown" });
  }

  try {
    const failures = await notifyOwner(channels, input);
    // Log only non-personal diagnostics. Never log the submitted fields.
    if (failures.length > 0) console.error("[booking] some notifications failed", { failures });
  } catch (error) {
    console.error("[booking] all notifications failed", {
      failures: error instanceof AllChannelsFailedError ? error.failures : channels,
    });
    if (claimed) await releaseSlot(input.slot).catch(() => undefined);
    return json({ ok: false, error: "delivery_failed" }, 502);
  }

  try {
    await confirmToVisitor(input);
  } catch {
    console.error("[booking] visitor confirmation email failed");
  }

  return json({ ok: true, slot: input.slot });
}
