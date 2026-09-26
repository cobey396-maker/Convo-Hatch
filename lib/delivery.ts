// Server-only: delivers demo requests using environment-configured credentials.
// Never import this module from a client component.

import type { DemoRequestInput } from "./demo-request.ts";

export type DeliveryProvider = "resend" | "webhook";

export class DeliveryError extends Error {
  readonly provider: DeliveryProvider;
  readonly status: number | "network";

  constructor(provider: DeliveryProvider, status: number | "network") {
    super(`Delivery via ${provider} failed (${status})`);
    this.name = "DeliveryError";
    this.provider = provider;
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Returns the configured provider, or null when submissions are unavailable. */
export function getDeliveryProvider(): DeliveryProvider | null {
  if (env("RESEND_API_KEY") && env("DEMO_REQUEST_TO_EMAIL") && env("DEMO_REQUEST_FROM_EMAIL")) {
    return "resend";
  }
  const webhook = env("DEMO_REQUEST_WEBHOOK_URL");
  if (webhook && webhook.startsWith("https://")) {
    return "webhook";
  }
  return null;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatText(input: DemoRequestInput, submittedAt: string): string {
  return [
    "New ConvoHatch demo request",
    "",
    `Name: ${input.name}`,
    `Business: ${input.business}`,
    `Email: ${input.email}`,
    `Website: ${input.website || "Not provided"}`,
    `Trade: ${input.trade}`,
    `Submitted: ${submittedAt}`,
    "",
    "What they need help with:",
    input.message,
  ].join("\n");
}

async function send(provider: DeliveryProvider, url: string, init: RequestInit): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new DeliveryError(provider, "network");
  }
  if (!response.ok) {
    throw new DeliveryError(provider, response.status);
  }
}

export async function deliverDemoRequest(
  provider: DeliveryProvider,
  input: DemoRequestInput,
): Promise<void> {
  const submittedAt = new Date().toISOString();

  if (provider === "resend") {
    await send(provider, "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env("DEMO_REQUEST_FROM_EMAIL"),
        to: [env("DEMO_REQUEST_TO_EMAIL")],
        reply_to: input.email,
        subject: singleLine(`Demo request: ${input.business} (${input.trade})`),
        text: formatText(input, submittedAt),
      }),
    });
    return;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = env("DEMO_REQUEST_WEBHOOK_SECRET");
  if (secret) headers.Authorization = `Bearer ${secret}`;

  await send(provider, env("DEMO_REQUEST_WEBHOOK_URL"), {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "demo_request", submittedAt, ...input }),
  });
}
