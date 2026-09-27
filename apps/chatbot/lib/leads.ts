// Server-only: stores service requests (leads) and triggers their notification.
// A lead is written to the database, together with its notification record, before the visitor
// is told it was received. Email is attempted afterwards and retried if it fails.

import { createHash, randomInt } from "node:crypto";
import { isInServiceArea } from "./answers.ts";
import { getActiveClient } from "./clients.ts";
import { findConversation, notFound, rateLimited, type Failure } from "./conversations.ts";
import type { WidgetDeps } from "./deps.ts";
import {
  ANY_DAY,
  formatPhone,
  hasLeadErrors,
  normalizeLead,
  parsePhone,
  validateLead,
  type LeadErrors,
} from "./lead-fields.ts";
import { WINDOWS, clientLimit, consume, widgetLimits } from "./limits.ts";
import { deliverNotification, demoNotifyTo, type DeliveryOutcome } from "./notify.ts";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{16,64}$/;
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReference(): string {
  let code = "";
  for (let index = 0; index < 8; index += 1) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `CH-${code}`;
}

/**
 * Same contact, ZIP, and service on the same day counts as one request. On demo clients many
 * visitors use the same fictional sample details, so there it's also scoped to the visitor
 * (hashed IP); otherwise one visitor would be told another's request was theirs.
 */
export function dedupeKey(
  clientId: string,
  fields: { email: string | null; phone: string | null; zip: string; service: string },
  now: Date,
  visitorScope = "",
) {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256")
    .update([clientId, fields.email ?? "", fields.phone ?? "", fields.zip, fields.service.toLowerCase(), day, visitorScope].join("|"))
    .digest("hex");
}

export type LeadResult =
  | {
      ok: true;
      reference: string;
      /** True when this repeats an earlier submission; no new lead or notification was created. */
      duplicate: boolean;
      inServiceArea: boolean;
      /** For server logs and tests only. Never shown to the visitor as "delivered". */
      notification: DeliveryOutcome | "existing";
    }
  | (Failure & { errors?: LeadErrors });

export async function submitLead(
  deps: WidgetDeps,
  input: { publicId: unknown; conversationId: unknown; body: Record<string, unknown>; visitor: string },
): Promise<LeadResult> {
  const client = typeof input.publicId === "string" ? await getActiveClient(deps.db, input.publicId) : null;
  if (!client) return notFound();
  const conversation = await findConversation(deps, client, input.conversationId);
  if (!conversation) return notFound();

  // The visitor must review the request and press Submit; the widget sends confirmed: true only then.
  if (input.body.confirmed !== true) return { ok: false, status: 400, error: "not_confirmed" };
  const idempotencyKey = input.body.idempotencyKey;
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return { ok: false, status: 400, error: "invalid_idempotency_key" };
  }
  // Hidden spam-trap field.
  if (typeof input.body.website === "string" && input.body.website.trim() !== "") {
    return { ok: false, status: 400, error: "rejected" };
  }

  const now = deps.now();
  if (!(await consume(deps.db, `v:${input.visitor}:${client.id}:lead`, WINDOWS.hour, widgetLimits().visitorLeadsPerHour, now))) {
    return rateLimited("Too many requests were sent from your connection. Please try again later.");
  }

  const lead = normalizeLead(input.body.lead);
  const errors = validateLead(
    lead,
    client.profile.services.map((service) => service.name),
    { timeZone: client.profile.timeZone, hours: client.profile.hours, now },
  );
  if (hasLeadErrors(errors)) return { ok: false, status: 422, error: "invalid", errors };

  const email = lead.email || null;
  const parsedPhone = lead.phone ? parsePhone(lead.phone) : null;
  const digits = parsedPhone?.digits ?? null;
  const phone = parsedPhone ? formatPhone(parsedPhone) : null;
  const inServiceArea = isInServiceArea(client, lead.zip);

  // A retried submission (same idempotency key) returns the original lead.
  const repeat = await deps.db.query<{ reference: string; in_service_area: boolean }>(
    "SELECT reference, in_service_area FROM leads WHERE client_id = $1 AND idempotency_key = $2",
    [client.id, idempotencyKey],
  );
  if (repeat[0]) {
    return { ok: true, reference: repeat[0].reference, duplicate: true, inServiceArea: repeat[0].in_service_area, notification: "existing" };
  }

  if (!(await consume(deps.db, `c:${client.id}:lead`, WINDOWS.day, clientLimit(client, "dailyLeads"), now))) {
    const phoneLine = client.profile.contact.phone ? ` Please call ${client.businessName} at ${client.profile.contact.phone}.` : "";
    return { ok: false, status: 429, error: "client_lead_limit", message: `Online requests are paused for today.${phoneLine}` };
  }

  const dedupe = dedupeKey(client.id, { email, phone: digits, zip: lead.zip, service: lead.service }, now, client.isDemo ? input.visitor : "");
  let inserted: { lead_id: string; reference: string; notification_id: string } | undefined;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    try {
      // One statement: the lead and its notification record are stored together or not at all.
      const rows = await deps.db.query<{ lead_id: string; reference: string; notification_id: string }>(
        `WITH new_lead AS (
           INSERT INTO leads (client_id, conversation_id, reference, idempotency_key, dedupe_key, name, email, phone,
                              zip, in_service_area, service, details, preferred_time, time_zone, created_at, preferred_day)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $17::date)
           ON CONFLICT (client_id, idempotency_key) DO NOTHING
           RETURNING id, reference
         ), new_notification AS (
           INSERT INTO lead_notifications (lead_id, client_id, status, next_attempt_at, created_at, updated_at)
           SELECT id, $1, $16, NULL, $15, $15 FROM new_lead
           RETURNING id, lead_id
         )
         SELECT new_lead.id AS lead_id, new_lead.reference, new_notification.id AS notification_id
         FROM new_lead JOIN new_notification ON new_notification.lead_id = new_lead.id`,
        [
          client.id,
          conversation.id,
          newReference(),
          idempotencyKey,
          dedupe,
          lead.name,
          email,
          phone,
          lead.zip,
          inServiceArea,
          lead.service,
          lead.details || null,
          lead.preferredTime,
          lead.timeZone,
          now,
          // Demo leads are emailed only when a demo inbox is configured, and only to that inbox.
          client.isDemo && demoNotifyTo().length === 0 ? "suppressed_demo" : "pending",
          lead.preferredDay === ANY_DAY ? null : lead.preferredDay,
        ],
      );
      inserted = rows[0];
      if (!inserted) break;
    } catch (error) {
      const code = (error as { code?: string }).code;
      const constraint = (error as { constraint?: string }).constraint ?? String((error as Error).message);
      // 23505 = unique violation. A reference collision is retried; a same-day duplicate isn't.
      if (code === "23505" && constraint.includes("reference")) continue;
      if (code === "23505") break;
      throw error;
    }
  }

  if (!inserted) {
    const existing = await deps.db.query<{ reference: string; in_service_area: boolean }>(
      "SELECT reference, in_service_area FROM leads WHERE client_id = $1 AND (idempotency_key = $2 OR dedupe_key = $3) LIMIT 1",
      [client.id, idempotencyKey, dedupe],
    );
    if (!existing[0]) throw new Error("lead insert failed without a matching existing lead");
    return { ok: true, reference: existing[0].reference, duplicate: true, inServiceArea: existing[0].in_service_area, notification: "existing" };
  }

  // The request is stored at this point. A failure while notifying must never be reported to the
  // visitor as a failed submission (they'd send it again); the notification stays pending/failed
  // in the database and the retry job picks it up.
  let notification: DeliveryOutcome;
  if (client.isDemo && demoNotifyTo().length === 0) {
    notification = "suppressed_demo";
  } else {
    try {
      notification = await deliverNotification(deps, inserted.notification_id);
    } catch (error) {
      console.error("[widget] lead notification attempt errored", { notificationId: inserted.notification_id, error: (error as Error).name });
      notification = "failed";
    }
  }
  return { ok: true, reference: inserted.reference, duplicate: false, inServiceArea, notification };
}

/** Service-area check for the request form's review step. */
export async function checkServiceArea(
  deps: WidgetDeps,
  input: { publicId: unknown; zip: unknown; visitor: string },
): Promise<{ ok: true; inServiceArea: boolean } | Failure> {
  const client = typeof input.publicId === "string" ? await getActiveClient(deps.db, input.publicId) : null;
  if (!client) return notFound();
  if (typeof input.zip !== "string" || !/^\d{5}$/.test(input.zip)) return { ok: false, status: 400, error: "invalid_zip" };
  if (!(await consume(deps.db, `v:${input.visitor}:${client.id}:zip`, WINDOWS.tenMinutes, widgetLimits().visitorMessagesPer10Min, deps.now()))) {
    return rateLimited();
  }
  return { ok: true, inServiceArea: isInServiceArea(client, input.zip) };
}
