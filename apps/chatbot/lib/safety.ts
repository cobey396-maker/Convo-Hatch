// Emergency detection and safety wording. Shared by the server (chat replies) and the widget
// (callback-form details). Keep this file free of browser- or server-only imports.
//
// Wording follows public safety guidance, simplified for a chat reply:
// - Gas: PHMSA "Pipeline Leak Recognition and What to Do" — leave the area on foot; don't use
//   phones, light or electrical switches, or anything that makes a spark or flame; don't try to
//   locate the leak; call 911 (then the gas company) from a safe location.
// - Carbon monoxide: CPSC Carbon Monoxide Q&A — move outside to fresh air immediately, call 911,
//   and don't go back in until emergency responders say it's safe.
// - Smoke or fire: fire-service "Get out, stay out, call 911" guidance (USFA/NFPA).
// Deliberately omitted: anything that asks the visitor to touch equipment (for example shutting
// off gas valves or breakers), because the chat can't judge whether that is safe.

export type Hazard = "gas" | "co" | "fire" | "electrical" | "danger";

const HAZARD_PATTERNS: [Hazard, RegExp][] = [
  [
    "gas",
    /\b(smell(s|ing|ed)?\s+(of\s+|like\s+)?(natural\s+|propane\s+)?gas|gas\s+(smell|leak|odou?r)|(natural\s+gas|propane)\s+leak|rotten\s+eggs?\s+(smell|odou?r)|smell(s|ing)?\s+(of\s+|like\s+)?rotten\s+eggs?|hissing\s+(sound\s+)?(from|near)\s+(the\s+)?gas)/i,
  ],
  [
    "co",
    /\b((carbon\s+monoxide|co)\s*(alarm|detector|monitor)s?\s*(is\s+|are\s+|keeps\s+|just\s+)?(going\s+off|went\s+off|beeping|sounding|alarming|ringing|chirping|goes\s+off)|carbon\s+monoxide\s+(poisoning|leak|in\s+(my|the|our)\s+(house|home))|smell\s+carbon\s+monoxide)\b/i,
  ],
  [
    "fire",
    /\b(on\s+fire|(flames?|fire)\s+(in|from|coming|inside|near)\b|smoke\s+(coming|pouring|from|in\s+the)|(furnace|unit|heater|ac|a\/c|vent|attic|basement|house|room)\s+(is\s+)?(smoking|on\s+fire|filling\s+with\s+smoke)|house\s+fire)/i,
  ],
  [
    "electrical",
    /\b(spark(s|ing|ed)?|(burning|electrical|melting)\s+(smell|odou?r)|smell(s|ing)?\s+(like\s+)?(something\s+|plastic\s+|wires?\s+)?burning|melted\s+wires?|wires?\s+(are\s+)?(melting|smoking))/i,
  ],
  [
    "danger",
    /\b((someone|somebody|my\s+\w+|i|we)\s+(is|am|are|'m|'re)\s+(hurt|injured|unconscious|in\s+danger)|immediate\s+danger|can'?t\s+breathe|passed\s+out|call\s+911\s+for\s+me)\b/i,
  ],
];

/** Hazards mentioned in the text, most severe first. Routine "no heat" or "no cooling" isn't one. */
export function detectHazards(text: string): Hazard[] {
  return HAZARD_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([hazard]) => hazard);
}

const SAFETY_MESSAGES: Record<Hazard, string> = {
  gas: "If you smell gas, leave the building now. Don’t use light switches, phones, or anything that could make a spark on your way out, and don’t look for the leak. Once you’re a safe distance away, call 911 or your gas utility’s emergency number.",
  co: "If a carbon monoxide alarm is going off, or anyone feels dizzy, sick, or confused, get everyone outside to fresh air now and call 911. Don’t go back inside until emergency responders say it’s safe.",
  fire: "If you see smoke or fire, get everyone out, stay out, and call 911 from outside.",
  electrical:
    "Sparks or a burning smell can be a fire risk. Don’t touch the equipment. If you see smoke, flames, or sparks, or the smell is getting stronger, get everyone out and call 911 from outside.",
  danger: "If anyone is in immediate danger, call 911 now.",
};

export const NOT_AN_EMERGENCY_LINE = "This chat can’t send emergency help, and messages here aren’t monitored in real time.";

/** Safety guidance for the given hazards, deduplicated, with the "not an emergency line" notice. */
export function safetyMessage(hazards: Hazard[], businessNote?: string): string {
  const unique = [...new Set(hazards)];
  // The fire message is covered by the electrical one when both match.
  const shown = unique.includes("electrical") ? unique.filter((hazard) => hazard !== "fire") : unique;
  return [...shown.map((hazard) => SAFETY_MESSAGES[hazard]), NOT_AN_EMERGENCY_LINE, businessNote].filter(Boolean).join(" ");
}
