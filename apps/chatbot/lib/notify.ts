// Server-only: emails new service requests to the client's configured destination.
//
// Status meanings are deliberately modest: "accepted" means the email provider accepted the
// message for sending. It is not proof the email reached an inbox.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { timeZoneLabel } from "./config.ts";
import type { WidgetDeps } from "./deps.ts";

export interface OutgoingEmail {
  to: string[];
  replyTo?: string;
  subject: string;
  text: string;
  /** Lets the provider drop a repeated send of the same notification. */
  idempotencyKey: string;
}

export type SendResult = { ok: true; providerId?: string } | { ok: false; reason: string };
export type EmailSender = (email: OutgoingEmail) => Promise<SendResult>;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Email via Resend (https://resend.com) when RESEND_API_KEY and LEAD_NOTIFY_FROM_EMAIL are set. */
export function resendSender(): EmailSender | null {
  const apiKey = env("RESEND_API_KEY");
  const from = env("LEAD_NOTIFY_FROM_EMAIL");
  if (!apiKey || !from) return null;

  return async (email) => {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: email.to,
          ...(email.replyTo ? { reply_to: email.replyTo } : {}),
          subject: email.subject,
          text: email.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { ok: false, reason: "network" };
    }
    if (!response.ok) return { ok: false, reason: `resend_${response.status}` };
    const data = (await response.json().catch(() => ({}))) as { id?: unknown };
    return { ok: true, providerId: typeof data.id === "string" ? data.id : undefined };
  };
}

/**
 * Development only: "sends" each email by writing it to a file in WIDGET_OUTBOX_DIR
 * (default .data/outbox), so the whole flow can be seen locally without an email account.
 * Enabled with WIDGET_EMAIL_PROVIDER=outbox. Refused on Vercel, where nothing would read it.
 */
export function outboxSender(dir = env("WIDGET_OUTBOX_DIR") || path.join(".data", "outbox")): EmailSender {
  return async (email) => {
    // Named by the idempotency key, so a repeated send overwrites instead of duplicating.
    const file = path.resolve(dir, `${email.idempotencyKey}.eml`);
    const message = [
      `To: ${email.to.join(", ")}`,
      ...(email.replyTo ? [`Reply-To: ${email.replyTo}`] : []),
      `Subject: ${email.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      email.text,
      "",
    ].join("\n");
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, message, "utf8");
    } catch {
      return { ok: false, reason: "outbox_write_failed" };
    }
    return { ok: true, providerId: `outbox:${path.basename(file)}` };
  };
}

/** The configured email provider, or null when email isn't set up. */
export function emailSender(): EmailSender | null {
  const provider = env("WIDGET_EMAIL_PROVIDER").toLowerCase() || "resend";
  if (provider === "outbox") return process.env.VERCEL ? null : outboxSender();
  if (provider === "resend") return resendSender();
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Where demo-client leads are emailed: your own test inbox(es) from WIDGET_DEMO_NOTIFY_TO, never
 * a contractor. Empty means demo leads are stored but not emailed.
 */
export function demoNotifyTo(): string[] {
  return env("WIDGET_DEMO_NOTIFY_TO")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => EMAIL_PATTERN.test(address))
    .slice(0, 5);
}

export function maxNotificationAttempts(): number {
  const value = Number(process.env.WIDGET_NOTIFY_MAX_ATTEMPTS);
  return Number.isInteger(value) && value > 0 ? value : 8;
}

/** Minutes to wait before the next attempt: 1, 2, 4, 8 … capped at 6 hours. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(2 ** Math.max(0, attempts - 1), 360);
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

interface LeadForEmail {
  reference: string;
  name: string;
  email: string | null;
  phone: string | null;
  zip: string;
  in_service_area: boolean;
  service: string;
  details: string | null;
  preferred_time: string;
  time_zone: string;
  created_at: Date;
  business_name: string;
  business_time_zone: string;
  is_demo: boolean;
  lead_destination_emails: string[];
}

export function buildLeadEmail(
  lead: LeadForEmail,
  notificationId: string,
  demoRecipients: string[] = [],
): OutgoingEmail {
  const submitted = new Intl.DateTimeFormat("en-US", {
    timeZone: lead.business_time_zone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(lead.created_at));
  const text = [
    ...(lead.is_demo
      ? [
          "DEMO: this request came from the demo widget for a fictional business. It was sent to the",
          "ConvoHatch demo inbox (WIDGET_DEMO_NOTIFY_TO), not to any contractor. Details were typed by a demo visitor.",
          "",
        ]
      : []),
    `New callback request from the ${lead.business_name} website chat`,
    `Reference: ${lead.reference}`,
    "",
    "This is a callback request, not a confirmed appointment. The visitor was told the office will contact them.",
    "",
    `Name: ${singleLine(lead.name)}`,
    `Phone: ${lead.phone ?? "Not provided"}`,
    `Email: ${lead.email ?? "Not provided"}`,
    `Service ZIP code: ${lead.zip} (${lead.in_service_area ? "in your service-area list" : "NOT in your service-area list"})`,
    `Service needed: ${singleLine(lead.service)}`,
    `Preferred callback time: ${lead.preferred_time}, ${timeZoneLabel(lead.time_zone)} (${lead.time_zone})`,
    `Submitted: ${submitted}`,
    "",
    "Details from the visitor:",
    lead.details || "None provided",
    "",
    "Sent by ConvoHatch.",
  ].join("\n");
  return {
    // Demo leads go only to the operator's demo inbox; the client's own list is never used.
    to: lead.is_demo ? demoRecipients : lead.lead_destination_emails,
    replyTo: lead.is_demo ? undefined : (lead.email ?? undefined),
    subject: singleLine(`${lead.is_demo ? "[DEMO] " : ""}Callback request: ${lead.service}, ZIP ${lead.zip} (${lead.reference})`),
    text,
    idempotencyKey: `convohatch-lead-${notificationId}`,
  };
}

export type DeliveryOutcome = "accepted" | "failed" | "gave_up" | "not_configured" | "suppressed_demo" | "skipped";

/**
 * Tries to send one notification. Safe to call concurrently and repeatedly: an attempt first
 * claims the row, and notifications that were accepted or suppressed are never sent again.
 */
export async function deliverNotification(deps: WidgetDeps, notificationId: string): Promise<DeliveryOutcome> {
  const now = deps.now();

  if (!deps.email) {
    await deps.db.query(
      `UPDATE lead_notifications SET last_error = 'email_not_configured', updated_at = $2
       WHERE id = $1 AND status IN ('pending', 'failed')`,
      [notificationId, now],
    );
    return "not_configured";
  }

  const claimed = await deps.db.query<{ attempts: number; lead_id: string }>(
    `UPDATE lead_notifications
     SET status = 'sending', attempts = attempts + 1, locked_until = $2::timestamptz + interval '2 minutes', updated_at = $2
     WHERE id = $1
       AND status IN ('pending', 'failed', 'sending')
       AND (next_attempt_at IS NULL OR next_attempt_at <= $2)
       AND (locked_until IS NULL OR locked_until <= $2)
     RETURNING attempts, lead_id`,
    [notificationId, now],
  );
  if (!claimed[0]) return "skipped";
  const attempts = Number(claimed[0].attempts);

  const leads = await deps.db.query<LeadForEmail>(
    `SELECT l.reference, l.name, l.email, l.phone, l.zip, l.in_service_area, l.service, l.details,
            l.preferred_time, l.time_zone, l.created_at, c.business_name, c.profile->>'timeZone' AS business_time_zone,
            c.is_demo, c.lead_destination_emails
     FROM leads l JOIN clients c ON c.id = l.client_id
     WHERE l.id = $1`,
    [claimed[0].lead_id],
  );
  const lead = leads[0];

  // Demo status is checked at send time, so a client switched to demo mode later is covered too.
  const demoRecipients = lead?.is_demo ? demoNotifyTo() : [];
  if (!lead || (lead.is_demo && demoRecipients.length === 0)) {
    await deps.db.query(
      `UPDATE lead_notifications SET status = 'suppressed_demo', locked_until = NULL, updated_at = $2 WHERE id = $1`,
      [notificationId, now],
    );
    return "suppressed_demo";
  }

  const email = buildLeadEmail(lead, notificationId, demoRecipients);
  const result: SendResult =
    email.to.length === 0
      ? { ok: false, reason: "no_destination" }
      : await deps.email(email).catch(() => ({ ok: false as const, reason: "sender_error" }));

  if (result.ok) {
    await deps.db.query(
      `UPDATE lead_notifications
       SET status = 'accepted', accepted_at = $2, provider_message_id = $3, last_error = NULL,
           locked_until = NULL, next_attempt_at = NULL, updated_at = $2
       WHERE id = $1`,
      [notificationId, now, result.providerId ?? null],
    );
    return "accepted";
  }

  const gaveUp = attempts >= maxNotificationAttempts();
  await deps.db.query(
    `UPDATE lead_notifications
     SET status = $3, last_error = $4, locked_until = NULL,
         next_attempt_at = CASE WHEN $3 = 'failed' THEN $2::timestamptz + make_interval(mins => $5) ELSE NULL END,
         updated_at = $2
     WHERE id = $1`,
    [notificationId, now, gaveUp ? "gave_up" : "failed", result.reason.slice(0, 100), retryDelayMinutes(attempts)],
  );
  // Log only the notification ID and a reason code, never lead details.
  console.error("[widget] lead notification failed", { notificationId, reason: result.reason, attempts, gaveUp });
  return gaveUp ? "gave_up" : "failed";
}

/** Retries notifications that are due. Run on a schedule (see docs/widget.md). */
export async function retryDueNotifications(deps: WidgetDeps, limit = 25): Promise<Record<DeliveryOutcome, number>> {
  const due = await deps.db.query<{ id: string }>(
    `SELECT id FROM lead_notifications
     WHERE status IN ('pending', 'failed', 'sending')
       AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
       AND (locked_until IS NULL OR locked_until <= $1)
     ORDER BY created_at
     LIMIT $2`,
    [deps.now(), limit],
  );
  const summary: Record<DeliveryOutcome, number> = {
    accepted: 0,
    failed: 0,
    gave_up: 0,
    not_configured: 0,
    suppressed_demo: 0,
    skipped: 0,
  };
  for (const { id } of due) summary[await deliverNotification(deps, id)] += 1;
  return summary;
}
