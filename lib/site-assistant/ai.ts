// Server-only: AI replies for the ConvoHatch site assistant via the Claude API.
// Enabled only when ANTHROPIC_API_KEY is set. Never import this from a client component.

import Anthropic from "@anthropic-ai/sdk";
import { buildFactSheet } from "./knowledge.ts";
import { MAX_ASSISTANT_INPUT } from "./scripted.ts";

// Sonnet 5 is roughly 60% cheaper than Opus 5 per token, and plenty for FAQ-style answers.
export const ASSISTANT_MODEL = "claude-sonnet-5";
export const MAX_HISTORY_MESSAGES = 16;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

// Kept byte-stable across requests so it can be served from the prompt cache.
export const SYSTEM_PROMPT = `You are the website assistant for ConvoHatch, shown in a chat window on ConvoHatch's marketing website. Visitors are usually owners or office managers of local service businesses (HVAC first; also plumbing, electrical, roofing, and other trades) deciding whether to request a demo.

Answer using only the facts in <site_facts>. They are the complete set of approved information about ConvoHatch.
- If a question isn't covered by the facts, say you don't know rather than guessing, and suggest requesting a demo so the team can answer it.
- Never invent prices, packages, discounts, trials, usage limits, contract terms, timelines, client names, results, statistics, testimonials, integrations, partnerships, or contact details (email, phone, address). Only state what the facts say.
- For pricing, use only the published Core and Custom Integrations details in the facts and point visitors to the Pricing page. Custom integrations are scoped and quoted, not included by default.
- You can't book meetings, send messages, or collect contact details. Visitors get in touch through the demo request form in the "Request a demo" section of this page. If someone shares personal details, don't repeat them; point them to the form.
- The "Try a sample chatbot" section on this page is an interactive demo with a fictional HVAC company.
- For off-topic requests, briefly say you can only help with questions about ConvoHatch.

Style: plain English for busy business owners. Usually one to three short sentences, at most about 80 words. Plain text only: no markdown, headings, bullet lists, or emoji. Friendly and direct; no buzzwords. Latency-sensitive; begin your visible answer immediately.

<site_facts>
${buildFactSheet()}
</site_facts>`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return client;
}

/** Validates untrusted chat history from the browser. Returns null if it isn't usable. */
export function parseHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_HISTORY_MESSAGES) return null;
  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > MAX_ASSISTANT_INPUT * 4) return null;
    turns.push({ role, content: text });
  }
  if (turns[0].role !== "user" || turns[turns.length - 1].role !== "user") return null;
  if (turns[turns.length - 1].content.length > MAX_ASSISTANT_INPUT) return null;
  return turns;
}

export type AiResult = { ok: true; text: string } | { ok: false; reason: string };

export async function generateReply(history: ChatTurn[]): Promise<AiResult> {
  try {
    const response = await getClient().messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 4096,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: history,
    });

    // A declined request falls back to the scripted reply in the browser.
    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refusal" };
    }

    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();

    if (!text) return { ok: false, reason: `empty:${response.stop_reason}` };
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "rate_limited" };
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, reason: "auth" };
    if (error instanceof Anthropic.APIError) return { ok: false, reason: `api_${error.status ?? "unknown"}` };
    return { ok: false, reason: "network" };
  }
}
