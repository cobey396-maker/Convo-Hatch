# ConvoHatch chatbot service

The hosted, embeddable chatbot that ConvoHatch installs on HVAC contractors' websites. One deployment serves every client: each client has its own branding, approved business information, service-area ZIP codes, lead destination, and allowed websites, stored in a database.

It's a separate Next.js app from the marketing site (`apps/website`), so it can be deployed, scaled, and secured on its own. The marketing site is unchanged.

## How it fits together

```
Contractor's website                           This app (apps/chatbot)
─────────────────────                          ──────────────────────────────────────────────
<script src=".../widget.js"      ── loads ──►  public/widget.js       loader: launcher button + iframe
        data-client-id="acme">
  launcher button (shadow DOM)
  iframe ──────────────────────── frames ───►  /embed/<client-id>      chat panel (React)
                                               middleware.ts           sets frame-ancestors from the
                                                                        client's allowed origins
                          chat panel calls ──► /api/widget/*           conversations, messages,
                                                                        service-area, leads, cron
                                               lib/                    business logic (below)
                                               PostgreSQL              clients, chats, leads, counters
                                               Claude API (optional)   AI answers
                                               Resend (optional)       lead emails
```

| Path | What it is |
| --- | --- |
| `public/widget.js` | The loader script clients install. Adds a launcher button in a shadow root and loads the chat panel in an iframe, so neither site's CSS affects the other. |
| `app/embed/[publicId]/page.tsx`, `components/` | The chat panel shown in the iframe, including the callback-request form. |
| `middleware.ts` | Sets `Content-Security-Policy: frame-ancestors` on the chat panel from the client's allowed origins. |
| `app/api/widget/` | Widget API: `conversations`, `messages`, `service-area`, `leads`, `frame-policy` (used by the middleware), `cron`. |
| `lib/` | Server logic: `config.ts` (client settings and validation), `conversations.ts` (chat), `answers.ts` (ZIP checks, safety rules, FAQ matching, AI output guard), `ai.ts` (Claude), `leads.ts` + `lead-fields.ts` (service requests), `notify.ts` (email + retries), `limits.ts` (rate limits and caps), `retention.ts`, `db.ts`. |
| `db/migrations/` | SQL migrations. |
| `db/clients/` | Client configuration files: `demo-cedar-hollow.json` (fictional demo) and `example-client.json` (template). |
| `scripts/widget.ts` | Admin CLI: migrations, seeding, client configuration, snippets, leads, retries, retention. |
| `demo-site/` + `scripts/demo-site-server.mjs` | A fictional contractor website on a separate origin that loads the widget through the real installation snippet. |
| `scripts/e2e-widget.mjs` | Browser test of the embedded widget (desktop keyboard flow, mobile, blocked origins). |
| `tests/` | Unit and integration tests (in-memory PostgreSQL). |

## Run locally

Requires Node.js 22.6 or newer. Install once from the repository root (npm workspaces share one lockfile), then work inside `apps/chatbot`. Every command below runs from `apps/chatbot`.

```bash
npm install                      # at the repository root
cd apps/chatbot
cp .env.example .env.local       # DATABASE_URL=pglite:./.data/pglite is preset
                                 # for local email, also set WIDGET_EMAIL_PROVIDER=outbox and
                                 # WIDGET_DEMO_NOTIFY_TO=you@example.com in .env.local
npm run widget -- seed           # creates the database and the fictional demo client
npm run dev                      # chatbot app on http://localhost:3001
npm run demo:site                # in a second terminal: demo contractor site on http://localhost:4000
```

Open http://localhost:4000 and use the chat button in the corner.

- The local database is embedded PostgreSQL ([PGlite](https://pglite.dev)) in `apps/chatbot/.data/`. No database server is needed. Only one process can open it at a time, so **stop the app before running `npm run widget -- …` commands**, or point `DATABASE_URL` at a real PostgreSQL server (for example `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:17`, then `DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres`).
- Without `ANTHROPIC_API_KEY`, the widget says "Live AI is unavailable" and gives automatic answers from the client's approved FAQs, hours, and services, each labeled "Automatic reply". Add a key to `.env.local` and restart for AI answers.
- Email: with `WIDGET_EMAIL_PROVIDER=outbox`, each notification is written to `.data/outbox/*.eml` instead of being sent, so you can see exactly what would go out without an email account. With no provider configured, leads are still stored and wait for the retry job.
- Demo mode: the demo client never emails a contractor. Its leads go only to `WIDGET_DEMO_NOTIFY_TO` (your own test inbox, subject prefixed `[DEMO]`), or are just stored if that's empty.

## Checks

Inside `apps/chatbot` (from the repository root, add `-w @convohatch/chatbot`, e.g. `npm test -w @convohatch/chatbot`):

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint, `tsc --noEmit` |
| `npm test` | Tests against an in-memory PostgreSQL: client isolation, unknown questions and missing information, ZIP checks, repair and emergency handling, AI output guard, lead validation, explicit submission, duplicate prevention, notification failures and retries, demo suppression, rate limits and usage caps, missing AI/database configuration, retention |
| `npm run build` | Production build |
| `npm run test:e2e` | Browser test (see below) |

### Browser test

Needs Playwright (`npm i -D playwright` and `npx playwright install chromium`, or set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` to an existing install). Run `npm run widget -- seed`, then build and start the app with the per-visitor limits raised (every test run starts several chats from the same IP, and the default limit of 10 chats per hour would otherwise kick in, correctly), and start the demo site:

```bash
npm run build
WIDGET_EMAIL_PROVIDER=outbox WIDGET_DEMO_NOTIFY_TO=demo-inbox@convohatch.example \
  WIDGET_VISITOR_CONVERSATIONS_PER_HOUR=1000 WIDGET_VISITOR_MESSAGES_PER_10_MIN=1000 WIDGET_VISITOR_LEADS_PER_HOUR=1000 npm start
npm run demo:site        # second terminal
```

Then:

```bash
npm run test:e2e
```

It checks, on the demo contractor site: the launcher is reachable with Tab; Enter opens the chat and moves focus into it; ZIP, repair, and FAQ answers; the callback form's error handling, review step, and submission, entirely by keyboard, and that the `[DEMO]` notification email reached the local outbox addressed only to the demo inbox (set `E2E_OUTBOX_DIR=off` to skip this when using Resend); Escape closes and returns focus; on an iPhone-sized screen the launcher sits above the site's sticky call bar and the chat is full screen; an unapproved website (`127.0.0.1:4000`) and an unknown client ID get no launcher. Screenshots go to `.e2e-screenshots/`.

## Configure a client

Clients are configured with JSON files and the admin CLI. There is deliberately no web admin yet: the CLI talks to the database directly, so only someone with the database credentials can change a client.

1. Copy the template: `cp db/clients/example-client.json db/clients/acme-heating.json`. Client files contain the contractor's email, so Git ignores everything in `db/clients/` except the demo and the template. Keep your own copies somewhere private and backed up.
2. Fill it in with **the contractor's approved wording only**. The AI treats this as the complete truth and says "I don't have that information" for anything missing.

   | Field | Meaning |
   | --- | --- |
   | `publicId` | Identifier used in the snippet, e.g. `acme-heating` (lowercase letters, digits, hyphens). It is public and is not a password. |
   | `businessName`, `profile.branding` | Name shown in the chat; brand color (text color is chosen automatically for contrast); assistant name; greeting; launcher label. |
   | `profile.timeZone`, `profile.hours`, `profile.hoursNote` | IANA time zone (e.g. `America/Chicago`), opening hours per day (24-hour `HH:MM`; missing days are closed), optional note. |
   | `profile.services` | Approved services. The callback form offers exactly these, plus "Something else / not sure". |
   | `profile.faqs` | Approved questions and answers. |
   | `profile.contact` | Phone, email, website, address the chatbot may share. |
   | `profile.emergencyMessage` | Approved wording shown for gas smells, CO alarms, smoke, or fire. A generic "leave and call 911" message is used if omitted. |
   | `serviceZipCodes` | 5-digit ZIP codes served. The chat and the form check these; the AI is never allowed to decide. |
   | `leadDestinationEmails` | Where service requests are emailed (up to 5). Never shown to visitors or the AI. |
   | `allowedOrigins` | Websites allowed to show the widget, exactly as in the address bar without a path, e.g. `https://www.acme-heating.com` and `https://acme-heating.com`. Include every variant (www and non-www). `http://` is allowed only for `localhost`. |
   | `isDemo` | `true` marks a demo: its leads never go to a contractor, only to your `WIDGET_DEMO_NOTIFY_TO` test inbox (if set). Demo configs must leave `leadDestinationEmails` empty. |
   | `limits` | Optional per-client daily caps: `dailyConversations`, `dailyAiReplies`, `dailyLeads`, `maxVisitorMessagesPerConversation`. |

3. Validate, then save:

   ```bash
   npm run widget -- client:check db/clients/acme-heating.json
   DATABASE_URL=postgres://… npm run widget -- client:upsert db/clients/acme-heating.json
   ```

   `client:upsert` refuses files that still contain template placeholders. Run it again after any edit; changes apply immediately (framing permissions within a minute).

Other commands (`npm run widget -- help` lists them all): `client:list`, `client:show <id>`, `client:snippet <id>`, `client:disable <id>` / `client:enable <id>`, `leads:list <id> [--full]` (contact details hidden unless `--full`), `notifications:retry`, `purge`, `migrate`.

## Install on a client's website

`npm run widget -- client:snippet <publicId>` prints the snippet, using `WIDGET_PUBLIC_BASE_URL` for the host:

```html
<script src="https://YOUR-CONVOHATCH-HOST/widget.js" data-client-id="acme-heating" async></script>
```

Paste it just before `</body>` on every page, or in the site's "custom code / footer scripts" setting:

- **WordPress:** a header/footer code plugin (for example WPCode), "Footer" section; or the theme's footer if you maintain it.
- **Squarespace:** Settings → Advanced → Code Injection → Footer (requires a plan with code injection).
- **Wix:** Settings → Custom Code → Add Code, "Body – end", all pages (requires a premium plan and a connected domain).
- **Webflow:** Site settings → Custom code → Footer code, then publish.
- **Google Tag Manager:** a Custom HTML tag firing on all pages.

Then add the site's exact origin(s) to the client's `allowedOrigins`, reload the page, and confirm the button appears. If it doesn't, the browser console shows a `[ConvoHatch]` message; the usual cause is a missing www/non-www variant in `allowedOrigins`.

Optional attributes: `data-position="left"`; `data-offset-bottom="24"`; `data-mobile-offset-bottom="80"` to sit above a sticky "Call now" bar on phones. Any button on the site can open the chat with `onclick="ConvoHatch.open()"`.

## How answers work

Every message is handled on the server, in this order, using only the requesting client's settings:

1. Emergency wording (gas smell, CO alarm, smoke, fire) → the approved emergency message. No AI.
2. Email addresses or phone numbers typed into chat → removed before storage; the visitor is pointed to the callback form. No AI.
3. Requests for repair or troubleshooting instructions → declined with a callback offer. No AI.
4. ZIP code questions → checked against `serviceZipCodes`. No AI.
5. Anything else → Claude with a system prompt containing only the client's approved facts, instructions to admit missing information and offer a callback, and rules against inventing prices, availability, service areas, policies, or appointment confirmations. Visitor text is treated as untrusted.
6. Every AI reply is checked before it's shown. A reply that states a price, ZIP code, phone number, or email that isn't in the approved facts, confirms an appointment, or promises availability is replaced by an automatic answer.
7. If AI isn't configured, fails, or a usage cap is reached, the visitor gets an automatic answer from the approved FAQs, hours, and services, or "I don't have approved information about that" plus a callback offer. The widget shows when live AI is unavailable, and each reply is labeled "AI-generated answer" or "Automatic reply".

The browser never sends instructions, history, or destinations: it sends the public client ID, a server-issued conversation ID, and the visitor's text. History for the AI is read from the database for that conversation and client only.

## Service requests (leads)

The visitor fills in name, phone and/or email, service ZIP code, service needed (from the approved list), optional details, and a preferred callback window. If their browser's time zone differs from the business's, they choose which one they mean. They review everything on a summary screen that states it's a callback request, not an appointment, and press **Send request**.

The server re-validates everything, then stores the lead and its notification record in a single database statement **before** reporting success. The visitor sees a reference like `CH-7K3M9Q2A`; the widget never says an email was delivered.

- **Duplicates:** each reviewed request carries an idempotency key, so double-clicks and network retries return the original lead. The same contact, ZIP, and service on the same day is also treated as a duplicate. Duplicates don't send a second email.
- **Email:** sent through Resend right after storing, with an `Idempotency-Key` so a retried send isn't duplicated by the provider. Status `accepted` means Resend accepted the message, not that it reached an inbox.
- **Failures:** a failed send is recorded (`failed`, attempt count, error code) and retried with backoff (1 minute doubling to 6 hours, 8 attempts, then `gave_up`). Retries run from `npm run widget -- notifications:retry` or the cron endpoint. `leads:list` shows each lead's notification status.
- **Demo clients** (`isDemo: true`) never email a contractor: their config can't list destinations, and at send time their leads are addressed only to `WIDGET_DEMO_NOTIFY_TO` with a `[DEMO]` subject, or not emailed at all when it's empty.
- Out-of-area ZIP codes are accepted but flagged in the email, and the visitor is warned on the review screen.

## Security and abuse controls

- **Client IDs are public identifiers**, not secrets. Everything is resolved on the server from the ID: configuration, AI facts, ZIP list, notification destination. Conversation and lead lookups always filter by the resolved client, so one client's IDs can't reach another's data (tested).
- **Embedding** is restricted with `Content-Security-Policy: frame-ancestors <allowedOrigins>` on the chat panel; unknown or disabled clients get `'none'`. Other pages send `X-Frame-Options: SAMEORIGIN`. This is a browser control only.
- **Server-side controls** don't depend on it: the widget API rejects cross-site browser requests (Origin check), validates and size-limits every body, caps message length (500 characters) and messages per conversation, rate-limits per visitor (hashed IP) and per client, and applies per-client and global daily caps on conversations, AI replies, and leads. Counters live in the database, so they hold across server instances. Defaults are in `.env.example`.
- **Secrets** (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `CRON_SECRET`) are read only on the server. The browser receives only the public view of a client (no destinations, origins, or limits).
- **Logging:** server logs contain reason codes and IDs only, never messages, names, or contact details.
- Rate limits use the `x-real-ip` / `x-forwarded-for` header, which Vercel sets. On other hosts, make sure the proxy overwrites these headers.

## Storage and retention

| Data | Where | Kept for |
| --- | --- | --- |
| Client configuration | `clients` table | Until changed or deleted |
| Chat messages | `conversation_messages` (visitor text with emails and phone numbers removed) | `WIDGET_CONVERSATION_RETENTION_DAYS` after the last message (default 30) |
| Service requests | `leads` (name, contact details, ZIP, service, details, callback preference) and `lead_notifications` (status only) | `WIDGET_LEAD_RETENTION_DAYS` (default 365) |
| Rate-limit counters | `usage_counters` (hashed visitor keys, no IP addresses) | 2 days |

Deletion runs with `npm run widget -- purge` or the cron endpoint. Leads are also delivered by email, and those copies are governed by the contractor's mailbox, not this app. Conversations are sent to Anthropic for AI replies when AI is enabled; see Anthropic's data retention terms for your account. Publish a privacy notice covering this before launch.

## Deploying (not done yet)

Nothing has been deployed or purchased. To launch:

1. **Hosting:** create a second Vercel project from this repository with **Root Directory** `apps/chatbot` (keep "Include files outside the root directory" enabled). Give it its own domain, e.g. `chat.your-domain.com`, and set `WIDGET_PUBLIC_BASE_URL` to it. Any Node.js host that runs Next.js also works.
2. **Database:** provision managed PostgreSQL (for example Neon or Supabase through the Vercel Marketplace), set `DATABASE_URL`, then run `DATABASE_URL=… npm run widget -- migrate` from your machine. Use a pooled connection string on serverless hosts.
3. **AI:** set `ANTHROPIC_API_KEY` and a monthly spend limit in the Anthropic Console. The default model is `claude-opus-5` at low effort; `WIDGET_AI_MODEL` overrides it.
4. **Email:** verify a sending domain in Resend, then set `RESEND_API_KEY` and `LEAD_NOTIFY_FROM_EMAIL`.
5. **Scheduled jobs:** set `CRON_SECRET` and call `GET /api/widget/cron` with `Authorization: Bearer <CRON_SECRET>` every few minutes (Vercel Cron on a paid plan via `vercel.json`, or any external scheduler). Without it, failed notifications wait until you run `notifications:retry` and old data isn't purged.
6. **Limits:** set `WIDGET_HASH_SECRET` to a long random value and review the caps in `.env.example`. Consider host-level rate limiting (for example Vercel Firewall rules) for `/api/widget/*`.
7. Configure each client (above), send a test lead, confirm the email arrives and `leads:list` shows `accepted`.
8. Note: Vercel Deployment Protection on preview deployments blocks the middleware's internal lookup, so previews show no widget unless protection is bypassed.

## Current limitations

- No web admin dashboard, appointment scheduling, CRM integration, or billing (by design for this version).
- Email is the only notification channel.
- US 5-digit ZIP codes and 10-digit US phone numbers only.
- The AI output guard is a pattern check. It blocks invented prices, ZIPs, contact details, appointment confirmations, and common availability promises, but it can't catch every invented policy; the system prompt and the approved-facts-only design carry most of that weight. Review real conversations with each contractor early on.
- The embedded local database allows one process at a time.
- The widget is English only.
