// Server-only: the services the widget uses, built from environment variables.
// Tests pass their own (in-memory database, fake AI, fake email) instead.

import { claudeResponder, isWidgetAiConfigured, type AiResponder } from "./ai.ts";
import { getDb, type Db } from "./db.ts";
import { emailSender, type EmailSender } from "./notify.ts";

export interface WidgetDeps {
  db: Db;
  /** Null when live AI isn't configured. */
  ai: AiResponder | null;
  /** Null when lead email isn't configured. Leads are still stored and retried later. */
  email: EmailSender | null;
  now: () => Date;
}

export async function defaultDeps(): Promise<WidgetDeps> {
  return {
    db: await getDb(),
    ai: isWidgetAiConfigured() ? claudeResponder : null,
    email: emailSender(),
    now: () => new Date(),
  };
}
