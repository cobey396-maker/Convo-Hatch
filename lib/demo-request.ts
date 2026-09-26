// Shared by the demo-request form (client) and the API route (server).
// Keep this file free of browser- or server-only imports.

export const TRADES = ["HVAC", "Plumbing", "Electrical", "Roofing", "Other local service"] as const;
export type Trade = (typeof TRADES)[number];

export const FIELD_LIMITS = {
  name: 100,
  business: 150,
  email: 254,
  website: 200,
  message: 1000,
} as const;

export const MESSAGE_MIN_LENGTH = 10;

export interface DemoRequestInput {
  name: string;
  business: string;
  email: string;
  website: string;
  trade: string;
  message: string;
}

export type DemoRequestField = keyof DemoRequestInput;
export type DemoRequestErrors = Partial<Record<DemoRequestField, string>>;

export const EMPTY_DEMO_REQUEST: DemoRequestInput = {
  name: "",
  business: "",
  email: "",
  website: "",
  trade: "",
  message: "",
};

// Order used when focusing the first invalid field.
export const DEMO_REQUEST_FIELDS: DemoRequestField[] = [
  "name",
  "business",
  "email",
  "website",
  "trade",
  "message",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d{2,5})?(\/\S*)?$/i;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Coerces untrusted input (e.g. a parsed JSON body) into the expected shape. */
export function normalizeDemoRequest(raw: unknown): DemoRequestInput {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: asTrimmedString(source.name),
    business: asTrimmedString(source.business),
    email: asTrimmedString(source.email),
    website: asTrimmedString(source.website),
    trade: asTrimmedString(source.trade),
    message: asTrimmedString(source.message),
  };
}

export function validateDemoRequest(input: DemoRequestInput): DemoRequestErrors {
  const errors: DemoRequestErrors = {};

  if (!input.name) errors.name = "Please enter your name.";
  else if (input.name.length > FIELD_LIMITS.name)
    errors.name = `Please keep your name under ${FIELD_LIMITS.name} characters.`;

  if (!input.business) errors.business = "Please enter your business name.";
  else if (input.business.length > FIELD_LIMITS.business)
    errors.business = `Please keep the business name under ${FIELD_LIMITS.business} characters.`;

  if (!input.email) errors.email = "Please enter your email address.";
  else if (input.email.length > FIELD_LIMITS.email || !EMAIL_PATTERN.test(input.email))
    errors.email = "Please enter a valid email address, like name@example.com.";

  if (input.website) {
    if (input.website.length > FIELD_LIMITS.website || !WEBSITE_PATTERN.test(input.website))
      errors.website = "Please enter a valid website address, like example.com, or leave it blank.";
  }

  if (!input.trade) errors.trade = "Please choose your trade.";
  else if (!(TRADES as readonly string[]).includes(input.trade))
    errors.trade = "Please choose one of the listed trades.";

  if (!input.message) errors.message = "Please tell us briefly what you need help with.";
  else if (input.message.length < MESSAGE_MIN_LENGTH)
    errors.message = `Please add a little more detail (at least ${MESSAGE_MIN_LENGTH} characters).`;
  else if (input.message.length > FIELD_LIMITS.message)
    errors.message = `Please keep this under ${FIELD_LIMITS.message} characters.`;

  return errors;
}

export function hasErrors(errors: DemoRequestErrors): boolean {
  return Object.keys(errors).length > 0;
}
