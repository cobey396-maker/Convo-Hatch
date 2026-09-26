// Service-request (lead) fields: shared by the widget form (browser) and the server.
// Keep this file free of browser- or server-only imports.

export const CALLBACK_TIMES = [
  "As soon as possible",
  "Morning (8 AM – 12 PM)",
  "Afternoon (12 – 5 PM)",
  "Evening (5 – 8 PM)",
] as const;

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
  preferredTime: "",
  timeZone: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Coerces untrusted input into the expected shape. */
export function normalizeLead(raw: unknown): LeadInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: text(source.name).replace(/\s+/g, " "),
    email: text(source.email).toLowerCase(),
    phone: text(source.phone),
    zip: text(source.zip),
    service: text(source.service),
    details: text(source.details),
    preferredTime: text(source.preferredTime),
    timeZone: text(source.timeZone),
  };
}

/** 10 US digits, or null. Accepts a leading country code 1. */
export function phoneDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

export function formatPhone(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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

export function validateLead(input: LeadInput, services: string[]): LeadErrors {
  const errors: LeadErrors = {};

  if (!input.name) errors.name = "Enter your name.";
  else if (input.name.length > LEAD_LIMITS.name) errors.name = `Keep your name under ${LEAD_LIMITS.name} characters.`;

  if (input.email && (input.email.length > LEAD_LIMITS.email || !EMAIL_PATTERN.test(input.email))) {
    errors.email = "Enter a valid email address, like name@example.com.";
  }
  if (input.phone && (input.phone.length > LEAD_LIMITS.phone || !phoneDigits(input.phone))) {
    errors.phone = "Enter a 10-digit US phone number.";
  }
  if (!input.email && !input.phone) errors.contact = "Enter a phone number or email address so the office can reach you.";

  if (!/^\d{5}$/.test(input.zip)) errors.zip = "Enter the 5-digit ZIP code where you need service.";

  if (!input.service) errors.service = "Choose the service you need.";
  else if (input.service !== OTHER_SERVICE && !services.includes(input.service)) errors.service = "Choose a service from the list.";

  if (input.details.length > LEAD_LIMITS.details) errors.details = `Keep details under ${LEAD_LIMITS.details} characters.`;

  if (!(CALLBACK_TIMES as readonly string[]).includes(input.preferredTime)) errors.preferredTime = "Choose a callback time.";
  if (!isValidTimeZone(input.timeZone)) errors.timeZone = "Choose a time zone.";

  return errors;
}

export function hasLeadErrors(errors: LeadErrors): boolean {
  return Object.keys(errors).length > 0;
}
