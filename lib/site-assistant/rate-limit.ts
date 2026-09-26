// Best-effort, in-memory limits for the public AI endpoint. Each server instance keeps its own
// counters, so treat these as a cost guard, not a security boundary. Add host-level rate limiting
// in production as well.

const WINDOW_MS = 10 * 60 * 1000;
const PER_VISITOR_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const visitors = new Map<string, { count: number; start: number }>();
let daily = { count: 0, start: Date.now() };

function dailyLimit(): number {
  const configured = Number(process.env.SITE_ASSISTANT_DAILY_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? configured : 300;
}

/** Records one request and returns false if the visitor or the whole site is over its limit. */
export function allowRequest(visitorKey: string, now = Date.now()): boolean {
  if (now - daily.start > DAY_MS) daily = { count: 0, start: now };
  if (daily.count >= dailyLimit()) return false;

  const entry = visitors.get(visitorKey);
  if (!entry || now - entry.start > WINDOW_MS) {
    visitors.set(visitorKey, { count: 1, start: now });
  } else if (entry.count >= PER_VISITOR_LIMIT) {
    return false;
  } else {
    entry.count += 1;
  }

  daily.count += 1;

  // Keep memory bounded.
  if (visitors.size > 5000) {
    for (const [key, value] of visitors) {
      if (now - value.start > WINDOW_MS) visitors.delete(key);
    }
  }
  return true;
}
