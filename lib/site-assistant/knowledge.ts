// Approved facts for the ConvoHatch site assistant, built from the site copy so there is one source of truth.
// Both the scripted replies and the AI system prompt use these.

import { benefits, demo, demoRequest, faq, hero, howItWorks, industries, site } from "../../content/site.ts";

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
  tryDemo: `You can try a sample chatbot in the “Try a sample chatbot” section on this page. It uses a fictional HVAC company and scripted replies, and nothing you enter there is sent anywhere.`,
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
    "Scope: the chatbot answers visitors on the business's website. It does not answer phone calls, texts, or voicemail.",
    "The website lists no email address, phone number, street address, booking link, prices, packages, client names, testimonials, or performance statistics.",
  ];
  return lines.join("\n");
}
