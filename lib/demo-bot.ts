// Scripted, local-only logic for the sample chatbot on the marketing site.
// No network requests, no AI service. Everything here is fictional demo content.
// Guardrails: no repair instructions, no prices, no promised availability.

export const DEMO_COMPANY = {
  name: "Cedar Hollow Heating & Air",
  shortName: "Cedar Hollow",
  hours: "Monday–Friday, 7:30am–6pm",
} as const;

export const SAMPLE_CONTACT = {
  name: "Jordan Sample",
  // 555-01xx numbers are reserved for fictional use.
  phone: "(555) 010-0142",
} as const;

export const SAMPLE_ZIPS = {
  inside: "54321",
  outside: "98765",
} as const;

export const GREETING = `Hi! I’m the virtual assistant for ${DEMO_COMPANY.name}. I can answer common questions, check the service area, and take a service request for the office. How can I help?`;

export type Intent = "area" | "repair" | "maintenance" | "hours" | "human";

export type Step =
  | "menu"
  | "zip"
  | "service"
  | "outOfArea"
  | "issue"
  | "system"
  | "callback"
  | "contact"
  | "done";

export interface Draft {
  service?: string;
  zip?: string;
  inArea?: boolean;
  details?: string;
  callback?: string;
}

export interface BotState {
  step: Step;
  draft: Draft;
}

export type Action =
  | { type: "intent"; intent: Intent }
  | { type: "zip"; zip: string; inArea: boolean }
  | { type: "retryZip" }
  | { type: "confirmOutOfArea" }
  | { type: "service"; service: string | null }
  | { type: "detail"; kind: "issue" | "system"; value: string }
  | { type: "callback"; value: string }
  | { type: "contact" }
  | { type: "restart" };

export interface Choice {
  /** Text on the button. */
  label: string;
  /** Text shown as the visitor's message after choosing. Defaults to label. */
  userText?: string;
  action: Action;
}

export interface RequestSummary {
  service: string;
  zip: string;
  areaNote: string;
  details: string;
  callback: string;
  contact: string;
}

export type BotReply = { text: string } | { summary: RequestSummary };

export interface Turn {
  state: BotState;
  replies: BotReply[];
}

export interface TextTurn extends Turn {
  /** True when the visitor's message looked like personal details and should not be displayed. */
  redactUserText: boolean;
}

export const MAX_INPUT_LENGTH = 200;

export function initialState(): BotState {
  return { step: "menu", draft: {} };
}

const MENU_CHOICES: Choice[] = [
  { label: "Do you service my area?", action: { type: "intent", intent: "area" } },
  { label: "I need an AC repair.", action: { type: "intent", intent: "repair" } },
  { label: "Can I request a maintenance visit?", action: { type: "intent", intent: "maintenance" } },
  { label: "What are your hours?", action: { type: "intent", intent: "hours" } },
  { label: "Can I talk to a person?", action: { type: "intent", intent: "human" } },
];

export function choicesFor(state: BotState): Choice[] {
  switch (state.step) {
    case "menu":
      return MENU_CHOICES;
    case "zip":
      return [
        {
          label: `Sample ZIP ${SAMPLE_ZIPS.inside} (inside demo area)`,
          userText: SAMPLE_ZIPS.inside,
          action: { type: "zip", zip: SAMPLE_ZIPS.inside, inArea: true },
        },
        {
          label: `Sample ZIP ${SAMPLE_ZIPS.outside} (outside demo area)`,
          userText: SAMPLE_ZIPS.outside,
          action: { type: "zip", zip: SAMPLE_ZIPS.outside, inArea: false },
        },
      ];
    case "service":
      return [
        { label: "AC repair", action: { type: "service", service: "AC repair" } },
        { label: "Heating repair", action: { type: "service", service: "Heating repair" } },
        { label: "Maintenance visit", action: { type: "service", service: "Maintenance visit" } },
        { label: "I just had a question", action: { type: "service", service: null } },
      ];
    case "outOfArea":
      return [
        { label: "Ask the office to confirm", action: { type: "confirmOutOfArea" } },
        { label: "Check a different ZIP", action: { type: "retryZip" } },
      ];
    case "issue": {
      const heating = state.draft.service === "Heating repair";
      return [
        heating ? "Not producing heat" : "Blowing warm air",
        "Won’t turn on",
        "Making an unusual noise",
        "Something else",
      ].map((value) => ({ label: value, action: { type: "detail", kind: "issue", value } }));
    }
    case "system":
      return ["Central AC", "Furnace", "Heat pump", "Not sure"].map((value) => ({
        label: value,
        action: { type: "detail", kind: "system", value },
      }));
    case "callback":
      return [
        "Morning (8am–noon)",
        "Afternoon (noon–4pm)",
        "Late afternoon (4–6pm)",
        "Any time",
      ].map((value) => ({ label: value, action: { type: "callback", value } }));
    case "contact":
      return [
        {
          label: `Use sample contact: ${SAMPLE_CONTACT.name}`,
          userText: `${SAMPLE_CONTACT.name}, ${SAMPLE_CONTACT.phone}`,
          action: { type: "contact" },
        },
      ];
    case "done":
      return [{ label: "Start a new conversation", action: { type: "restart" } }];
  }
}

const CALLBACK_QUESTION = "When’s a good time for the office to call you back?";

function reply(text: string): BotReply {
  return { text };
}

/** Moves on once the ZIP is known and a service is chosen. */
function continueAfterZip(draft: Draft, lead: BotReply[]): Turn {
  switch (draft.service) {
    case "AC repair":
    case "Heating repair":
      return {
        state: { step: "issue", draft },
        replies: [...lead, reply("What’s going on with the system? Pick the closest option.")],
      };
    case "Maintenance visit":
      return {
        state: { step: "system", draft },
        replies: [...lead, reply("Which system should the maintenance visit cover?")],
      };
    default:
      return { state: { step: "callback", draft }, replies: [...lead, reply(CALLBACK_QUESTION)] };
  }
}

function buildSummary(draft: Draft): RequestSummary {
  return {
    service: draft.service ?? "Callback request",
    zip: draft.zip ?? "Not provided",
    areaNote: draft.inArea === false ? "Outside listed area — office to confirm" : "Inside service area",
    details: draft.details ?? "None added",
    callback: draft.callback ?? "Any time",
    contact: `${SAMPLE_CONTACT.name} · ${SAMPLE_CONTACT.phone}`,
  };
}

export function handleAction(state: BotState, action: Action): Turn {
  switch (action.type) {
    case "intent":
      return handleIntent(action.intent);

    case "zip": {
      const draft: Draft = { ...state.draft, zip: action.zip, inArea: action.inArea };
      if (!action.inArea) {
        return {
          state: { step: "outOfArea", draft },
          replies: [
            reply(
              `${action.zip} looks like it’s outside the service area on file. I don’t want to guess, so I can ask the office to confirm whether they can help.`,
            ),
          ],
        };
      }
      if (!draft.service) {
        return {
          state: { step: "service", draft },
          replies: [
            reply(
              `Good news — ${action.zip} is inside ${DEMO_COMPANY.shortName}’s service area. What can we help with?`,
            ),
          ],
        };
      }
      return continueAfterZip(draft, [reply(`Thanks — ${action.zip} is inside the service area.`)]);
    }

    case "retryZip":
      return {
        state: { step: "zip", draft: { service: state.draft.service } },
        replies: [reply("No problem. Which sample ZIP code should I check?")],
      };

    case "confirmOutOfArea": {
      const draft: Draft = { ...state.draft, service: state.draft.service ?? "Service area check" };
      return continueAfterZip(draft, [
        reply("Okay — I’ll flag the ZIP code so the office can confirm before anything is scheduled."),
      ]);
    }

    case "service": {
      if (action.service === null) {
        return {
          state: { step: "menu", draft: {} },
          replies: [
            reply(
              "No problem. You can ask about hours, the service area, or maintenance visits — or type a question below.",
            ),
          ],
        };
      }
      return continueAfterZip({ ...state.draft, service: action.service }, []);
    }

    case "detail": {
      const draft: Draft = {
        ...state.draft,
        details: action.kind === "system" ? `System: ${action.value}` : action.value,
      };
      const ack =
        action.kind === "issue"
          ? `Got it — I’ll note “${action.value}” for the team. I can’t diagnose problems or suggest repairs in chat, but a technician will review the details.`
          : `Thanks — I’ll note ${action.value === "Not sure" ? "that you’re not sure of the system type" : `“${action.value}”`} for the team.`;
      return {
        state: { step: "callback", draft },
        replies: [reply(ack), reply(CALLBACK_QUESTION)],
      };
    }

    case "callback":
      return {
        state: { step: "contact", draft: { ...state.draft, callback: action.value } },
        replies: [
          reply(
            "Last step: how should the office reach you? This is a demo, so please use the sample contact instead of your own details.",
          ),
        ],
      };

    case "contact":
      return {
        state: { step: "done", draft: state.draft },
        replies: [
          reply(`Thanks, ${SAMPLE_CONTACT.name.split(" ")[0]}. Here’s the request I’d send to the office:`),
          { summary: buildSummary(state.draft) },
          reply(
            "In a live setup, this request goes to the office so a team member can follow up and confirm scheduling. This is a demo, so nothing was submitted or booked.",
          ),
        ],
      };

    case "restart":
      return {
        state: initialState(),
        replies: [reply("Sure — what else can I help with?")],
      };
  }
}

function handleIntent(intent: Intent): Turn {
  switch (intent) {
    case "area":
      return {
        state: { step: "zip", draft: {} },
        replies: [reply("Happy to check. What ZIP code is the service address in? (For this demo, pick a sample ZIP.)")],
      };
    case "repair":
      return {
        state: { step: "zip", draft: { service: "AC repair" } },
        replies: [
          reply(
            "Sorry your AC is giving you trouble. I can start a repair request for the office. First, what ZIP code is the service address in?",
          ),
        ],
      };
    case "maintenance":
      return {
        state: { step: "zip", draft: { service: "Maintenance visit" } },
        replies: [
          reply(
            "Yes — you can request a maintenance visit here, and the office will follow up to schedule it. What ZIP code is the service address in?",
          ),
        ],
      };
    case "hours":
      return {
        state: initialState(),
        replies: [
          reply(
            `The office is open ${DEMO_COMPANY.hours}. Outside those hours, I can still take a service request for the team to follow up on.`,
          ),
        ],
      };
    case "human":
      return {
        state: { step: "zip", draft: { service: "Callback request" } },
        replies: [
          reply(
            "Of course. I’ll take a few quick details so someone from the office can call you back. What ZIP code is the service address in?",
          ),
        ],
      };
  }
}

// --- Free-text handling -------------------------------------------------------

const PERSONAL_DETAILS = /@|\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}|\d{7,}/;
const ZIP_LIKE = /\b\d{5}\b/;

type TextRule = { pattern: RegExp; respond: (state: BotState) => Turn };

function info(text: string) {
  return (state: BotState): Turn => {
    const nudge =
      state.step !== "menu" && state.step !== "done" ? [reply("When you’re ready, pick an option below to continue.")] : [];
    return { state, replies: [reply(text), ...nudge] };
  };
}

function startIntent(intent: Intent) {
  return (): Turn => handleIntent(intent);
}

// Order matters: safety and guardrail answers come before flow intents.
const TEXT_RULES: TextRule[] = [
  {
    pattern: /(smell(s|ing)? (gas|smoke|burning)|gas (smell|leak)|\bsmoke|\bsmoking\b|burning smell|carbon monoxide|\bco alarm|\bsparks?\b|\bfire\b)/,
    respond: info(
      "If you smell gas, see smoke, or have a carbon monoxide alarm going off, leave the building and call 911 or your gas utility from a safe place. I can’t handle emergencies in chat.",
    ),
  },
  {
    pattern: /(price|pricing|cost|how much|charge|fee|quote|estimate|\$)/,
    respond: info(
      "I can’t give prices in chat — it depends on the equipment and the job. The office can go over pricing when they follow up on your request.",
    ),
  },
  {
    pattern: /(myself|diy|troubleshoot|instructions|how (do|can|should) i (fix|repair|reset|replace))/,
    respond: info(
      "I can’t walk you through repairs here, but I can start a request so a technician can take a look.",
    ),
  },
  {
    pattern: /(today|tonight|tomorrow|right now|asap|available|availability|how soon|same[\s-]?day|when can)/,
    respond: info(
      "I can’t promise a specific time or technician availability. I can send your request to the office, and they’ll follow up to schedule.",
    ),
  },
  { pattern: /\b(hours?|open|closed?|closing|weekends?|saturday|sunday)\b/, respond: startIntent("hours") },
  {
    pattern: /(human|person|someone|real|agent|representative|call me|call back|callback|talk to|speak)/,
    respond: startIntent("human"),
  },
  { pattern: /(maintenance|tune[\s-]?up|check[\s-]?up|inspection|cleaning)/, respond: startIntent("maintenance") },
  { pattern: /(area|zip|service my|come to|near me|located|location|town|city|serve)/, respond: startIntent("area") },
  {
    pattern: /(repair|broken|not (cooling|working|heating|turning)|warm air|\bac\b|a\/c|air condition|furnace|heat|noise|leak)/,
    respond: startIntent("repair"),
  },
  {
    pattern: /^(hi|hello|hey|good (morning|afternoon|evening))\b/,
    respond: info("Hi there! Ask a question below, or pick one of the suggested options."),
  },
];

export function handleText(state: BotState, rawText: string): TextTurn {
  const text = rawText.trim().slice(0, MAX_INPUT_LENGTH).toLowerCase();

  if (PERSONAL_DETAILS.test(text)) {
    return {
      state,
      redactUserText: true,
      replies: [
        reply(
          "Thanks — but this is only a demo, so please don’t enter real contact details. I’ve hidden that message. The sample options work just as well.",
        ),
      ],
    };
  }

  if (ZIP_LIKE.test(text)) {
    return {
      state,
      redactUserText: true,
      replies: [
        reply(
          state.step === "zip"
            ? "For this demo, please pick one of the sample ZIP codes below instead of a real one."
            : "For this demo, please use the sample options instead of real location details. I’ve hidden that message.",
        ),
      ],
    };
  }

  const rule = TEXT_RULES.find((candidate) => candidate.pattern.test(text));
  if (rule) {
    return { ...rule.respond(state), redactUserText: false };
  }

  return {
    ...info(
      "I’m not sure about that one, and I’d rather not guess. The office can answer it when they follow up — or you can choose an option below.",
    )(state),
    redactUserText: false,
  };
}
