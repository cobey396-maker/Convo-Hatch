// Client configuration for the hosted widget: shape, validation, and the public (browser-safe) view.
// Shared by the server and the configuration CLI. Keep this file free of server-only imports.

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Day = (typeof DAYS)[number];

export interface Branding {
  /** Hex color for the header, launcher, and buttons, e.g. "#1f5f5b". */
  primaryColor: string;
  /** Name the assistant uses for itself, e.g. "Cedar Hollow assistant". */
  assistantName: string;
  greeting: string;
  launcherLabel: string;
}

export interface OpeningHours {
  day: Day;
  /** 24-hour "HH:MM" in the client's time zone. */
  open: string;
  close: string;
}

/** Approved, visitor-facing business information. Everything here may be shown to visitors and the AI. */
export interface ClientProfile {
  branding: Branding;
  timeZone: string;
  hours: OpeningHours[];
  hoursNote?: string;
  services: { name: string; description?: string }[];
  faqs: { question: string; answer: string }[];
  contact: { phone?: string; email?: string; website?: string; address?: string };
  /** Approved wording for emergencies (gas smell, CO alarm). Shown instead of an AI reply. */
  emergencyMessage?: string;
}

export interface ClientLimits {
  dailyConversations?: number;
  dailyAiReplies?: number;
  dailyLeads?: number;
  maxVisitorMessagesPerConversation?: number;
}

/** The full configuration of one client, as stored in the database and in config files. */
export interface ClientConfig {
  publicId: string;
  businessName: string;
  isDemo: boolean;
  active: boolean;
  profile: ClientProfile;
  serviceZipCodes: string[];
  leadDestinationEmails: string[];
  allowedOrigins: string[];
  limits: ClientLimits;
}

export interface StoredClient extends ClientConfig {
  id: string;
}

const LIMITS = {
  text: 200,
  longText: 1500,
  services: 40,
  faqs: 60,
  zips: 2000,
  origins: 20,
  emails: 5,
} as const;

export const PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ZIP_PATTERN = /^\d{5}$/;

type Errors = string[];

function str(value: unknown, field: string, errors: Errors, options: { required?: boolean; max?: number } = {}) {
  const { required = true, max = LIMITS.text } = options;
  if (value === undefined || value === null || value === "") {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }
  const trimmed = value.trim();
  if (required && !trimmed) errors.push(`${field} is required`);
  if (trimmed.length > max) errors.push(`${field} must be at most ${max} characters`);
  return trimmed || undefined;
}

function list(value: unknown, field: string, errors: Errors, max: number): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return [];
  }
  if (value.length > max) errors.push(`${field} can have at most ${max} entries`);
  return value;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes a website origin. Only https origins are allowed, plus http on localhost for testing.
 * Returns null for anything with a path, wildcard, or credentials.
 */
export function normalizeOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
  if (url.hostname.includes("*")) return null;
  return url.origin;
}

export type ValidationResult = { ok: true; config: ClientConfig } | { ok: false; errors: string[] };

/** Validates an untrusted configuration object (for example, a JSON file). */
export function validateClientConfig(raw: unknown): ValidationResult {
  const errors: Errors = [];
  const source = obj(raw);

  const publicId = str(source.publicId, "publicId", errors, { max: 63 });
  if (publicId && !PUBLIC_ID_PATTERN.test(publicId)) {
    errors.push("publicId must be 3–63 lowercase letters, digits, or hyphens, starting with a letter or digit");
  }
  const businessName = str(source.businessName, "businessName", errors, { max: 120 });
  const isDemo = source.isDemo === true;
  const active = source.active !== false;

  const profileSource = obj(source.profile);
  const brandingSource = obj(profileSource.branding);
  const primaryColor = str(brandingSource.primaryColor, "profile.branding.primaryColor", errors, { max: 7 });
  if (primaryColor && !HEX_COLOR.test(primaryColor)) errors.push("profile.branding.primaryColor must look like #1f5f5b");
  const branding: Branding = {
    primaryColor: primaryColor ?? "#000000",
    assistantName: str(brandingSource.assistantName, "profile.branding.assistantName", errors, { max: 60 }) ?? "",
    greeting: str(brandingSource.greeting, "profile.branding.greeting", errors, { max: 400 }) ?? "",
    launcherLabel: str(brandingSource.launcherLabel, "profile.branding.launcherLabel", errors, { max: 30 }) ?? "",
  };

  const timeZone = str(profileSource.timeZone, "profile.timeZone", errors, { max: 60 }) ?? "";
  if (timeZone && !isTimeZone(timeZone)) errors.push("profile.timeZone must be an IANA time zone, e.g. America/Chicago");

  const hours: OpeningHours[] = [];
  const seenDays = new Set<string>();
  list(profileSource.hours, "profile.hours", errors, 14).forEach((entry, index) => {
    const item = obj(entry);
    const field = `profile.hours[${index}]`;
    const day = str(item.day, `${field}.day`, errors, { max: 10 })?.toLowerCase();
    const open = str(item.open, `${field}.open`, errors, { max: 5 });
    const close = str(item.close, `${field}.close`, errors, { max: 5 });
    if (day && !(DAYS as readonly string[]).includes(day)) errors.push(`${field}.day must be a weekday name`);
    if (day && seenDays.has(day)) errors.push(`${field}.day ${day} is listed twice`);
    if (day) seenDays.add(day);
    if (open && !TIME.test(open)) errors.push(`${field}.open must be HH:MM (24-hour)`);
    if (close && !TIME.test(close)) errors.push(`${field}.close must be HH:MM (24-hour)`);
    if (open && close && TIME.test(open) && TIME.test(close) && open >= close) errors.push(`${field} must close after it opens`);
    if (day && open && close) hours.push({ day: day as Day, open, close });
  });
  hours.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));

  const services = list(profileSource.services, "profile.services", errors, LIMITS.services).map((entry, index) => {
    const item = obj(entry);
    return {
      name: str(item.name, `profile.services[${index}].name`, errors, { max: 80 }) ?? "",
      description: str(item.description, `profile.services[${index}].description`, errors, { required: false, max: 400 }),
    };
  });
  if (services.length === 0) errors.push("profile.services needs at least one approved service");

  const faqs = list(profileSource.faqs, "profile.faqs", errors, LIMITS.faqs).map((entry, index) => {
    const item = obj(entry);
    return {
      question: str(item.question, `profile.faqs[${index}].question`, errors, { max: 200 }) ?? "",
      answer: str(item.answer, `profile.faqs[${index}].answer`, errors, { max: LIMITS.longText }) ?? "",
    };
  });

  const contactSource = obj(profileSource.contact);
  const contact = {
    phone: str(contactSource.phone, "profile.contact.phone", errors, { required: false, max: 40 }),
    email: str(contactSource.email, "profile.contact.email", errors, { required: false, max: 254 }),
    website: str(contactSource.website, "profile.contact.website", errors, { required: false, max: 200 }),
    address: str(contactSource.address, "profile.contact.address", errors, { required: false, max: 200 }),
  };
  if (contact.email && !EMAIL_PATTERN.test(contact.email)) errors.push("profile.contact.email is not a valid email address");

  const profile: ClientProfile = {
    branding,
    timeZone,
    hours,
    hoursNote: str(profileSource.hoursNote, "profile.hoursNote", errors, { required: false, max: 400 }),
    services: services.map(({ name, description }) => (description ? { name, description } : { name })),
    faqs,
    contact: Object.fromEntries(Object.entries(contact).filter(([, value]) => value)) as ClientProfile["contact"],
    emergencyMessage: str(profileSource.emergencyMessage, "profile.emergencyMessage", errors, { required: false, max: 600 }),
  };
  if (!profile.hoursNote) delete profile.hoursNote;
  if (!profile.emergencyMessage) delete profile.emergencyMessage;

  const serviceZipCodes = [
    ...new Set(
      list(source.serviceZipCodes, "serviceZipCodes", errors, LIMITS.zips).map((zip, index) => {
        const value = typeof zip === "string" ? zip.trim() : String(zip);
        if (!ZIP_PATTERN.test(value)) errors.push(`serviceZipCodes[${index}] must be a 5-digit ZIP code`);
        return value;
      }),
    ),
  ].sort();

  const leadDestinationEmails = list(source.leadDestinationEmails, "leadDestinationEmails", errors, LIMITS.emails).map(
    (email, index) => {
      const value = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!EMAIL_PATTERN.test(value)) errors.push(`leadDestinationEmails[${index}] is not a valid email address`);
      return value;
    },
  );
  if (!isDemo && leadDestinationEmails.length === 0) {
    errors.push("leadDestinationEmails needs at least one address (only demo clients may leave it empty)");
  }

  const allowedOrigins = [
    ...new Set(
      list(source.allowedOrigins, "allowedOrigins", errors, LIMITS.origins).map((origin, index) => {
        const value = typeof origin === "string" ? normalizeOrigin(origin) : null;
        if (!value) {
          errors.push(
            `allowedOrigins[${index}] must be an origin like https://www.example.com (no path or wildcard; http only for localhost)`,
          );
        }
        return value ?? "";
      }),
    ),
  ];
  if (allowedOrigins.length === 0) errors.push("allowedOrigins needs at least one website origin");

  const limitsSource = obj(source.limits);
  const limits: ClientLimits = {};
  for (const key of ["dailyConversations", "dailyAiReplies", "dailyLeads", "maxVisitorMessagesPerConversation"] as const) {
    const value = limitsSource[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) {
      errors.push(`limits.${key} must be a whole number from 0 to 1000000`);
    } else {
      limits[key] = value;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      publicId: publicId!,
      businessName: businessName!,
      isDemo,
      active,
      profile,
      serviceZipCodes,
      leadDestinationEmails,
      allowedOrigins,
      limits,
    },
  };
}

/** Readable text color (near-black or white) for a background color. */
export function textColorFor(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Pick whichever gives the higher contrast ratio.
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#111827" : "#ffffff";
}

const DAY_LABELS: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function formatTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** One line per day, e.g. "Monday: 7:30 AM – 6:00 PM" or "Sunday: Closed". */
export function formatHours(profile: ClientProfile): string[] {
  return DAYS.map((day) => {
    const entry = profile.hours.find((item) => item.day === day);
    return `${DAY_LABELS[day]}: ${entry ? `${formatTime(entry.open)} – ${formatTime(entry.close)}` : "Closed"}`;
  });
}

export function timeZoneLabel(timeZone: string, date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
    .formatToParts(date)
    .find((item) => item.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** Everything the widget in the browser may know about a client. No destinations, origins, or limits. */
export interface PublicClientView {
  publicId: string;
  businessName: string;
  isDemo: boolean;
  branding: Branding & { textColor: string };
  timeZone: string;
  timeZoneLabel: string;
  hours: string[];
  hoursNote?: string;
  services: string[];
  faqs: { question: string; answer: string }[];
  contact: ClientProfile["contact"];
}

export function toPublicView(client: ClientConfig): PublicClientView {
  const { profile } = client;
  return {
    publicId: client.publicId,
    businessName: client.businessName,
    isDemo: client.isDemo,
    branding: { ...profile.branding, textColor: textColorFor(profile.branding.primaryColor) },
    timeZone: profile.timeZone,
    timeZoneLabel: timeZoneLabel(profile.timeZone),
    hours: formatHours(profile),
    ...(profile.hoursNote ? { hoursNote: profile.hoursNote } : {}),
    services: profile.services.map((service) => service.name),
    faqs: profile.faqs,
    contact: profile.contact,
  };
}
