// Scripted replies for the ConvoHatch site assistant. Runs in the browser; used when AI replies
// aren't configured, and as a fallback whenever an AI reply can't be produced.

import { faqAnswer, summaries } from "./knowledge.ts";

export type AssistantAction = "request-demo" | "try-demo";

export interface AssistantReply {
  text: string;
  action?: AssistantAction;
}

export const ASSISTANT_GREETING =
  "Hi! I can answer questions about ConvoHatch: what it does, how setup works, pricing, and more. What would you like to know?";

export const SUGGESTED_QUESTIONS = [
  "What does ConvoHatch do?",
  "How much does it cost?",
  "Can it book appointments?",
  "Will it work with my website?",
];

export const MAX_ASSISTANT_INPUT = 500;

const PERSONAL_DETAILS = /[^\s@]+@[^\s@]+\.[^\s@]+|\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}|\d{7,}/;

/** True for messages that look like they contain an email address or phone number. */
export function containsPersonalDetails(text: string): boolean {
  return PERSONAL_DETAILS.test(text);
}

type Rule = { pattern: RegExp; reply: () => AssistantReply };

// Order matters: more specific topics come first.
const RULES: Rule[] = [
  {
    pattern: /(guarantee|roi\b|results|statistic|how many (clients|customers|businesses)|clients|customers do you have|reviews?|testimonials?|case stud)/,
    reply: () => ({ text: summaries.noClaims, action: "request-demo" }),
  },
  {
    pattern: /(price|pricing|cost|how much|quote|expensive|cheap|afford|fee|monthly|per month|budget|\$)/,
    reply: () => ({ text: faqAnswer("cost"), action: "request-demo" }),
  },
  {
    pattern: /((book|get|request|schedule|set up) an? demo|sign (me )?up)/,
    reply: () => ({ text: summaries.requestDemo, action: "request-demo" }),
  },
  { pattern: /(book|appointment|schedul|calendar)/, reply: () => ({ text: faqAnswer("booking") }) },
  {
    pattern: /(doesn.?t know|does not know|don.?t know|wrong answer|mistake|unsure|can.?t answer|make (things|stuff) up|hallucinat)/,
    reply: () => ({ text: faqAnswer("unknownAnswers") }),
  },
  {
    pattern: /(wordpress|wix|squarespace|shopify|godaddy|existing (web)?site|my (web)?site|my website|website builder|work with my|install)/,
    reply: () => ({ text: faqAnswer("existingWebsite") }),
  },
  { pattern: /(brand|colou?r|logo|match|style|look like|customi[sz])/, reply: () => ({ text: faqAnswer("branding") }) },
  {
    pattern: /(technical|tech skills|coding|code|developer|hard to set up|difficult|complicated|maintain)/,
    reply: () => ({ text: faqAnswer("technicalSkills") }),
  },
  {
    pattern: /(what (can|will|does) (it|the (chat)?bot) (answer|say|handle|do)|what questions)/,
    reply: () => ({ text: faqAnswer("whatItAnswers") }),
  },
  {
    pattern: /(request|sign up|get started|get a demo|book a demo|talk to|speak (to|with)|contact|reach (you|someone)|call (you|me)|email|phone|human|person|someone|sales)/,
    reply: () => ({ text: summaries.requestDemo, action: "request-demo" }),
  },
  {
    pattern: /(try|sample|see (it|one|an example)|example|test it|demo chatbot|play with)/,
    reply: () => ({ text: summaries.tryDemo, action: "try-demo" }),
  },
  {
    pattern: /(how (does|do|would) (it|this|you|that) work|process|steps|set ?up|onboard|timeline|how long)/,
    reply: () => ({ text: summaries.howItWorks }),
  },
  {
    pattern: /(hvac|plumb|electric|roof|trade|industr|landscap|pest|garage|cleaning|contractor|who (do you|is it) (serve|for))/,
    reply: () => ({ text: summaries.industries }),
  },
  {
    pattern: /(why|benefit|help my business|worth it|leads?|missed calls?|after hours|busy|office)/,
    reply: () => ({ text: summaries.benefits }),
  },
  {
    pattern: /(what (is|does) convo ?hatch|who are you|what do you (do|offer|sell)|about (you|convo ?hatch)|what is this|explain)/,
    reply: () => ({ text: summaries.about }),
  },
  {
    pattern: /(\bai\b|chat ?bot|artificial intelligence|gpt|claude)/,
    reply: () => ({ text: summaries.about }),
  },
  {
    pattern: /^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/,
    reply: () => ({ text: "Hi there! Ask me anything about ConvoHatch, or pick one of the suggested questions." }),
  },
  { pattern: /^(thanks|thank you|thx|ty)\b/, reply: () => ({ text: "You’re welcome! Anything else I can help with?" }) },
];

export function scriptedReply(rawText: string): AssistantReply {
  const text = rawText.trim().slice(0, MAX_ASSISTANT_INPUT).toLowerCase();

  if (containsPersonalDetails(text)) {
    return { text: `Thanks, but please keep contact details out of this chat. ${summaries.noContactDetails}`, action: "request-demo" };
  }

  const rule = RULES.find((candidate) => candidate.pattern.test(text));
  if (rule) return rule.reply();

  return {
    text: "I’m not sure about that one, and I’d rather not guess. The team can answer it directly if you request a demo.",
    action: "request-demo",
  };
}
