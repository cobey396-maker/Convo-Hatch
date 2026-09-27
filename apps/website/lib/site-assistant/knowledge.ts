// Approved facts for the ConvoHatch site assistant, built from the site copy so there is one source of truth.
// Both the scripted replies and the AI system prompt use these.

import { benefits, demo, demoRequest, faq, hero, howItWorks, industries, pricing, site } from "../../content/site.ts";

export type FaqTopic =
  | "existingWebsite"
  | "branding"
  | "whatItAnswers"
  | "unknownAnswers"
  | "booking"
  | "technicalSkills"
  | "cost";

// Maps topics to FAQ entries by position; keep in sync with the order in content/site.ts.
const FAQ_ORDER: FaqTopic[] = [
  "existingWebsite",
  "branding",
  "whatItAnswers",
  "unknownAnswers",
  "booking",
  "technicalSkills",
  "cost",
];

export function faqAnswer(topic: FaqTopic): string {
  return faq.items[FAQ_ORDER.indexOf(topic)].answer;
}

export const summaries = {
  about: `${site.name} adds a custom chatbot to your website that answers common questions, captures service requests, and helps visitors take the next step, even after hours. It’s built for local service businesses, starting with HVAC contractors.`,
  benefits: `It gives visitors an immediate response, captures contact details and service needs, cuts down on repetitive questions for your office, and turns conversations into organized requests your team can follow up on.`,
  howItWorks: `${howItWorks.steps.map((step, index) => `${index + 1}) ${step.title}: ${step.body}`).join(" ")}`,
  industries: `We’re starting with HVAC contractors, and we also build chatbots for plumbing, electrical, roofing, and other local service businesses.`,
  tryDemo: `You can try a sample chatbot in the “Try a sample chatbot” section on this page. It’s the real ConvoHatch chatbot set up for a fictional HVAC company. Callback requests sent there go to a test database, never to a contractor.`,
  requestDemo: `${demoRequest.intro} The form is in the “Request a demo” section at the bottom of this page.`,
  noContactDetails: `It can’t pass messages along. To get in touch, use the demo request form at the bottom of this page.`,
  noClaims: `We don’t publish performance guarantees, client lists, or statistics. The best way to see whether it fits your business is to request a demo.`,
};

/** Plain-text fact sheet embedded in the AI system prompt. */
export function buildFactSheet(): string {
  const lines: string[] = [
    `Name: ${site.name}`,
    `Tagline: ${site.tagline}`,
    `What it is: ${hero.body}`,
    "",
    "Benefits:",
    ...benefits.items.map((item) => `- ${item.title}: ${item.body}`),
    "",
    "How it works:",
    ...howItWorks.steps.map((step, index) => `${index + 1}. ${step.title}: ${step.body}`),
    `${howItWorks.bookingNote.title}: ${howItWorks.bookingNote.body}`,
    "",
    `Industries: ${industries.intro}`,
    `- ${industries.featured.title}: ${industries.featured.body}`,
    ...industries.others.map((item) => `- ${item.title}: ${item.body}`),
    "These are industries ConvoHatch serves, not existing clients.",
    "",
    "Frequently asked questions:",
    ...faq.items.map((item) => `Q: ${item.question}\nA: ${item.answer}`),
    "",
    `Sample chatbot on this page: ${demo.intro}`,
    `Requesting a demo: ${summaries.requestDemo}`,
    "Scheduling a call: visitors can book a free 30-minute Zoom call with ConvoHatch on the Schedule a Call page (/schedule).",
    "Scope: the chatbot answers visitors on the business's website. It does not answer phone calls, texts, or voicemail.",
    "",
    "Pricing (published on the Pricing page, /pricing):",
    ...pricing.plans.map((plan) =>
      [
        `- ${plan.name}: ${plan.priceLabel}${plan.setup ? `, plus a ${plan.setup}` : ""}. ${plan.description}`,
        `  ${plan.listHeading}: ${plan.items.join("; ")}.`,
        `  ${plan.note}`,
      ].join("\n"),
    ),
    ...pricing.covers.items.map((item) => `- ${item.body}`),
    ...pricing.faq.items.map((item) => `Q: ${item.question}\nA: ${item.answer}`),
    "No discounts, free trials, usage limits, overage prices, contract lengths, cancellation terms, refund policies, or support response times are published.",
    "",
    "The website lists no email address, phone number, street address, client names, testimonials, or performance statistics.",
  ];
  return lines.join("\n");
}
