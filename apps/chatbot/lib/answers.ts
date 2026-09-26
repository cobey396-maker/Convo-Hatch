// Deterministic replies for the hosted widget. These never call an AI model:
// service-area checks, emergencies, repair-instruction requests, contact details typed into chat,
// and (when live AI is unavailable) answers matched from the client's approved FAQs.

import { formatHours, timeZoneLabel, type ClientConfig } from "./config.ts";

export type ReplySource = "ai" | "faq" | "rule" | "limit";

export interface Reply {
  text: string;
  source: ReplySource;
  /** Show a prominent "Request a callback" button with this reply. */
  suggestCallback?: boolean;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/g;
export const REDACTED = "[contact details removed]";

/** Removes email addresses and phone numbers so they're never stored with the chat or sent to the AI. */
export function redactContactDetails(text: string): { text: string; redacted: boolean } {
  const redactedText = text.replace(EMAIL, REDACTED).replace(PHONE, REDACTED);
  return { text: redactedText, redacted: redactedText !== text };
}

/** The first US ZIP code in the text (ZIP+4 is accepted and trimmed), or null. */
export function findZip(text: string): string | null {
  const match = /(?<![\d-])(\d{5})(?:-\d{4})?(?![\d-])/.exec(text);
  return match ? match[1] : null;
}

export function isInServiceArea(client: ClientConfig, zip: string): boolean {
  return client.serviceZipCodes.includes(zip);
}

export function serviceAreaReply(client: ClientConfig, zip: string): Reply {
  if (isInServiceArea(client, zip)) {
    return {
      text: `Yes, ZIP ${zip} is in ${client.businessName}’s service area. Would you like to request a callback about service?`,
      source: "rule",
      suggestCallback: true,
    };
  }
  return {
    text: `ZIP ${zip} isn’t on ${client.businessName}’s list of service-area ZIP codes, so they may not be able to help at that address. You can still send a callback request, and the office will let you know.`,
    source: "rule",
    suggestCallback: true,
  };
}

/** True when the message is essentially just a service-area question about a ZIP code. */
export function isServiceAreaOnly(text: string): boolean {
  const rest = text
    .toLowerCase()
    .replace(/(?<![\d-])\d{5}(?:-\d{4})?(?![\d-])/g, " ")
    .replace(
      /\b(hi|hello|hey|do|does|you|y'all|your|guys|service|services|serve|servicing|cover|covers|come|go|out|to|in|my|zip|code|area|is|are|am|i|we|live|located|located|at|the|a|an|near|what|about|how|check|can|could|please|thanks|thank|ok|okay|yes|no|there|here|it|that|this|for|of|on|work|within|inside)\b/g,
      " ",
    )
    .replace(/[^a-z]+/g, " ")
    .trim();
  return rest.length === 0;
}

const EMERGENCY =
  /(smell(s|ing|ed)?\s+(of\s+|like\s+)?(natural\s+)?gas|gas\s+(smell|leak|odou?r)|carbon\s+monoxide|\bco\s+(alarm|detector)|(furnace|unit|vent|wires?|wiring|outlet|breaker|panel)\s+(is\s+)?(on\s+fire|sparking|smoking)|\bsmoke\s+(coming|pouring)|\bon\s+fire\b|burning\s+(smell|odou?r)|smell(s|ing)?\s+(like\s+)?(something\s+)?burning)/i;

export function isEmergency(text: string): boolean {
  return EMERGENCY.test(text);
}

const DEFAULT_EMERGENCY =
  "If you smell gas, a carbon monoxide alarm is sounding, or you see smoke or fire, leave the building now and call 911 from outside.";

export function emergencyReply(client: ClientConfig): Reply {
  return {
    text: `${client.profile.emergencyMessage ?? DEFAULT_EMERGENCY} This chat can’t handle emergencies.`,
    source: "rule",
  };
}

const REPAIR_HELP =
  /(\b(how\s+(do|can|should|would)\s+(i|we|you)|how\s+to|steps?\s+(to|for)|walk\s+me\s+through|can\s+i|should\s+i|is\s+it\s+safe\s+to|teach\s+me|show\s+me\s+how|instructions?\s+(to|for)|tips?\s+(to|for)|diy|myself|on\s+my\s+own)\b[^.?!]{0,60}\b(fix|repair|reset|replace|recharge|refill|unclog|troubleshoot|rewire|wire|bypass|relight|light\s+the\s+pilot|disassemble|take\s+apart|open\s+up|add\s+freon|add\s+refrigerant|jump|short)\b)|\b(troubleshoot(ing)?|diy\s+(fix|repair))\b/i;

// "Can I get someone to fix my AC?" is a service request, not a request for instructions.
const WANTS_A_TECHNICIAN =
  /\b(someone|somebody|anyone|technician|tech|techs|you guys|your (team|crew|techs?)|a pro|professional|send|get (it|this|that|my [a-z]+) (fixed|repaired|looked at|checked))\b/i;
const DIY = /\b(myself|diy|on my own|by myself)\b/i;

export function isRepairInstructionRequest(text: string): boolean {
  if (!REPAIR_HELP.test(text)) return false;
  return DIY.test(text) || !WANTS_A_TECHNICIAN.test(text);
}

export function repairReply(client: ClientConfig): Reply {
  return {
    text: `I can’t give repair or troubleshooting instructions. A ${client.businessName} technician can look at it for you. Would you like to request a callback?`,
    source: "rule",
    suggestCallback: true,
  };
}

export function contactDetailsReply(client: ClientConfig): Reply {
  return {
    text: `Thanks. For your privacy, I removed the contact details from this chat. To have ${client.businessName} reach you, please use the callback request form, where you can review your details before sending.`,
    source: "rule",
    suggestCallback: true,
  };
}

export function unknownReply(client: ClientConfig, aiUnavailable: boolean): Reply {
  const prefix = aiUnavailable ? "Live AI answers are unavailable right now, and I don’t" : "I don’t";
  return {
    text: `${prefix} have approved information about that from ${client.businessName}, so I’d rather not guess. You can request a callback and the office can answer it directly.`,
    source: "faq",
    suggestCallback: true,
  };
}

// --- Matching approved information without AI -------------------------------------------------

const STOP_WORDS = new Set(
  "a an and are as at be but by can could do does for from get got have how i if in is it its me my of on or our so than that the their them then there these they this to us was we what when where which who why will with would you your yours".split(
    " ",
  ),
);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map((word) => word.replace(/(ies|es|s)$/, (suffix) => (suffix === "ies" ? "y" : "")));
}

function contactLine(client: ClientConfig): string | null {
  const { phone, email, address, website } = client.profile.contact;
  const parts = [
    phone && `phone ${phone}`,
    email && `email ${email}`,
    address && `address ${address}`,
    website && `website ${website}`,
  ].filter(Boolean);
  return parts.length ? `You can reach ${client.businessName} by ${parts.join(", ")}.` : null;
}

/**
 * Best-effort answer from the client's approved information, used when live AI is unavailable.
 * Returns null when nothing matches well enough, so the caller can admit it doesn't know.
 */
export function approvedInfoReply(client: ClientConfig, text: string): Reply | null {
  const lower = text.toLowerCase();
  const { profile } = client;

  const tokens = new Set(words(text));
  let best: { score: number; answer: string } | null = null;
  for (const faq of profile.faqs) {
    const questionWords = new Set(words(faq.question));
    let score = 0;
    for (const word of tokens) if (questionWords.has(word)) score += 1;
    const ratio = questionWords.size ? score / questionWords.size : 0;
    if (score >= 2 || (score >= 1 && ratio >= 0.5)) {
      if (!best || score > best.score) best = { score, answer: faq.answer };
    }
  }
  if (best) return { text: best.answer, source: "faq", suggestCallback: true };

  if (/\b(hours?|open|close[sd]?|closing|weekends?|saturday|sunday|holiday)\b/.test(lower)) {
    const lines = formatHours(profile).join("; ");
    const note = profile.hoursNote ? ` ${profile.hoursNote}` : "";
    return {
      text: `${client.businessName}’s office hours (${timeZoneLabel(profile.timeZone)}) are: ${lines}.${note}`,
      source: "faq",
    };
  }

  if (/\b(price|pricing|cost|costs|how much|fee|fees|charge|charges|quote|estimate|rates?|discount|coupon|financing)\b/.test(lower)) {
    return {
      text: `I don’t have approved pricing information for ${client.businessName}, so I can’t quote a price. The office can discuss pricing if you request a callback.`,
      source: "faq",
      suggestCallback: true,
    };
  }

  if (/\b(appointment|schedule|book|booking|available|availability|come out|today|tomorrow|soon)\b/.test(lower)) {
    return {
      text: `I can’t book appointments or confirm availability. If you send a callback request, ${client.businessName}’s office will contact you about scheduling.`,
      source: "faq",
      suggestCallback: true,
    };
  }

  if (/\b(phone|number|call you|email|address|located|location|contact|reach)\b/.test(lower)) {
    const line = contactLine(client);
    if (line) return { text: line, source: "faq" };
  }

  if (/\b(services?|offer|provide|do you (do|install|repair|fix|work on|handle))\b/.test(lower)) {
    const names = profile.services.map((service) => service.name);
    return {
      text: `${client.businessName}’s approved list of services: ${names.join("; ")}. For anything not listed, the office can answer on a callback.`,
      source: "faq",
      suggestCallback: true,
    };
  }

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(lower.trim())) {
    return {
      text: `Hi! I can answer questions about ${client.businessName}, check whether your ZIP code is in the service area, or take a callback request.`,
      source: "faq",
    };
  }

  return null;
}

// --- Guarding AI output ----------------------------------------------------------------------

export type GuardResult = { ok: true } | { ok: false; reason: string };

/**
 * Last line of defense against invented specifics. The prompt already forbids these; this blocks
 * a reply that states a price, ZIP code, phone number, or email address that isn't in the approved
 * facts, confirms an appointment, or promises availability.
 */
export function guardAiReply(reply: string, approvedFacts: string): GuardResult {
  const facts = approvedFacts.toLowerCase();
  const digitsInFacts = facts.replace(/\D+/g, " ");

  for (const match of reply.matchAll(/\$\s?\d[\d,]*(\.\d+)?|\b\d[\d,]*(\.\d+)?\s?(dollars|bucks|usd)\b/gi)) {
    if (!facts.includes(match[0].toLowerCase().replace(/\s+/g, ""))) return { ok: false, reason: "price" };
  }
  for (const match of reply.matchAll(/(?<![\d-])\d{5}(?![\d-])/g)) {
    if (!digitsInFacts.includes(match[0])) return { ok: false, reason: "zip" };
  }
  for (const match of reply.matchAll(EMAIL)) {
    if (!facts.includes(match[0].toLowerCase().replace(/[.,;:)]+$/, ""))) return { ok: false, reason: "email" };
  }
  for (const match of reply.matchAll(PHONE)) {
    const digits = match[0].replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (!facts.replace(/[^\d\n]/g, "").includes(digits)) return { ok: false, reason: "phone" };
  }
  if (
    /\b(i(’|')?ve|i have|we(’|')?ve|we have)\s+(booked|scheduled|confirmed|reserved)\b|\byou(’|')?re\s+(all\s+set|booked|scheduled|confirmed)\b|\b(appointment|visit|technician|tech)\b[^.?!]{0,40}\b(is|has been|are|have been)\s+(booked|confirmed|scheduled|reserved)\b/i.test(
      reply,
    )
  ) {
    return { ok: false, reason: "appointment" };
  }
  const availability = reply.match(
    /\bsame[- ]day\b|\bwithin\s+\d+\s+(minutes?|hours?)\b|\b(available|out|there)\s+(today|tonight|tomorrow|right away|right now)\b|\b24\/7\b/i,
  );
  if (availability && !facts.includes(availability[0].toLowerCase())) return { ok: false, reason: "availability" };
  if (/<\/?(business_facts|rules)>|system prompt/i.test(reply)) return { ok: false, reason: "leak" };
  return { ok: true };
}
