// Service-request (lead) fields: shared by the widget form (browser) and the server.
// Keep this file free of browser- or server-only imports.

export const CALLBACK_TIMES = [
  "Any time during office hours",
  "Morning (8 AM – 12 PM)",
  "Afternoon (12 – 5 PM)",
  "Evening (5 – 8 PM)",
] as const;

/** Callback day value meaning "no preference". Other values are YYYY-MM-DD in the business's time zone. */
export const ANY_DAY = "any";
export const CALLBACK_DAY_WINDOW = 7;

export const OTHER_SERVICE = "Something else / not sure";

export const LEAD_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  service: 80,
  details: 1000,
} as const;

export interface LeadInput {
  name: string;
  email: string;
  phone: string;
  zip: string;
  service: string;
  details: string;
  preferredDay: string;
  preferredTime: string;
  timeZone: string;
}

export type LeadField = keyof LeadInput;
export type LeadErrors = Partial<Record<LeadField | "contact", string>>;

export const EMPTY_LEAD: LeadInput = {
  name: "",
  email: "",
  phone: "",
  zip: "",
  service: "",
  details: "",
  preferredDay: ANY_DAY,
  preferredTime: "",
  timeZone: "",
};

// Deliberately permissive: one @, something on each side, and a dot in the domain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Coerces untrusted input into the expected shape. */
export function normalizeLead(raw: unknown): LeadInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const zip = text(source.zip);
  return {
    name: text(source.name).replace(/\s+/g, " "),
    email: text(source.email).toLowerCase(),
    phone: text(source.phone).replace(/\s+/g, " "),
    // ZIP+4 is accepted and trimmed to the 5-digit ZIP.
    zip: /^\d{5}-\d{4}$/.test(zip) ? zip.slice(0, 5) : zip,
    service: text(source.service),
    details: text(source.details),
    preferredDay: text(source.preferredDay) || ANY_DAY,
    preferredTime: text(source.preferredTime),
    timeZone: text(source.timeZone),
  };
}

// --- Phone numbers ----------------------------------------------------------------------------

export type ParsedPhone = { kind: "us"; digits: string } | { kind: "international"; digits: string };

/**
 * US numbers: 10 digits, optionally with a leading 1 or +1. International numbers: a leading +
 * then 8–15 digits (E.164). Separators, dots, and parentheses are ignored; an extension is not accepted.
 */
export function parsePhone(phone: string): ParsedPhone | null {
  const trimmed = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && !trimmed.startsWith("+1")) {
    return digits.length >= 8 && digits.length <= 15 ? { kind: "international", digits } : null;
  }
  if (digits.length === 10) return { kind: "us", digits };
  if (digits.length === 11 && digits.startsWith("1")) return { kind: "us", digits: digits.slice(1) };
  return null;
}

/** 10 US digits, or null. Kept for callers that only handle US numbers. */
export function phoneDigits(phone: string): string | null {
  const parsed = parsePhone(phone);
  return parsed?.kind === "us" ? parsed.digits : null;
}

export function formatPhone(parsed: ParsedPhone | string): string {
  const value = typeof parsed === "string" ? ({ kind: "us", digits: parsed } as ParsedPhone) : parsed;
  if (value.kind === "us") return `(${value.digits.slice(0, 3)}) ${value.digits.slice(3, 6)}-${value.digits.slice(6)}`;
  return `+${value.digits}`;
}

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 60) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// --- Callback day -----------------------------------------------------------------------------

type Weekday = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

/** Calendar date (YYYY-MM-DD), weekday, and HH:MM time of an instant in a time zone. */
function localDate(date: Date, timeZone: string): { iso: string; weekday: Weekday; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: String(parts.weekday).toLowerCase() as Weekday,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** The days the office is open and when it closes (HH:MM, business time zone). */
export interface OfficeDay {
  day: string;
  close: string;
}

export interface CallbackDayOption {
  value: string;
  label: string;
  /** The office is closed that day, so it can't be chosen. */
  closed: boolean;
}

/**
 * The callback-day choices: "First available day", then today (only while the office is still open)
 * and the following days, as calendar dates in the business's time zone ("tomorrow" means tomorrow
 * there, not wherever the visitor is). Closed days are listed but marked, so the widget can disable them.
 */
export function callbackDayOptions(timeZone: string, hours: OfficeDay[], now = new Date()): CallbackDayOption[] {
  const options: CallbackDayOption[] = [{ value: ANY_DAY, label: "First available day", closed: false }];
  for (let offset = 0; offset < CALLBACK_DAY_WINDOW; offset += 1) {
    const instant = new Date(now.getTime() + offset * 86_400_000);
    const { iso, weekday, time } = localDate(instant, timeZone);
    if (options.some((option) => option.value === iso)) continue;
    const entry = hours.find((item) => item.day === weekday);
    // Today is offered only until closing time.
    if (offset === 0 && (!entry || time >= entry.close)) continue;
    const pretty = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(instant);
    const prefix = offset === 0 ? "Today, " : offset === 1 ? "Tomorrow, " : "";
    options.push({ value: iso, label: `${prefix}${pretty}${entry ? "" : " (office closed)"}`, closed: !entry });
  }
  return options;
}

/** Human-readable callback preference, always naming the time zone. */
export function describeCallbackPreference(input: Pick<LeadInput, "preferredDay" | "preferredTime" | "timeZone">, zoneLabel: string): string {
  let day = "First available day";
  if (input.preferredDay !== ANY_DAY && /^\d{4}-\d{2}-\d{2}$/.test(input.preferredDay)) {
    const [year, month, date] = input.preferredDay.split("-").map(Number);
    day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
      new Date(Date.UTC(year, month - 1, date, 12)),
    );
  }
  return `${day}, ${input.preferredTime} (${zoneLabel})`;
}

// --- Validation -------------------------------------------------------------------------------

export interface LeadContext {
  /** Business time zone and office hours, for validating the callback day. */
  timeZone?: string;
  hours?: OfficeDay[];
  now?: Date;
}

export function validateLead(input: LeadInput, services: string[], context: LeadContext = {}): LeadErrors {
  const errors: LeadErrors = {};

  if (!input.name) errors.name = "Enter your name.";
  else if (input.name.length > LEAD_LIMITS.name) errors.name = `Keep your name under ${LEAD_LIMITS.name} characters.`;

  if (input.email && (input.email.length > LEAD_LIMITS.email || !EMAIL_PATTERN.test(input.email))) {
    errors.email = "Enter a valid email address, like name@example.com.";
  }
  if (input.phone && (input.phone.length > LEAD_LIMITS.phone || !parsePhone(input.phone))) {
    errors.phone = "Enter a 10-digit US phone number, or an international number starting with + and the country code.";
  }
  if (!input.email && !input.phone) errors.contact = "Enter a phone number or email address so the office can reach you.";

  if (!/^\d{5}$/.test(input.zip)) errors.zip = "Enter the 5-digit US ZIP code where you need service.";

  if (!input.service) errors.service = "Choose the service you need.";
  else if (input.service !== OTHER_SERVICE && !services.includes(input.service)) errors.service = "Choose a service from the list.";

  if (input.details.length > LEAD_LIMITS.details) errors.details = `Keep details under ${LEAD_LIMITS.details} characters.`;

  if (!(CALLBACK_TIMES as readonly string[]).includes(input.preferredTime)) errors.preferredTime = "Choose a callback time.";
  if (!isValidTimeZone(input.timeZone)) errors.timeZone = "Choose a time zone.";

  if (input.preferredDay !== ANY_DAY) {
    const allowed = context.timeZone
      ? callbackDayOptions(context.timeZone, context.hours ?? [], context.now)
          .filter((option) => !option.closed)
          .map((option) => option.value)
      : null;
    // A day that is no longer offered (a form left open overnight) falls back to "any day"
    // on the server rather than blocking the request; malformed values are rejected.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.preferredDay)) errors.preferredDay = "Choose a callback day.";
    else if (allowed && !allowed.includes(input.preferredDay)) input.preferredDay = ANY_DAY;
  }

  return errors;
}

export function hasLeadErrors(errors: LeadErrors): boolean {
  return Object.keys(errors).length > 0;
}

// --- Details typed into the chat ----------------------------------------------------------------

export interface TypedDetails {
  name?: string;
  email?: string;
  phone?: string;
  zip?: string;
}

/**
 * Picks contact details out of a chat message, in the browser only, so the callback form can be
 * prefilled. The server never stores these from chat text (it redacts them).
 */
export function extractTypedDetails(message: string): TypedDetails {
  const found: TypedDetails = {};
  const email = /[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/i.exec(message);
  if (email) found.email = email[0].toLowerCase();
  const phone = /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/.exec(message);
  if (phone && parsePhone(phone[0])) found.phone = phone[0].trim();
  const withoutPhone = phone ? message.replace(phone[0], " ") : message;
  const zip = /(?<![\d-])(\d{5})(?:-\d{4})?(?![\d-])/.exec(withoutPhone);
  if (zip) found.zip = zip[1];
  // Only capitalized words count as a name, so "I'm having trouble" doesn't produce one.
  const name = /(?:\b[Mm]y name is|\b[Nn]ame's|\b[Tt]his is|\b[Ii] am|\b[Ii]['’]m)\s+([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){0,2})/.exec(message);
  if (name) found.name = name[1];
  return found;
}
