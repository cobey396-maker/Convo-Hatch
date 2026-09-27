// Deterministic replies for the hosted widget. These never call an AI model: safety, privacy,
// service-area checks, requests the bot can't handle (records, people, repairs), and, when live
// AI is unavailable, answers matched from the client's approved information.

import { formatHoursCompact, timeZoneLabel, type ApprovedFaq, type ApprovedService, type ClientConfig } from "./config.ts";
import { detectHazards, safetyMessage } from "./safety.ts";

export type ReplySource = "ai" | "faq" | "rule" | "limit";

export interface Reply {
  text: string;
  source: ReplySource;
  /** Show a prominent "Request a callback" button with this reply. */
  suggestCallback?: boolean;
}

// --- Privacy ---------------------------------------------------------------------------------

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// US numbers (with or without +1) and international numbers written with a leading +.
const PHONE = /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b|\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b/g;
// Payment card numbers (13–19 digits, optionally grouped) and US Social Security numbers.
const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
export const REDACTED = "[contact details removed]";
export const REDACTED_SENSITIVE = "[sensitive number removed]";

function luhn(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Removes contact details and sensitive numbers (card numbers, SSNs) so they're never stored with
 * the chat or sent to the AI model.
 */
export function redactPrivateDetails(text: string): { text: string; contact: boolean; sensitive: boolean } {
  let sensitive = false;
  let result = text.replace(SSN, () => {
    sensitive = true;
    return REDACTED_SENSITIVE;
  });
  result = result.replace(CARD, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 13 && luhn(digits)) {
      sensitive = true;
      return REDACTED_SENSITIVE;
    }
    return match;
  });
  const withoutContact = result.replace(EMAIL, REDACTED).replace(PHONE, REDACTED);
  return { text: withoutContact, contact: withoutContact !== result, sensitive };
}

/** Backwards-compatible name used by earlier code and tests. */
export function redactContactDetails(text: string): { text: string; redacted: boolean } {
  const result = redactPrivateDetails(text);
  return { text: result.text, redacted: result.contact || result.sensitive };
}

// --- Service area ----------------------------------------------------------------------------

/** The first US ZIP code in the text (ZIP+4 is accepted and trimmed), or null. */
export function findZip(text: string): string | null {
  const match = /(?<![\d-])(\d{5})(?:-\d{4})?(?![\d-])/.exec(text);
  return match ? match[1] : null;
}

export function isInServiceArea(client: ClientConfig, zip: string): boolean {
  return client.serviceZipCodes.includes(zip);
}

/** `standalone: false` drops the closing question, for when another answer follows the ZIP result. */
export function serviceAreaReply(client: ClientConfig, zip: string, standalone = true): Reply {
  if (isInServiceArea(client, zip)) {
    return {
      text: `Yes, ZIP ${zip} is in ${client.businessName}’s service area.${standalone ? " Would you like to request a callback about service?" : ""}`,
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
      /\b(hi|hello|hey|do|does|you|y'all|yall|your|guys|service|services|serve|servicing|cover|covers|come|go|out|to|in|my|zip|code|area|is|are|am|i|we|live|located|at|the|a|an|near|what|about|how|check|can|could|please|thanks|thank|ok|okay|yes|no|there|here|it|that|this|for|of|on|work|within|inside|sorry|meant|mean|actually|oops|wait|correction|instead|not|its|it's|im|i'm)\b/g,
      " ",
    )
    .replace(/[^a-z]+/g, " ")
    .trim();
  return rest.length === 0;
}

const AREA_QUESTION =
  /\b(do|does|can|will|would)\s+(you|y'?all|you\s+guys|they|cedar\s+\w+)\s+(service|serve|cover|come\s+(out\s+)?to|work\s+in|go\s+to|travel\s+to)\b|\bservice\s+area\b|\b(in|near)\s+your\s+area\b|\bwhat\s+(areas?|towns?|cities|zip\s*codes?)\b|\bwhere\s+do\s+you\s+(work|service|serve)\b|\bnear\s+me\b|\bzip\s*codes?\b/i;
// Canadian (A1A 1A1) and UK (SW1A 1AA) postal codes.
const NON_US_POSTAL = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b|\b[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}\b/i;
const PARTIAL_ZIP = /(?<![\d-])\d{3,4}(?![\d-])|(?<![\d-])\d{6,9}(?![\d-])/;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function areaPrompt(client: ClientConfig): string {
  const note = client.profile.serviceAreaNote ? `${client.businessName} serves ${client.profile.serviceAreaNote} ` : "";
  return `${note}I can check coverage by ZIP code. What’s the 5-digit ZIP code where you need service?`.trim();
}

// --- Things the bot can't do ------------------------------------------------------------------

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

const HUMAN =
  /\b((talk|speak|chat)\s+(to|with)\s+(a\s+|an\s+|the\s+|someone\s+)?(real\s+|live\s+|actual\s+)?(person|human|someone|somebody|agent|representative|rep|manager|owner|office|staff)|real\s+person|human\s+being|live\s+(agent|person)|customer\s+service|operator|not\s+a\s+(bot|robot))\b/i;
const FRUSTRATED =
  /\b(useless|stupid|dumb|ridiculous|frustrat\w*|annoy\w*|terrible|worst|waste\s+of\s+time|not\s+helpful|unhelpful|this\s+sucks|wtf|you'?re\s+not\s+listening)\b/i;
const RECORDS =
  /\b((my|our|an?|the)\s+(existing\s+|current\s+|scheduled\s+|upcoming\s+)?(appointment|invoice|bill|receipt|account|work\s+order|order|payment|balance)\b|(reschedule|cancel|move|confirm|check\s+on)\s+(my|our|the|an?)\s+(appointment|visit|service|booking|job)|when\s+(is|will)\s+(my|our|the)\s+(tech|technician|appointment|visit)|pay\s+(my|a|the|an)\s+(bill|invoice))/i;
const SPECIFIC_TECH = /\b((specific|same|particular|last)\s+(tech|technician|guy|person|installer)|(tech|technician)\s+(named|called)|ask\s+for\s+(tech|technician)|request\s+(a\s+)?(specific\s+)?(tech|technician))\b/i;
const INJECTION =
  /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+|your\s+|previous\s+|prior\s+|above\s+|earlier\s+)*(instructions|rules|prompts?|guidelines)|system\s+prompt|(developer|debug|admin|god)\s+mode|you\s+are\s+now\b|pretend\s+(to\s+be|you\s+are)|act\s+as\s+(an?\s+)?(admin|administrator|developer|different|another)|i\s*(am|'m)\s+(the\s+|an?\s+)?(admin|administrator|developer|owner\s+of\s+convohatch|convohatch\s+(staff|admin))|(reveal|show|print|repeat|tell\s+me)\s+(me\s+)?(your|the)\s+(prompt|instructions|rules|config\w*|settings|system)|api\s+key|credentials|password|(other|another|previous)\s+(clients?|customers?|businesses|users?|visitors?)'?s?\s+(data|info\w*|conversations?|chats?|details|contacts?|emails?|phone|numbers|leads|requests)|(list|show|give\s+me)\s+(all\s+)?(the\s+)?(leads|customers|requests|conversations)\b/i;
// Non-Latin scripts, or Spanish written without English.
const NON_LATIN = /[Ѐ-ӿ֐-׿؀-ۿऀ-ॿ฀-๿぀-ヿ㐀-鿿가-힯]/;
const SPANISH = /\b(hola|necesito|ayuda|servicio|aire\s+acondicionado|calefacci[oó]n|calentador|gracias|por\s+favor|hablan?|español|cu[aá]nto|cuesta|t[eé]cnico|reparaci[oó]n|mi\s+casa|no\s+funciona|pueden|ustedes)\b|[¿¡]/gi;
const GREETING = /^(hi+|hello+|hey+|yo|hiya|howdy|good\s+(morning|afternoon|evening)|help|help\s+me|i\s+need\s+help|hello\?+|\?+|anyone\s+there\??|test(ing)?)[\s!.?,]*$/i;
const THANKS = /^((ok(ay)?|great|cool|perfect|awesome)[\s,!.]*)?(thanks?|thank\s+you|thx|ty|bye|goodbye|that'?s\s+all|no\s+thanks?|never\s*mind|nvm)[\s!.,]*(so\s+much|a\s+lot)?[\s!.]*$/i;

function phoneLine(client: ClientConfig): string {
  const phone = client.profile.contact.phone;
  return phone ? `You can call the office at ${phone} during office hours` : "";
}

function hoursSummary(client: ClientConfig): string {
  return `${client.businessName}’s office hours (${timeZoneLabel(client.profile.timeZone)}) are ${formatHoursCompact(client.profile).join("; ")}.`;
}

/**
 * Deterministic replies that take priority over AI, in order: safety, privacy, abuse, language,
 * greetings, human contact, records, technicians, repair instructions, and location handling.
 * Returns null when the AI (or the approved-information fallback) should answer.
 */
export function ruleReply(client: ClientConfig, rawText: string, redaction: { contact: boolean; sensitive: boolean }): Reply | null {
  const text = rawText.trim();
  const hazards = detectHazards(text);
  if (hazards.length) return { text: safetyMessage(hazards, client.profile.emergencyMessage), source: "rule" };

  if (redaction.sensitive) {
    return {
      text: `Please don’t share card numbers, ID numbers, or passwords here. ${client.businessName} never needs them in this chat, so I removed that number from the conversation.`,
      source: "rule",
    };
  }
  if (redaction.contact) {
    return {
      text: `Thanks! For your privacy, contact details aren’t kept in the chat. To have ${client.businessName} call or email you, use “Request a callback”. I’ll fill in what you typed so you can check it before sending.`,
      source: "rule",
      suggestCallback: true,
    };
  }

  if (INJECTION.test(text)) {
    return {
      text: `I can only help with questions about ${client.businessName}’s services, hours, and service area, or take a callback request.`,
      source: "rule",
    };
  }

  const spanishHits = text.match(SPANISH)?.length ?? 0;
  const englishHits = text.match(/\b(the|you|do|is|what|how|my|need|and|can|your)\b/gi)?.length ?? 0;
  if (NON_LATIN.test(text) || (spanishHits >= 1 && englishHits === 0)) {
    const phone = client.profile.contact.phone;
    return {
      text: `Sorry, I can only help in English right now.${phone ? ` You can call the office at ${phone}.` : ""}`,
      source: "rule",
    };
  }

  if (GREETING.test(text)) {
    return {
      text: `Hi! I can answer questions about ${client.businessName}’s services and hours, check whether a ZIP code is in the service area, or take a callback request. What can I help with?`,
      source: "rule",
    };
  }
  if (THANKS.test(text)) {
    return { text: `You’re welcome! If anything else comes up, I’m here.`, source: "rule" };
  }

  if (HUMAN.test(text) || FRUSTRATED.test(text)) {
    const sorry = FRUSTRATED.test(text) ? "Sorry about that. " : "";
    const phone = phoneLine(client);
    return {
      text: `${sorry}${phone ? `${phone}, or send` : "Send"} a callback request and a person from the office will contact you.`,
      source: "rule",
      suggestCallback: true,
    };
  }

  if (RECORDS.test(text)) {
    const phone = phoneLine(client);
    return {
      text: `I can’t see appointments, invoices, or account details. ${phone ? `${phone} for help with that.` : "Send a callback request and the office will help with that."}`,
      source: "rule",
      suggestCallback: !phone,
    };
  }

  if (SPECIFIC_TECH.test(text)) {
    return {
      text: `I can’t choose or assign technicians. You can mention it in the details of a callback request, and the office will let you know.`,
      source: "rule",
      suggestCallback: true,
    };
  }

  if (isRepairInstructionRequest(text)) {
    return {
      text: `I can’t give repair or troubleshooting instructions. A ${client.businessName} technician can look at it for you. Would you like to request a callback?`,
      source: "rule",
      suggestCallback: true,
    };
  }

  // Location: the ZIP code decides coverage. Town names alone are never guessed.
  const zip = findZip(text);
  if (!zip && NON_US_POSTAL.test(text)) {
    return {
      text: `${client.businessName} works in the US only, and I can check coverage with a 5-digit US ZIP code.`,
      source: "rule",
    };
  }
  if (zip && isServiceAreaOnly(text)) return serviceAreaReply(client, zip);
  // "Can you service the rooftop units?" is about a service, not the area.
  const namesService = [...client.profile.services, ...(client.profile.notOffered ?? [])].some((service) => mentions(text, service));
  if (!zip && !namesService && (AREA_QUESTION.test(text) || /\bzip\b/i.test(text))) {
    if (PARTIAL_ZIP.test(text)) {
      return { text: `ZIP codes have 5 digits. What’s the 5-digit ZIP code where you need service?`, source: "rule" };
    }
    if (wordCount(text) <= 12) return { text: areaPrompt(client), source: "rule" };
  }
  return null;
}

/** Kept for callers that only need to know whether a message mentions an emergency. */
export function isEmergency(text: string): boolean {
  return detectHazards(text).length > 0;
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
  "a an and are as at be but by can could do does for from get got have how i if in is it its me my of on or our so than that the their them then there these they this to us was we what when where which who why will with would you your yours ya yall pls please".split(
    " ",
  ),
);
const ABBREVIATIONS: Record<string, string> = { u: "you", ur: "your", r: "are", hrs: "hours", hr: "hour", appt: "appointment", pls: "please", plz: "please", thx: "thanks", wknd: "weekend", wkend: "weekend", sat: "saturday", sun: "sunday", ac: "ac", cuz: "because" };

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .map((word) => ABBREVIATIONS[word] ?? word)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map((word) => word.replace(/(ies|es|s)$/, (suffix) => (suffix === "ies" ? "y" : "")));
}

/** Edit distance ≤ 1, so "warrenty" matches "warranty" and "finacing" matches "financing". */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function mentions(text: string, service: ApprovedService): boolean {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9/-]+/g, " ")} `;
  const terms = [service.name.toLowerCase(), ...(service.keywords ?? [])];
  return terms.some((term) => lower.includes(` ${term} `) || lower.includes(` ${term}s `));
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
 * Best-effort answer from the client's approved information, used when live AI is unavailable
 * (or an AI reply couldn't be used). Returns null when nothing matches well enough, so the
 * caller can admit it doesn't know.
 */
export function approvedInfoReply(client: ClientConfig, text: string): Reply | null {
  const lower = text.toLowerCase();
  const { profile } = client;
  const asksPrice = /\b(price|pricing|prices|cost|costs|how much|fee|fees|charge|charges|quote|rates?|cheap|expensive)\b/.test(lower);

  // A general "what do you do?" gets the full list.
  if (/\b(what|which)\s+(services|kinds?\s+of\s+(work|services?)|do\s+(you|u)\s+(do|offer|provide))\b|\b(list|all)\s+(of\s+)?(your\s+)?services\b|\bservices\s+(do\s+you|offered)\b/.test(lower)) {
    const names = profile.services.map((service) => service.name);
    return {
      text: `${client.businessName}’s approved list of services: ${names.join("; ")}. For anything not listed, the office can answer on a callback.`,
      source: "faq",
      suggestCallback: true,
    };
  }

  // A message can ask several things ("do you do heat pumps and what's the fee?"), so every
  // approved answer that matches is included, most specific first.
  const parts: string[] = [];
  let suggestCallback = false;

  const faq = bestFaq(profile.faqs, text);
  if (faq) {
    parts.push(faq.answer);
    suggestCallback = true;
  }

  const notOffered = (profile.notOffered ?? []).filter((service) => mentions(text, service));
  for (const service of notOffered) parts.push(`${client.businessName} doesn’t offer ${lowerFirst(service.name)}.`);

  const offered = profile.services.filter((service) => mentions(text, service));
  if (offered.length && !(faq && offered.every((service) => faq.answer.toLowerCase().includes(service.name.toLowerCase())))) {
    const list = offered.map((service) => (service.description ? `${service.name} (${lowerFirst(service.description).replace(/\.$/, "")})` : service.name));
    parts.push(`Yes, ${client.businessName} offers ${list.join("; ")}.`);
    suggestCallback = true;
  }

  // A price question that no approved answer covered still gets an honest "no approved price".
  if (asksPrice && !(faq && /\$\d/.test(faq.answer))) {
    parts.push(`I don’t have an approved price for that from ${client.businessName}, so I can’t quote one. The office can discuss pricing if you request a callback.`);
    suggestCallback = true;
  }

  if (parts.length) {
    if (suggestCallback && offered.length && !faq && !parts.some((part) => /callback/.test(part))) parts.push("Would you like to request a callback?");
    return { text: parts.join(" "), source: "faq", suggestCallback };
  }

  if (/\b(hours?|hrs|open|close[sd]?|closing|weekends?|saturday|sunday|holidays?|after\s*hours)\b/.test(lower)) {
    const note = profile.hoursNote ? ` ${profile.hoursNote}` : "";
    return { text: `${hoursSummary(client)}${note}`, source: "faq" };
  }

  if (/\b(appointment|schedule|book|booking|available|availability|come out|today|tomorrow|soon|asap|right away)\b/.test(lower)) {
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

  return null;
}

// Words too generic to identify an FAQ on their own ("Do you offer financing?" is about financing).
const GENERIC_FAQ_WORDS = new Set(["offer", "service", "work", "provide", "have", "any", "someone", "need", "want", "know"]);

function bestFaq(faqs: ApprovedFaq[], text: string): ApprovedFaq | null {
  const tokens = words(text);
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9/-]+/g, " ")} `;
  let best: { score: number; faq: ApprovedFaq } | null = null;
  for (const faq of faqs) {
    const questionWords = [...new Set(words(faq.question))].filter((word) => !GENERIC_FAQ_WORDS.has(word));
    let score = 0;
    for (const word of questionWords) if (tokens.some((token) => nearlyEqual(token, word))) score += 1;
    if ((faq.keywords ?? []).some((keyword) => lower.includes(` ${keyword} `) || lower.includes(` ${keyword}s `))) score += 2;
    const ratio = questionWords.length ? score / questionWords.length : 0;
    if (score >= 2 || (score >= 1 && ratio >= 0.5)) {
      if (!best || score > best.score) best = { score, faq };
    }
  }
  return best?.faq ?? null;
}

function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

// --- Guarding AI output ----------------------------------------------------------------------

export type GuardResult = { ok: true } | { ok: false; reason: string };

/**
 * Last line of defense against invented specifics. The prompt already forbids these; this blocks
 * a reply that states a price, ZIP code, phone number, or email address that isn't in the approved
 * facts, confirms an appointment, promises availability, or echoes internal instructions.
 */
export function guardAiReply(reply: string, approvedFacts: string): GuardResult {
  const facts = approvedFacts.toLowerCase();
  const digitsInFacts = facts.replace(/\D+/g, " ");

  for (const match of reply.matchAll(/\$\s?\d[\d,]*(\.\d+)?|\b\d[\d,]*(\.\d+)?\s?(dollars|bucks|usd)\b/gi)) {
    if (!facts.includes(match[0].toLowerCase().replace(/\s+/g, ""))) return { ok: false, reason: "price" };
  }
  for (const match of reply.matchAll(/\b\d{1,3}\s?%/g)) {
    if (!facts.includes(match[0].replace(/\s/g, ""))) return { ok: false, reason: "price" };
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
    /\b(i(’|')?ve|i have|we(’|')?ve|we have)\s+(booked|scheduled|confirmed|reserved|dispatched|sent)\b|\byou(’|')?re\s+(all\s+set|booked|scheduled|confirmed)\b|\b(appointment|visit|technician|tech)\b[^.?!]{0,40}\b(is|has been|are|have been)\s+(booked|confirmed|scheduled|reserved|dispatched|on\s+(the|their|his|her)\s+way)\b|\b(technician|tech|someone)\s+(is|will\s+be)\s+on\s+(the|their|his|her)\s+way\b/i.test(
      reply,
    )
  ) {
    return { ok: false, reason: "appointment" };
  }
  const availability = reply.match(
    /\bsame[- ]day\b|\bwithin\s+(an?|one|\d+)\s+(minutes?|hours?|days?)\b|\b(available|out|there)\s+(today|tonight|tomorrow|right away|right now)\b|\b24\/7\b|\b(guarantee[ds]?)\b/i,
  );
  if (availability && !facts.includes(availability[0].toLowerCase())) return { ok: false, reason: "availability" };
  if (/<\/?(business_facts|rules)>|system prompt|my instructions|i was (told|instructed) to/i.test(reply)) return { ok: false, reason: "leak" };
  return { ok: true };
}
