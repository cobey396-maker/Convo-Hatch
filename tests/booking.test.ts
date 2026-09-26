import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatSlot,
  getBookingDays,
  isBookableSlot,
  normalizeBooking,
  validateBooking,
  zonedTimeToUtc,
} from "../lib/booking.ts";
import { AllChannelsFailedError, getNotifyChannels, notifyOwner, ntfyUrl } from "../lib/booking-notify.ts";

const TZ = "America/New_York";
// Sunday, September 27, 2026 at 8:00 AM Eastern.
const SUNDAY_MORNING = new Date("2026-09-27T12:00:00Z");

function labels(slots: string[]): string[] {
  return slots.map((slot) =>
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(slot)),
  );
}

test("weekdays run 5–9 PM in 30-minute slots", () => {
  const monday = getBookingDays(SUNDAY_MORNING, TZ).find((day) => day.date === "2026-09-28");
  assert.ok(monday);
  assert.deepEqual(labels(monday.slots), [
    "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM",
  ]);
});

test("Saturdays run 9 AM–2 PM in 30-minute slots", () => {
  const saturday = getBookingDays(SUNDAY_MORNING, TZ).find((day) => day.date === "2026-10-03");
  assert.ok(saturday);
  assert.deepEqual(labels(saturday.slots), [
    "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  ]);
});

test("Sundays have no slots", () => {
  const days = getBookingDays(SUNDAY_MORNING, TZ);
  for (const day of days) {
    const [year, month, date] = day.date.split("-").map(Number);
    assert.notEqual(new Date(Date.UTC(year, month - 1, date)).getUTCDay(), 0, day.date);
  }
});

test("skips slots inside the minimum notice window", () => {
  // Monday 5:45 PM Eastern: the earliest slot that day is 8:00 PM (two hours' notice).
  const now = new Date("2026-09-28T21:45:00Z");
  const monday = getBookingDays(now, TZ).find((day) => day.date === "2026-09-28");
  assert.ok(monday);
  assert.deepEqual(labels(monday.slots), ["8:00 PM", "8:30 PM"]);
});

test("handles daylight-saving changes", () => {
  // Weekday after the November 1, 2026 change: 5 PM EST is 22:00 UTC.
  const days = getBookingDays(new Date("2026-10-30T12:00:00Z"), TZ);
  const monday = days.find((day) => day.date === "2026-11-02");
  assert.ok(monday);
  assert.equal(monday.slots[0], "2026-11-02T22:00:00.000Z");
  assert.equal(zonedTimeToUtc(2026, 7, 1, 17, 0, TZ).toISOString(), "2026-07-01T21:00:00.000Z");
});

test("only accepts real, open slots", () => {
  assert.equal(isBookableSlot("2026-09-28T21:00:00.000Z", SUNDAY_MORNING, TZ), true);
  assert.equal(isBookableSlot("2026-09-28T21:15:00.000Z", SUNDAY_MORNING, TZ), false, "off the 30-minute grid");
  assert.equal(isBookableSlot("2026-09-27T14:00:00.000Z", SUNDAY_MORNING, TZ), false, "Sunday");
  assert.equal(isBookableSlot("2026-09-21T21:00:00.000Z", SUNDAY_MORNING, TZ), false, "in the past");
  assert.equal(isBookableSlot("2027-03-01T22:00:00.000Z", SUNDAY_MORNING, TZ), false, "too far ahead");
});

test("formats slots in the business time zone", () => {
  assert.equal(formatSlot("2026-09-28T21:30:00.000Z", TZ), "Monday, September 28 at 5:30 PM EDT");
});

test("validates name, email, and phone", () => {
  const valid = { slot: "2026-09-28T21:00:00.000Z", name: "Alex Rivera", email: "alex@example.com", phone: "(555) 123-4567" };
  assert.deepEqual(validateBooking(normalizeBooking(valid)), {});
  assert.deepEqual(Object.keys(validateBooking(normalizeBooking({}))).sort(), ["email", "name", "phone", "slot"]);

  const bad = validateBooking(normalizeBooking({ ...valid, email: "alex@", phone: "12345" }));
  assert.ok(bad.email);
  assert.ok(bad.phone);
  assert.ok(validateBooking(normalizeBooking({ ...valid, phone: "call me maybe" })).phone);
  assert.deepEqual(validateBooking(normalizeBooking({ ...valid, phone: "+1 555.123.4567" })), {});
});

test("booking is unavailable until a notification channel is configured", () => {
  const keys = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "BOOKING_NOTIFY_PHONE",
    "NTFY_TOPIC",
    "RESEND_API_KEY",
    "DEMO_REQUEST_TO_EMAIL",
    "DEMO_REQUEST_FROM_EMAIL",
    "DEMO_REQUEST_WEBHOOK_URL",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.deepEqual(getNotifyChannels(), []);

    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15550001111";
    assert.deepEqual(getNotifyChannels(), [], "SMS needs your phone number too");
    process.env.BOOKING_NOTIFY_PHONE = "+15552223333";
    assert.deepEqual(getNotifyChannels(), ["sms"]);

    process.env.NTFY_TOPIC = "convohatch-bookings";
    assert.deepEqual(getNotifyChannels(), ["sms", "ntfy"]);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test("accepts the ntfy topic as a bare name, ntfy.sh/name, or full URL", () => {
  assert.equal(ntfyUrl("convohatch-bookings"), "https://ntfy.sh/convohatch-bookings");
  assert.equal(ntfyUrl(" ntfy.sh/convohatch-bookings "), "https://ntfy.sh/convohatch-bookings");
  assert.equal(ntfyUrl("https://ntfy.sh/convohatch-bookings/"), "https://ntfy.sh/convohatch-bookings");
  assert.equal(ntfyUrl("my-topic", "https://ntfy.example.com/"), "https://ntfy.example.com/my-topic");
});

test("reports why every channel failed, without the visitor's details", async () => {
  const saved = { fetch: globalThis.fetch, topic: process.env.NTFY_TOPIC };
  process.env.NTFY_TOPIC = "convohatch-bookings";
  globalThis.fetch = (async () =>
    new Response('{"code":40010,"error":"invalid topic, sent by alex@example.com (555) 123-4567"}', { status: 400 })) as typeof fetch;
  try {
    const input = { slot: "2026-09-28T21:00:00.000Z", name: "Alex Rivera", email: "alex@example.com", phone: "(555) 123-4567" };
    await assert.rejects(notifyOwner(["ntfy"], input), (error: unknown) => {
      assert.ok(error instanceof AllChannelsFailedError);
      const [failure] = error.failures;
      assert.equal(failure.channel, "ntfy");
      assert.match(failure.reason, /^400: .*invalid topic/);
      assert.doesNotMatch(failure.reason, /alex@example\.com|123-4567/);
      return true;
    });
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.topic === undefined) delete process.env.NTFY_TOPIC;
    else process.env.NTFY_TOPIC = saved.topic;
  }
});
