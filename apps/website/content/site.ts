// All marketing copy lives here so it can be edited without touching layout code.

// Where the ConvoHatch chatbot app runs. Override at build time to test against a local copy.
const CHATBOT_BASE_URL = process.env.NEXT_PUBLIC_CHATBOT_BASE_URL || "https://convo-hatch-chatbot.vercel.app";

export const site = {
  name: "ConvoHatch",
  tagline: "Smart conversations. More booked jobs.",
  title: "ConvoHatch | Custom website chatbots for HVAC and home service businesses",
  description:
    "ConvoHatch adds a custom chatbot to your website that answers common questions, captures service requests, and helps visitors take the next step, even after hours. Built for HVAC contractors and other local trades.",
};

export const nav = {
  links: [
    { label: "Benefits", href: "/#benefits" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Demo", href: "/#demo" },
    { label: "FAQ", href: "/#faq" },
    { label: "Pricing", href: "/pricing" },
    { label: "Schedule a Call", href: "/schedule" },
  ],
  cta: { label: "Request a Demo", href: "/#request-demo" },
};

export const hero = {
  eyebrow: "Custom website chatbots for local service businesses",
  headline: "Your next customer shouldn’t have to wait.",
  body: "ConvoHatch adds a custom AI chatbot to your website to answer common questions, capture service requests, and help visitors take the next step—even after hours.",
  primaryCta: { label: "Request a Demo", href: "/#request-demo" },
  // Opens the live chatbot demo on a sample contractor website.
  secondaryCta: { label: "Try the Chatbot", href: `${CHATBOT_BASE_URL}/demo` },
  note: "Built for HVAC contractors first, and for plumbing, electrical, roofing, and other trades.",
  preview: {
    label: "Example conversation",
    company: "Your HVAC company",
    timestamp: "9:42 PM · after hours",
    messages: [
      { from: "visitor", text: "Hi, my AC is running but blowing warm air. Do you service ZIP 54321?" },
      {
        from: "assistant",
        text: "Sorry to hear that. Yes, 54321 is in our service area. I can start a repair request so the office can follow up.",
      },
      { from: "assistant", text: "What’s the best time for a callback?" },
      { from: "visitor", text: "Tomorrow afternoon works." },
    ],
    summary: {
      title: "New service request",
      rows: [
        { label: "Service", value: "AC repair" },
        { label: "Issue", value: "Blowing warm air" },
        { label: "ZIP", value: "54321 · in area" },
        { label: "Callback", value: "Tomorrow afternoon" },
      ],
      note: "Ready for your office to follow up",
    },
  },
} as const;

export const benefits = {
  eyebrow: "Benefits",
  heading: "Helpful answers for customers. Less busywork for your office.",
  intro:
    "Most website visitors have a simple question and a problem they want solved. A chatbot built around your business helps them take the next step instead of leaving.",
  items: [
    {
      icon: "clock",
      title: "Answer visitors right away",
      body: "People get a helpful reply in seconds—on nights, weekends, and busy days when the phones are already full.",
    },
    {
      icon: "clipboard",
      title: "Capture the details you need",
      body: "The chatbot asks for contact info, the service ZIP code, and what’s going on, so a question doesn’t turn into a lost lead.",
    },
    {
      icon: "chat",
      title: "Fewer repeat questions for the office",
      body: "Hours, service area, the work you do, how to request maintenance—common questions get your approved answers, so your team can focus on the calls that need them.",
    },
    {
      icon: "inbox",
      title: "Organized inquiries to follow up on",
      body: "Each conversation becomes a short summary: who, where, what they need, and when to call back. Your team knows what to do next.",
    },
  ],
} as const;

export const howItWorks = {
  eyebrow: "How it works",
  heading: "A chatbot built around your business, not a generic script.",
  steps: [
    {
      title: "We learn your business",
      body: "We gather your services, service area, hours, and the answers you approve—so the chatbot says what your office would say.",
    },
    {
      title: "We build and install it",
      body: "We set up your chatbot, match it to your website’s look, and install it for you.",
    },
    {
      title: "We refine it over time",
      body: "As your services change and new customer questions come up, we update the answers and the flow.",
    },
  ],
  bookingNote: {
    title: "A note on appointment booking",
    body: "Whether the chatbot can book appointments depends on the scheduling tools you use and how they’re set up. By default, it captures service requests for your team. A captured request isn’t a confirmed appointment until your office confirms it.",
  },
} as const;

export const demo = {
  eyebrow: "Interactive demo",
  heading: "Try a sample chatbot.",
  intro:
    "This is the real ConvoHatch chatbot, set up for Cedar Hollow Heating & Air, a fictional HVAC company. Callback requests you send here are saved in a test database and never reach a contractor, and no appointment is booked.",
  // The live demo is served by the ConvoHatch chatbot app and framed inline here.
  embedUrl: `${CHATBOT_BASE_URL}/embed/demo-cedar-hollow?layout=inline`,
  fullDemoUrl: `${CHATBOT_BASE_URL}/demo`,
  tryThis: "Try: “Do you serve ZIP 54321?”, “Do you sell pool heaters?”, or “Request a callback” with the fictional sample details.",
  shows: {
    title: "What this demo shows",
    items: [
      "Checking whether a ZIP code is in the service area",
      "Answering only from the business’s approved information",
      "Collecting a callback request you review before sending",
      "Saying so when it doesn’t know, instead of guessing",
    ],
  },
  wontDo: {
    title: "What it won’t do",
    items: [
      "Give repair instructions",
      "Quote prices the business hasn’t approved",
      "Promise a technician or time slot",
    ],
  },
} as const;

export const industries = {
  eyebrow: "Industries",
  heading: "Built for the trades that keep homes running.",
  intro:
    "We’re starting with HVAC contractors and building chatbots for other local service businesses with the same needs: quick answers, clear requests, and fewer missed opportunities.",
  featured: {
    icon: "hvac",
    title: "HVAC",
    body: "Heating and cooling companies field the same questions every day, often when the office is closed. A chatbot can check the service area, take repair and maintenance requests, and share your approved answers.",
    examples: [
      "“Do you service my area?”",
      "“Can I schedule a tune-up?”",
      "“My AC isn’t cooling. Can someone come out?”",
    ],
  },
  others: [
    { icon: "plumbing", title: "Plumbing", body: "Capture leak, drain, and water heater requests with the details your team needs." },
    { icon: "electrical", title: "Electrical", body: "Route panel, wiring, and installation questions to your office with clear next steps." },
    { icon: "roofing", title: "Roofing", body: "Gather inspection and repair requests, including the property location and timing." },
    { icon: "tools", title: "Other local services", body: "Garage doors, landscaping, pest control, cleaning, and similar service businesses." },
  ],
} as const;

export const faq = {
  eyebrow: "FAQ",
  heading: "Common questions",
  items: [
    {
      question: "Will it work with my existing website?",
      answer:
        "In most cases, yes. Adding the chatbot usually takes a small snippet of code on your site. We’ll look at your website during the demo and confirm what’s involved.",
    },
    {
      question: "Can it match my branding?",
      answer:
        "Yes. We match your colors and the chat window’s look to your website, and write replies in a tone that fits your business.",
    },
    {
      question: "What can the chatbot answer?",
      answer:
        "Questions you approve: your services, service area, hours, how to request maintenance, and what happens next. It also collects the details your office needs to follow up.",
    },
    {
      question: "What happens when it doesn’t know an answer?",
      answer:
        "It says so instead of guessing, and offers to pass the question to your team along with the visitor’s contact details. We use those questions to improve its answers over time.",
    },
    {
      question: "Can it book appointments?",
      answer:
        "It depends on your scheduling tools and setup. If your system supports it, we can look at connecting booking. Otherwise, the chatbot captures a service request and your team confirms the appointment. A captured request isn’t a confirmed appointment.",
    },
    {
      question: "Do I need technical skills?",
      answer:
        "No. We handle the setup and installation. If your website needs a code snippet added, we can do it for you or walk you or your web person through it.",
    },
    {
      question: "How much does it cost?",
      answer:
        "Core is $199 a month plus a $500 one-time setup fee. Custom integrations, like scheduling or CRM connections, are quoted based on your existing tools and scope. See the Pricing page for what’s included.",
    },
  ],
} as const;

export const demoRequest = {
  eyebrow: "Request a demo",
  heading: "See what ConvoHatch could do for your business.",
  intro:
    "Tell us a little about your business and what you’d like help with. We’ll follow up by email to set up a demo.",
  points: [
    "A walkthrough built around your trade",
    "A look at how it could fit your website",
    "A quote based on what you actually need",
  ],
  unavailable:
    "Online demo requests aren’t available yet. This form can’t send messages right now, so please check back soon.",
  success: "Thanks—your request was sent. We’ll follow up by email.",
  failure: "Sorry, we couldn’t send your request just now. Please try again in a few minutes.",
} as const;

export const footer = {
  sections: [
    { label: "Benefits", href: "/#benefits" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Demo", href: "/#demo" },
    { label: "Industries", href: "/#industries" },
    { label: "FAQ", href: "/#faq" },
    { label: "Pricing", href: "/pricing" },
    { label: "Request a Demo", href: "/#request-demo" },
    { label: "Schedule a Call", href: "/schedule" },
  ],
} as const;

export const schedule = {
  // Time zone your hours are in. Use an IANA name, e.g. "America/Chicago" or "America/Los_Angeles".
  timeZone: "America/New_York",
  eyebrow: "Schedule a call",
  heading: "Pick a time that works for you.",
  intro:
    "Book a free 30-minute Zoom call. Choose a day and time, add your details, and we’ll send you a Zoom link before the call.",
  hoursNote: "Available weekdays 5–9 PM and Saturdays 9 AM–2 PM.",
  unavailable:
    "Online scheduling isn’t available right now. Please use the demo request form instead, and we’ll follow up by email.",
  success: "You’re booked. We’ll send a Zoom link to your email before the call.",
  taken: "Sorry, someone just booked that time. Please pick another.",
  failure: "Sorry, we couldn’t book that time just now. Please try again in a few minutes.",
  rateLimited: "You’ve tried to book several times in a short period. Please wait a few minutes and try again.",
} as const;

export const pricing = {
  eyebrow: "Pricing",
  heading: "Simple pricing. Personal support.",
  intro:
    "Get a custom chatbot that answers common questions, captures service requests, and helps your team follow up—all configured for your business.",
  plans: [
    {
      id: "core",
      name: "Core",
      price: "$199",
      period: "/month",
      priceLabel: "$199 per month",
      setup: "$500 one-time setup fee",
      description: "The essentials for answering questions and capturing HVAC service inquiries.",
      listHeading: "Includes",
      items: [
        "Custom-branded chatbot for one website and one business location",
        "Answers based on your approved business information",
        "Service-area checks",
        "Customer contact details and service-request capture",
        "Email notifications for new service requests",
        "Monthly chatbot performance review",
        "Up to 30 minutes of content updates each month",
        "Support during business hours",
      ],
      note: "Your quote will specify the included monthly chatbot usage and any additional usage charges before you sign up.",
      cta: { label: "Request a Demo", href: "/#request-demo" },
    },
    {
      id: "custom",
      name: "Custom Integrations",
      price: "Custom quote",
      period: "",
      priceLabel: "Custom quote",
      setup: "",
      description: "For businesses that need their chatbot connected to more of their workflow.",
      listHeading: "Potential scope",
      items: [
        "Scheduling integrations",
        "CRM connections",
        "Multiple business locations",
        "More complex intake and routing",
        "Higher usage requirements",
      ],
      note: "Availability and pricing depend on your existing tools and the scope of the integration.",
      cta: { label: "Discuss Your Needs", href: "/#request-demo" },
    },
  ],
  covers: {
    heading: "What your pricing covers",
    items: [
      {
        title: "Setup",
        body: "Setup covers learning your business, configuring approved answers, matching your branding, installation, and testing.",
      },
      {
        title: "Monthly service",
        body: "Monthly service covers chatbot software within your agreed usage allowance, monitoring, updates, and support.",
      },
    ],
  },
  faq: {
    eyebrow: "Pricing FAQ",
    heading: "Questions about pricing",
    items: [
      {
        question: "Is setup a separate charge?",
        answer: "Yes. Core includes a $500 one-time setup fee and a $199 monthly service fee.",
      },
      {
        question: "Can the chatbot book appointments?",
        answer:
          "Core captures service requests. Direct appointment booking requires a separately scoped scheduling integration. A service request is not a confirmed appointment.",
      },
      {
        question: "Are content changes included?",
        answer:
          "Core includes up to 30 minutes of content updates each month. Larger changes and additional integrations are quoted separately.",
      },
      {
        question: "Is chatbot usage unlimited?",
        answer: "No. Your quote specifies the included monthly usage and any additional usage charges before you sign up.",
      },
      {
        question: "Can you support multiple locations?",
        answer: "Yes, through a custom scope and quote based on your requirements.",
      },
    ],
  },
} as const;
