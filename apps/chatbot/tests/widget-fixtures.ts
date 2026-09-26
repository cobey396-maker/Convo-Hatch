// Shared setup for widget tests: an in-memory PostgreSQL database with two fictional clients,
// plus fake AI and email providers that record what they were asked to do.

import { upsertClient } from "../lib/clients.ts";
import { validateClientConfig, type ClientConfig, type StoredClient } from "../lib/config.ts";
import { migrate, openPglite, type Db } from "../lib/db.ts";
import type { AiRequest, AiResponder, AiResult } from "../lib/ai.ts";
import type { WidgetDeps } from "../lib/deps.ts";
import type { EmailSender, OutgoingEmail, SendResult } from "../lib/notify.ts";

export function clientConfig(overrides: Partial<ClientConfig> & { publicId: string; businessName: string }): ClientConfig {
  const raw = {
    isDemo: false,
    active: true,
    profile: {
      branding: {
        primaryColor: "#224466",
        assistantName: `${overrides.businessName} assistant`,
        greeting: `Hi from ${overrides.businessName}.`,
        launcherLabel: "Chat",
      },
      timeZone: "America/Chicago",
      hours: [
        { day: "monday", open: "08:00", close: "17:00" },
        { day: "friday", open: "08:00", close: "16:00" },
      ],
      services: [{ name: "AC repair" }, { name: "Furnace repair" }],
      faqs: [{ question: "Do you offer free estimates?", answer: `${overrides.businessName} offers free estimates on new systems.` }],
      contact: { phone: "(555) 010-0111" },
    },
    serviceZipCodes: ["11111", "11112"],
    leadDestinationEmails: ["office@alpha.example"],
    allowedOrigins: ["https://alpha.example"],
    limits: {},
    ...overrides,
  };
  const result = validateClientConfig(raw);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.config;
}

export interface Fixture {
  db: Db;
  alpha: StoredClient;
  bravo: StoredClient;
  demo: StoredClient;
  ai: FakeAi;
  email: FakeEmail;
  deps: (overrides?: Partial<WidgetDeps>) => WidgetDeps;
  clock: { now: Date };
}

export interface FakeAi extends AiResponder {
  requests: AiRequest[];
  next: AiResult;
}

export function fakeAi(): FakeAi {
  const fn = (async (request: AiRequest) => {
    fn.requests.push(request);
    return fn.next;
  }) as FakeAi;
  fn.requests = [];
  fn.next = { ok: true, text: "Happy to help with that." };
  return fn;
}

export interface FakeEmail extends EmailSender {
  sent: OutgoingEmail[];
  results: SendResult[];
}

/** Sends succeed unless results are queued; each queued result is used once. */
export function fakeEmail(): FakeEmail {
  const fn = (async (email: OutgoingEmail) => {
    fn.sent.push(email);
    return fn.results.shift() ?? { ok: true, providerId: `msg_${fn.sent.length}` };
  }) as FakeEmail;
  fn.sent = [];
  fn.results = [];
  return fn;
}

export async function setup(): Promise<Fixture> {
  const db = await openPglite("memory");
  await migrate(db);
  const alpha = await upsertClient(db, clientConfig({ publicId: "alpha-heating", businessName: "Alpha Heating" }));
  const bravo = await upsertClient(
    db,
    clientConfig({
      publicId: "bravo-cooling",
      businessName: "Bravo Cooling",
      serviceZipCodes: ["22222"],
      leadDestinationEmails: ["dispatch@bravo.example"],
      allowedOrigins: ["https://bravo.example"],
    }),
  );
  const demo = await upsertClient(
    db,
    clientConfig({ publicId: "demo-client", businessName: "Demo Air (fictional)", isDemo: true, leadDestinationEmails: [] }),
  );
  const ai = fakeAi();
  const email = fakeEmail();
  const clock = { now: new Date("2026-09-28T15:00:00Z") };
  return {
    db,
    alpha,
    bravo,
    demo,
    ai,
    email,
    clock,
    deps: (overrides = {}) => ({ db, ai, email, now: () => clock.now, ...overrides }),
  };
}

export function validLead(overrides: Record<string, string> = {}) {
  return {
    name: "Jordan Sample",
    email: "jordan@example.com",
    phone: "",
    zip: "11111",
    service: "AC repair",
    details: "Upstairs is warm.",
    preferredTime: "Morning (8 AM – 12 PM)",
    timeZone: "America/Chicago",
    ...overrides,
  };
}

let keyCounter = 0;
export function idempotencyKey(): string {
  keyCounter += 1;
  return `test-key-${String(keyCounter).padStart(8, "0")}-abcdef`;
}
