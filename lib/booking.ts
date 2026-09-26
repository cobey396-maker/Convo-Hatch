// Shared by the scheduling page (client) and the booking API route (server).
// Keep this file free of browser- or server-only imports.

import { schedule } from "../content/site.ts";

export const SLOT_MINUTES = 30;

/** Opening hours per weekday (0 = Sunday), as [start, end) in "HH:MM" 24-hour time. */
export const WEEKLY_HOURS: Record<number, [string, string] | null> = {
  0: null,
  1: ["17:00", "21:00"],
  2: ["17:00", "21:00"],
  3: ["17:00", "21:00"],
  4: ["17:00", "21:00"],
  5: ["17:00", "21:00"],
  6: ["09:00", "14:00"],
};

/** How far ahead visitors can book, and the minimum notice before a call. */
export const BOOKING_WINDOW_DAYS = 21;
export const MIN_NOTICE_MINUTES = 120;

export const BOOKING_LIMITS = { name: 100, email: 254, phone: 30 } as const;

export interface BookingInput {
  slot: string;
  name: string;
  email: string;
  phone: string;
}

export type BookingField = keyof BookingInput;
export type BookingErrors = Partial<Record<BookingField, string>>;

export interface BookingDay {
  /** Calendar date in the business time zone, "YYYY-MM-DD". */
  date: string;
  /** Slot start times as UTC ISO strings. */
  slots: string[];
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string): ZonedParts {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    partsFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** Converts a wall-clock time in `timeZone` to the matching UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  // Two passes settle the offset, including across daylight-saving changes.
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += target - asUtc;
  }
  return new Date(guess);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Every bookable slot from now through the booking window, grouped by business-time-zone date. */
export function getBookingDays(now = new Date(), timeZone: string = schedule.timeZone): BookingDay[] {
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * 60_000;
  const today = zonedParts(now, timeZone);
  const days: BookingDay[] = [];

  for (let offset = 0; offset <= BOOKING_WINDOW_DAYS; offset++) {
    // Walk calendar dates with UTC arithmetic so month/year rollovers are handled for us.
    const calendar = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const year = calendar.getUTCFullYear();
    const month = calendar.getUTCMonth() + 1;
    const day = calendar.getUTCDate();
    const hours = WEEKLY_HOURS[calendar.getUTCDay()];
    if (!hours) continue;

    const slots: string[] = [];
    for (let minutes = toMinutes(hours[0]); minutes + SLOT_MINUTES <= toMinutes(hours[1]); minutes += SLOT_MINUTES) {
      const start = zonedTimeToUtc(year, month, day, Math.floor(minutes / 60), minutes % 60, timeZone);
      // Skip times that don't exist on daylight-saving change days.
      const check = zonedParts(start, timeZone);
      if (check.hour * 60 + check.minute !== minutes) continue;
      if (start.getTime() >= earliest) slots.push(start.toISOString());
    }
    if (slots.length > 0) days.push({ date: `${year}-${pad(month)}-${pad(day)}`, slots });
  }
  return days;
}

export function isBookableSlot(slot: string, now = new Date(), timeZone: string = schedule.timeZone): boolean {
  return getBookingDays(now, timeZone).some((day) => day.slots.includes(slot));
}

/** "Monday, September 28 at 5:30 PM EDT" in the business time zone. */
export function formatSlot(slot: string, timeZone: string = schedule.timeZone): string {
  const date = new Date(slot);
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
  return `${day} at ${time}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Coerces untrusted input (e.g. a parsed JSON body) into the expected shape. */
export function normalizeBooking(raw: unknown): BookingInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    slot: asTrimmedString(source.slot),
    name: asTrimmedString(source.name),
    email: asTrimmedString(source.email),
    phone: asTrimmedString(source.phone),
  };
}

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function validateBooking(input: BookingInput): BookingErrors {
  const errors: BookingErrors = {};

  if (!input.slot) errors.slot = "Please choose a time.";

  if (!input.name) errors.name = "Please enter your name.";
  else if (input.name.length > BOOKING_LIMITS.name)
    errors.name = `Please keep your name under ${BOOKING_LIMITS.name} characters.`;

  if (!input.email) errors.email = "Please enter your email address.";
  else if (input.email.length > BOOKING_LIMITS.email || !EMAIL_PATTERN.test(input.email))
    errors.email = "Please enter a valid email address, like name@example.com.";

  const digits = phoneDigits(input.phone);
  if (!input.phone) errors.phone = "Please enter your phone number.";
  else if (
    input.phone.length > BOOKING_LIMITS.phone ||
    !/^[\d\s()+.-]+$/.test(input.phone) ||
    digits.length < 10 ||
    digits.length > 15
  )
    errors.phone = "Please enter a valid phone number, like (555) 123-4567.";

  return errors;
}

export function hasBookingErrors(errors: BookingErrors): boolean {
  return Object.keys(errors).length > 0;
}
