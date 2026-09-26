// Server-only: tells the owner about new call bookings using environment-configured credentials.
// Never import this module from a client component.

import { schedule } from "../content/site.ts";
import { formatSlot, type BookingInput } from "./booking.ts";

export type NotifyChannel = "sms" | "ntfy" | "email" | "webhook";

const REQUEST_TIMEOUT_MS = 10_000;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Owner notification channels that are fully configured. Bookings are disabled when this is empty. */
export function getNotifyChannels(): NotifyChannel[] {
  const channels: NotifyChannel[] = [];
  if (env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM_NUMBER") && env("BOOKING_NOTIFY_PHONE")) {
    channels.push("sms");
  }
  if (env("NTFY_TOPIC")) channels.push("ntfy");
  if (env("RESEND_API_KEY") && env("DEMO_REQUEST_TO_EMAIL") && env("DEMO_REQUEST_FROM_EMAIL")) {
    channels.push("email");
  }
  if (env("DEMO_REQUEST_WEBHOOK_URL").startsWith("https://")) channels.push("webhook");
  return channels;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function ownerText(input: BookingInput): string {
  return [
    "New ConvoHatch call booked",
    formatSlot(input.slot),
    "",
    `Name: ${singleLine(input.name)}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone}`,
    "",
    "Send them a Zoom link before the call.",
  ].join("\n");
}

/** Why a channel failed, safe to log: provider status plus its error text with contact details removed. */
export class NotifyError extends Error {
  readonly status: number | "network";
  readonly detail: string;

  constructor(status: number | "network", detail: string) {
    super(`${status}${detail ? `: ${detail}` : ""}`);
    this.name = "NotifyError";
    this.status = status;
    this.detail = detail;
  }
}

function redact(text: string): string {
  return text
    .replace(/[^\s@"]+@[^\s@"]+\.[^\s@"]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

async function send(url: string, init: RequestInit): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new NotifyError("network", redact(error instanceof Error ? error.message : ""));
  }
  if (!response.ok) throw new NotifyError(response.status, redact(await response.text().catch(() => "")));
}

/**
 * The ntfy URL to publish to. Accepts a bare topic ("my-topic"), "ntfy.sh/my-topic", or a full
 * URL ("https://ntfy.sh/my-topic"), since the app shows topics in all three forms.
 */
export function ntfyUrl(topic = env("NTFY_TOPIC"), server = env("NTFY_SERVER") || "https://ntfy.sh"): string {
  const value = topic.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(value)) return value;
  const bare = value.replace(/^(www\.)?ntfy\.sh\//i, "").replace(/^\/+/, "");
  return `${server.replace(/\/+$/, "")}/${encodeURIComponent(bare)}`;
}

async function notify(channel: NotifyChannel, input: BookingInput, bookedAt: string): Promise<void> {
  const text = ownerText(input);

  switch (channel) {
    case "sms": {
      const sid = env("TWILIO_ACCOUNT_SID");
      await send(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: env("TWILIO_FROM_NUMBER"), To: env("BOOKING_NOTIFY_PHONE"), Body: text }),
      });
      return;
    }
    case "ntfy": {
      await send(ntfyUrl(), {
        method: "POST",
        headers: { Title: "New call booked", Tags: "calendar", Priority: "high" },
        body: text,
      });
      return;
    }
    case "email": {
      await send("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env("DEMO_REQUEST_FROM_EMAIL"),
          to: [env("DEMO_REQUEST_TO_EMAIL")],
          reply_to: input.email,
          subject: singleLine(`Call booked: ${input.name}, ${formatSlot(input.slot)}`),
          text,
        }),
      });
      return;
    }
    case "webhook": {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const secret = env("DEMO_REQUEST_WEBHOOK_SECRET");
      if (secret) headers.Authorization = `Bearer ${secret}`;
      await send(env("DEMO_REQUEST_WEBHOOK_URL"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "call_booking",
          bookedAt,
          start: input.slot,
          startLabel: formatSlot(input.slot),
          timeZone: schedule.timeZone,
          name: input.name,
          email: input.email,
          phone: input.phone,
        }),
      });
      return;
    }
  }
}

/**
 * Sends the booking to every configured channel. Succeeds if at least one channel delivered it,
 * so one broken provider doesn't lose the booking. Returns why any channels failed.
 */
export interface NotifyFailure {
  channel: NotifyChannel;
  reason: string;
}

export class AllChannelsFailedError extends Error {
  readonly failures: NotifyFailure[];

  constructor(failures: NotifyFailure[]) {
    super("all notification channels failed");
    this.name = "AllChannelsFailedError";
    this.failures = failures;
  }
}

export async function notifyOwner(channels: NotifyChannel[], input: BookingInput): Promise<NotifyFailure[]> {
  const bookedAt = new Date().toISOString();
  const results = await Promise.allSettled(channels.map((channel) => notify(channel, input, bookedAt)));
  const failures: NotifyFailure[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason instanceof NotifyError ? result.reason.message : "unknown error";
      failures.push({ channel: channels[index], reason });
    }
  });
  if (failures.length === channels.length) throw new AllChannelsFailedError(failures);
  return failures;
}

/** Best-effort confirmation email to the visitor. Only sent when Resend is configured. */
export async function confirmToVisitor(input: BookingInput): Promise<void> {
  if (!getNotifyChannels().includes("email")) return;
  await send("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("DEMO_REQUEST_FROM_EMAIL"),
      to: [input.email],
      reply_to: env("DEMO_REQUEST_TO_EMAIL"),
      subject: singleLine(`Your ConvoHatch call: ${formatSlot(input.slot)}`),
      text: [
        `Hi ${singleLine(input.name)},`,
        "",
        `Thanks for booking a call with ConvoHatch for ${formatSlot(input.slot)}.`,
        "We’ll email you a Zoom link before the call.",
        "",
        "Need to change the time? Just reply to this email.",
      ].join("\n"),
    }),
  });
}
