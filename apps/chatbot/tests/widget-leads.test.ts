import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { startConversation } from "../lib/conversations.ts";
import { normalizeLead, OTHER_SERVICE, validateLead } from "../lib/lead-fields.ts";
import { submitLead } from "../lib/leads.ts";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildLeadEmail, emailSender, maxNotificationAttempts, outboxSender, retryDueNotifications } from "../lib/notify.ts";
import { idempotencyKey, setup, validLead, type Fixture } from "./widget-fixtures.ts";

let f: Fixture;
before(async () => {
  f = await setup();
});
after(async () => {
  await f.db.close();
});

let visitorCounter = 0;
async function newConversation(publicId = "alpha-heating") {
  const visitor = `lead-${(visitorCounter += 1)}`;
  const started = await startConversation(f.deps(), { publicId, visitor });
  assert.ok(started.ok);
  return { conversationId: started.conversationId, visitor };
}

async function submit(
  lead: Record<string, string>,
  options: { publicId?: string; key?: string; confirmed?: unknown; deps?: Parameters<Fixture["deps"]>[0] } = {},
) {
  const publicId = options.publicId ?? "alpha-heating";
  const { conversationId, visitor } = await newConversation(publicId);
  return submitLead(f.deps(options.deps), {
    publicId,
    conversationId,
    visitor,
    body: { confirmed: "confirmed" in options ? options.confirmed : true, idempotencyKey: options.key ?? idempotencyKey(), lead },
  });
}

async function notificationFor(reference: string) {
  const rows = await f.db.query<{ status: string; attempts: number; last_error: string | null; id: string }>(
    "SELECT n.id, n.status, n.attempts, n.last_error FROM lead_notifications n JOIN leads l ON l.id = n.lead_id WHERE l.reference = $1",
    [reference],
  );
  return rows[0];
}

// --- Validation ---

test("lead validation requires name, a way to reach the visitor, ZIP, service, and callback time", () => {
  const services = ["AC repair"];
  const empty = validateLead(normalizeLead({}), services);
  assert.deepEqual(Object.keys(empty).sort(), ["contact", "name", "preferredTime", "service", "timeZone", "zip"]);

  assert.deepEqual(validateLead(normalizeLead(validLead()), services), {});
  assert.deepEqual(validateLead(normalizeLead(validLead({ email: "", phone: "555-010-1234" })), services), {});
  assert.ok(validateLead(normalizeLead(validLead({ email: "not-an-email" })), services).email);
  assert.ok(validateLead(normalizeLead(validLead({ phone: "12345" })), services).phone);
  assert.ok(validateLead(normalizeLead(validLead({ zip: "1234" })), services).zip);
  assert.ok(validateLead(normalizeLead(validLead({ service: "Roof repair" })), services).service, "unapproved service");
  assert.deepEqual(validateLead(normalizeLead(validLead({ service: OTHER_SERVICE })), services), {});
  assert.ok(validateLead(normalizeLead(validLead({ preferredTime: "3am please" })), services).preferredTime);
  assert.ok(validateLead(normalizeLead(validLead({ timeZone: "Mars/Olympus" })), services).timeZone);
  assert.ok(validateLead(normalizeLead(validLead({ name: "x".repeat(101) })), services).name);
});

test("the server rejects invalid leads and stores nothing", async () => {
  const before = await f.db.query("SELECT id FROM leads");
  const result = await submit(validLead({ email: "", phone: "" }));
  assert.equal(!result.ok && result.status, 422);
  assert.ok(!result.ok && result.errors?.contact);
  assert.equal((await f.db.query("SELECT id FROM leads")).length, before.length);
});

test("a lead is only accepted after explicit confirmation", async () => {
  for (const confirmed of [undefined, false, "true", 1]) {
    const result = await submit(validLead(), { confirmed });
    assert.equal(!result.ok && result.error, "not_confirmed", String(confirmed));
  }
});

test("the hidden spam-trap field rejects the submission", async () => {
  const { conversationId, visitor } = await newConversation();
  const result = await submitLead(f.deps(), {
    publicId: "alpha-heating",
    conversationId,
    visitor,
    body: { confirmed: true, idempotencyKey: idempotencyKey(), lead: validLead(), website: "http://spam.example" },
  });
  assert.equal(!result.ok && result.error, "rejected");
});

// --- Storage, duplicates, and notification ---

test("a valid lead is stored, then the notification is sent and marked accepted (not delivered)", async () => {
  f.email.sent.length = 0;
  const result = await submit(validLead({ phone: "555 010 7777", email: "" }));
  assert.ok(result.ok);
  assert.match(result.reference, /^CH-[A-Z2-9]{8}$/);
  assert.equal(result.duplicate, false);
  assert.equal(result.notification, "accepted");

  const [lead] = await f.db.query<{ phone: string; in_service_area: boolean }>("SELECT phone, in_service_area FROM leads WHERE reference = $1", [
    result.reference,
  ]);
  assert.equal(lead.phone, "(555) 010-7777");
  assert.equal(lead.in_service_area, true);
  assert.equal((await notificationFor(result.reference)).status, "accepted");

  const [email] = f.email.sent;
  assert.deepEqual(email.to, ["office@alpha.example"]);
  assert.match(email.text, /not a confirmed appointment/);
  assert.match(email.text, /Preferred callback: First available day, Morning \(8 AM – 12 PM\) \(Central Daylight Time, America\/Chicago\) — a preference, not a scheduled time/);
  assert.match(email.subject, new RegExp(result.reference));
});

test("resubmitting with the same idempotency key returns the original lead without a second email", async () => {
  f.email.sent.length = 0;
  const key = idempotencyKey();
  const first = await submit(validLead({ email: "repeat@example.com" }), { key });
  const second = await submit(validLead({ email: "repeat@example.com" }), { key });
  assert.ok(first.ok && second.ok);
  assert.equal(second.reference, first.reference);
  assert.equal(second.duplicate, true);
  assert.equal(f.email.sent.length, 1);
  const rows = await f.db.query("SELECT id FROM leads WHERE email = 'repeat@example.com'");
  assert.equal(rows.length, 1);
});

test("the same request submitted twice the same day (new key) is not duplicated", async () => {
  f.email.sent.length = 0;
  const lead = validLead({ email: "twice@example.com", service: "Furnace repair" });
  const first = await submit(lead);
  const second = await submit({ ...lead, name: "Jordan S.", details: "Again" });
  assert.ok(first.ok && second.ok);
  assert.equal(second.reference, first.reference);
  assert.equal(second.duplicate, true);
  assert.equal(f.email.sent.length, 1);

  // A different service is a different request.
  const third = await submit({ ...lead, service: "AC repair" });
  assert.ok(third.ok && !third.duplicate);
});

test("concurrent double-clicks create one lead", async () => {
  const key = idempotencyKey();
  const { conversationId, visitor } = await newConversation();
  const body = { confirmed: true, idempotencyKey: key, lead: validLead({ email: "race@example.com" }) };
  const results = await Promise.all(
    [1, 2, 3].map(() => submitLead(f.deps(), { publicId: "alpha-heating", conversationId, visitor, body })),
  );
  const references = new Set(results.map((result) => (result.ok ? result.reference : "error")));
  assert.equal(references.size, 1);
  assert.ok(!references.has("error"));
  assert.equal((await f.db.query("SELECT id FROM leads WHERE email = 'race@example.com'")).length, 1);
});

test("an out-of-area ZIP is accepted but flagged for the contractor", async () => {
  const result = await submit(validLead({ zip: "99999", email: "far@example.com" }));
  assert.ok(result.ok);
  assert.equal(result.inServiceArea, false);
  assert.match(f.email.sent.at(-1)!.text, /NOT in your service-area list/);
});

// --- Notification failures and retries ---

test("an email failure keeps the lead, records the failure, and retries later without a duplicate lead", async () => {
  f.email.sent.length = 0;
  f.email.results.push({ ok: false, reason: "resend_500" });
  const result = await submit(validLead({ email: "retry@example.com" }));
  assert.ok(result.ok, "the visitor still gets a reference: the request is stored");
  assert.equal(result.notification, "failed");

  let notification = await notificationFor(result.reference);
  assert.equal(notification.status, "failed");
  assert.equal(notification.attempts, 1);
  assert.equal(notification.last_error, "resend_500");

  // Not due yet: nothing is sent.
  let summary = await retryDueNotifications(f.deps());
  assert.equal(summary.accepted, 0);

  // After the backoff, the retry succeeds.
  const later = new Date(f.clock.now.getTime() + 5 * 60_000);
  summary = await retryDueNotifications(f.deps({ now: () => later }));
  assert.equal(summary.accepted, 1);
  notification = await notificationFor(result.reference);
  assert.equal(notification.status, "accepted");
  assert.equal(notification.attempts, 2);
  assert.equal((await f.db.query("SELECT id FROM leads WHERE email = 'retry@example.com'")).length, 1);
  // Both attempts used the same provider idempotency key, so the provider can drop a repeat.
  assert.equal(f.email.sent[0].idempotencyKey, f.email.sent[1].idempotencyKey);

  // Accepted notifications are never sent again.
  const muchLater = new Date(f.clock.now.getTime() + 60 * 60_000);
  summary = await retryDueNotifications(f.deps({ now: () => muchLater }));
  assert.equal(f.email.sent.length, 2);
});

test("retries stop after the maximum number of attempts", async () => {
  const max = maxNotificationAttempts();
  for (let index = 0; index < max; index += 1) f.email.results.push({ ok: false, reason: "network" });
  const result = await submit(validLead({ email: "giveup@example.com" }));
  assert.ok(result.ok);
  let time = f.clock.now.getTime();
  for (let index = 1; index < max; index += 1) {
    time += 7 * 60 * 60_000;
    await retryDueNotifications(f.deps({ now: () => new Date(time) }));
  }
  const notification = await notificationFor(result.reference);
  assert.equal(notification.status, "gave_up");
  assert.equal(notification.attempts, max);
});

test("without an email provider, the lead is stored and waits for configuration", async () => {
  const result = await submit(validLead({ email: "noemail@example.com" }), { deps: { email: null } });
  assert.ok(result.ok);
  assert.equal(result.notification, "not_configured");
  const notification = await notificationFor(result.reference);
  assert.equal(notification.status, "pending");
  assert.equal(notification.last_error, "email_not_configured");

  // Once email is configured, the retry job sends it.
  const summary = await retryDueNotifications(f.deps());
  assert.ok(summary.accepted >= 1);
  assert.equal((await notificationFor(result.reference)).status, "accepted");
});

test("demo clients store leads but never send notifications", async () => {
  f.email.sent.length = 0;
  const result = await submit(validLead({ email: "demo@example.com" }), { publicId: "demo-client" });
  assert.ok(result.ok);
  assert.equal(result.notification, "suppressed_demo");
  assert.equal((await notificationFor(result.reference)).status, "suppressed_demo");
  await retryDueNotifications(f.deps({ now: () => new Date(f.clock.now.getTime() + 86_400_000) }));
  assert.equal(f.email.sent.length, 0);
});

test("with a demo inbox configured, demo leads go only to that inbox, marked as a demo", async () => {
  process.env.WIDGET_DEMO_NOTIFY_TO = "operator@convohatch.example, not-an-email";
  try {
    f.email.sent.length = 0;
    const result = await submit(validLead({ email: "demo-inbox@example.com" }), { publicId: "demo-client" });
    assert.ok(result.ok);
    assert.equal(result.notification, "accepted");
    assert.equal(f.email.sent.length, 1);
    const [email] = f.email.sent;
    assert.deepEqual(email.to, ["operator@convohatch.example"]);
    assert.match(email.subject, /^\[DEMO\] /);
    assert.match(email.text, /^DEMO: /);
    assert.match(email.text, /not to any contractor/);
    assert.equal(email.replyTo, undefined, "no reply-to a demo visitor");
  } finally {
    delete process.env.WIDGET_DEMO_NOTIFY_TO;
  }
});

test("a demo inbox never redirects a real client's leads", async () => {
  process.env.WIDGET_DEMO_NOTIFY_TO = "operator@convohatch.example";
  try {
    f.email.sent.length = 0;
    const result = await submit(validLead({ email: "real-client@example.com" }));
    assert.ok(result.ok);
    assert.deepEqual(f.email.sent[0].to, ["office@alpha.example"]);
    assert.doesNotMatch(f.email.sent[0].subject, /DEMO/);
  } finally {
    delete process.env.WIDGET_DEMO_NOTIFY_TO;
  }
});

test("a client switched to demo mode after a lead was stored is not emailed", async () => {
  f.email.sent.length = 0;
  const result = await submit(validLead({ email: "switch@example.com" }), { publicId: "bravo-cooling", deps: { email: null } });
  assert.ok(result.ok);
  await f.db.query("UPDATE clients SET is_demo = true WHERE public_id = 'bravo-cooling'");
  await retryDueNotifications(f.deps());
  assert.equal(f.email.sent.length, 0);
  assert.equal((await notificationFor(result.reference)).status, "suppressed_demo");
  await f.db.query("UPDATE clients SET is_demo = false WHERE public_id = 'bravo-cooling'");
});

test("the notification email uses single-line headers", () => {
  const email = buildLeadEmail(
    {
      reference: "CH-TEST",
      name: "Line\nBreak",
      email: null,
      phone: "(555) 010-0000",
      zip: "11111",
      in_service_area: true,
      service: "AC\r\nrepair",
      details: null,
      preferred_time: "As soon as possible",
      time_zone: "America/Chicago",
      created_at: new Date("2026-09-28T15:00:00Z"),
      business_name: "Alpha Heating",
      business_time_zone: "America/Chicago",
      is_demo: false,
      lead_destination_emails: ["office@alpha.example"],
    },
    "n1",
  );
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.equal(email.replyTo, undefined);
});

test("the local outbox provider writes one file per notification and is refused on Vercel", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "outbox-"));
  try {
    const send = outboxSender(dir);
    const email = { to: ["office@alpha.example"], subject: "Callback request", text: "Body", idempotencyKey: "convohatch-lead-n1" };
    const first = await send(email);
    const second = await send(email);
    assert.deepEqual(first, { ok: true, providerId: "outbox:convohatch-lead-n1.eml" });
    assert.deepEqual(second, first);
    assert.deepEqual(await readdir(dir), ["convohatch-lead-n1.eml"], "a repeated send doesn't duplicate");
    assert.match(await readFile(path.join(dir, "convohatch-lead-n1.eml"), "utf8"), /^To: office@alpha\.example\nSubject: Callback request/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const saved = { provider: process.env.WIDGET_EMAIL_PROVIDER, vercel: process.env.VERCEL, key: process.env.RESEND_API_KEY };
  process.env.WIDGET_EMAIL_PROVIDER = "outbox";
  assert.ok(emailSender());
  process.env.VERCEL = "1";
  assert.equal(emailSender(), null);
  delete process.env.VERCEL;
  process.env.WIDGET_EMAIL_PROVIDER = "resend";
  delete process.env.RESEND_API_KEY;
  assert.equal(emailSender(), null, "Resend without credentials is not configured");
  for (const [name, value] of [["WIDGET_EMAIL_PROVIDER", saved.provider], ["VERCEL", saved.vercel], ["RESEND_API_KEY", saved.key]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
