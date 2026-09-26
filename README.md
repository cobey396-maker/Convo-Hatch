# ConvoHatch

ConvoHatch adds custom chatbots to websites for local service businesses (HVAC first, then plumbing, electrical, roofing, and other trades).

## Repository structure

This repository is an npm workspaces monorepo:

| Path | What it is |
| --- | --- |
| `apps/website` | The ConvoHatch marketing website: Next.js (App Router), TypeScript, and Tailwind CSS v4. Fonts are Outfit (headings) and Manrope (body), loaded with `next/font/google`. |
| `apps/chatbot` | The hosted, embeddable HVAC chatbot: a separate Next.js app with the widget loader, chat panel, API, database migrations, admin CLI, and a fictional demo contractor site. See [`apps/chatbot/README.md`](apps/chatbot/README.md). |
| `package.json` | Workspace root, with shortcut commands for both apps. |
| `package-lock.json` | The single lockfile for all workspaces. Run `npm install` from the root only. |

Unless noted otherwise, paths in the sections below are relative to `apps/website`. The chatbot service has its own guide in [`apps/chatbot/README.md`](apps/chatbot/README.md) (run it with `npm run dev:chatbot`, on port 3001).

## Run locally

Requires Node.js 22.6 or newer (Node 22 LTS or 24 LTS). From the repository root:

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

For local environment variables, copy `apps/website/.env.example` to `apps/website/.env.local`. Next.js reads env files from the app's folder, not the repository root. `.env*` files other than `.env.example` are ignored by Git.

## Checks

Run these from the repository root. `lint`, `typecheck`, `test`, and `check` run in every workspace (website and chatbot); `build` and `start` target the website (use `build:chatbot` / `start:chatbot` for the chatbot). To run one inside a single app, `cd` into it and use the same command.

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests for the demo chatbot, booking, pricing, form validation, and site assistant (Node's built-in test runner) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run check` | Lint, typecheck, tests, and build, in order |

To add a dependency to the website, run `npm install <package> -w @convohatch/website` from the root.

## Deployment (Vercel)

The website deploys to Vercel from this repository. In the Vercel project settings, set **Root Directory** to `apps/website` and keep **Include files outside the root directory in the Build Step** enabled. Vercel then installs dependencies from the root lockfile and builds the website workspace. Leave the framework preset as Next.js, with the default build and install commands. Environment variables are set in Vercel and are unaffected by the move.

## Demo request form: configure before launch

The "Request a Demo" form posts to `apps/website/app/api/demo-request/route.ts`, which delivers requests using server-side environment variables. **Until one delivery option is configured, the form shows that online requests are unavailable and its fields are disabled.** It never shows a success message unless delivery succeeded.

1. Copy `apps/website/.env.example` to `apps/website/.env.local` (local) or add the same variables in your host's settings (production).
2. Configure **one** option:
   - **Email via [Resend](https://resend.com):** set `RESEND_API_KEY`, `DEMO_REQUEST_TO_EMAIL`, and `DEMO_REQUEST_FROM_EMAIL`. The sender must be on a domain you have verified in Resend. The visitor's email is set as `reply_to`.
   - **Webhook:** set `DEMO_REQUEST_WEBHOOK_URL` (must be `https://`), for example a Zapier, Make, or n8n hook, or a CRM endpoint. Optionally set `DEMO_REQUEST_WEBHOOK_SECRET`, which is sent as `Authorization: Bearer <secret>`. The body is JSON: `{ type, submittedAt, name, business, email, website, trade, message }`.
   - If both are configured, Resend is used.
3. Restart the server, submit a test request, and confirm it arrives.

Notes:

- Credentials are read only on the server. Don't prefix them with `NEXT_PUBLIC_`.
- The route validates input on the server too, uses a hidden spam-trap field, checks the request origin, and limits body size. Consider adding rate limiting at your host (for example, Vercel firewall rules) before heavy traffic.
- Logs never include submitted personal information. Failed deliveries log only the provider and HTTP status.

## Schedule a Call page

`/schedule` shows a calendar where visitors pick a 30-minute Zoom call, then enter their name, email, and phone number. Links to it are in the header, footer, and demo request section.

- **Hours:** weekdays 5–9 PM and Saturdays 9 AM–2 PM, no Sundays, in 30-minute slots. Visitors can book up to 3 weeks ahead with at least 2 hours' notice. Change these in `lib/booking.ts` (`WEEKLY_HOURS`, `BOOKING_WINDOW_DAYS`, `MIN_NOTICE_MINUTES`), and update `schedule.hoursNote` in `content/site.ts` to match.
- **Time zone:** set `schedule.timeZone` in `content/site.ts` (default `America/New_York`). Times are shown in that zone, and the form also shows the visitor's local time when it differs.
- **Getting notified:** booking stays disabled until at least one of these is set in Vercel's Environment Variables (see `.env.example`). Every configured option is used.
  - **Text to your phone (Twilio):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `BOOKING_NOTIFY_PHONE`. US numbers need toll-free verification or A2P 10DLC registration in Twilio first, which can take a few days.
  - **Free push notification (ntfy):** install the ntfy app, subscribe to a long, hard-to-guess topic name, and set `NTFY_TOPIC` to it. Works right away.
  - **Email / webhook:** the Resend and webhook settings from the demo form also receive bookings. With Resend set up, the visitor also gets a confirmation email.
- **Double booking:** add Upstash Redis from the Vercel Marketplace (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`) so booked times show crossed out on the calendar and can't be picked again. A day with every time booked is crossed out too. Without it, every time stays open, and you sort out any clash when you send the Zoom link.
- The notification includes the time, name, email, and phone number. Reply to the visitor with your Zoom link.

## Site assistant (chat button)

Every page shows a "Questions? Ask us" button that opens the ConvoHatch assistant. It answers questions about ConvoHatch and points visitors to the demo request form.

- **Without configuration:** it answers from scripted replies in `lib/site-assistant/scripted.ts`, drawn from the approved copy in `content/site.ts`. The scripted replies are free and run entirely in the browser.
- **With `ANTHROPIC_API_KEY` set:** it answers with Claude (`claude-sonnet-5`, low effort), at roughly half a cent to one cent per question. The system prompt in `lib/site-assistant/ai.ts` restricts it to a fact sheet built from `content/site.ts`, and tells it not to invent prices, clients, statistics, or contact details. If Claude declines a request or the call fails (network, rate limit, timeout), the visitor gets the scripted reply instead.
- **Cost guards:** messages are capped at 500 characters and 16 turns of history. Each visitor can send 20 AI requests per 10 minutes, and each server instance allows `SITE_ASSISTANT_DAILY_LIMIT` per day (default 300). These counters live in memory, so add host-level rate limiting for production traffic too.
- **Privacy:** messages that look like an email address or phone number are hidden in the chat and never sent to the server. Conversations are not stored or logged; the server logs only an error category when an AI reply fails.

When you update the site copy, the assistant picks up the change automatically. Run `npm test` after editing the scripted rules.

## Editing content

All copy is in `content/site.ts`: navigation, hero, benefits, steps, industries, FAQ, form text, and footer links. Components in `components/` read from it.

The sample chatbot script (fictional "Cedar Hollow Heating & Air") is in `lib/demo-bot.ts`. It runs entirely in the browser with scripted replies. It uses preset sample ZIP codes and a sample contact, hides messages that look like personal details, and never gives prices, repair instructions, or availability promises. Run `npm test` after editing it.

Brand colors are defined as Tailwind theme tokens in `app/globals.css` (`petrol`, `sky`, `ocean`, `ice`, plus supporting shades).

## Before launch

- Configure demo-request delivery (above).
- Set your time zone and at least one booking notification for the Schedule a Call page (above).
- Optionally add `ANTHROPIC_API_KEY` to turn on AI replies in the site assistant, then set a spending limit in the Anthropic Console.
- Add a privacy policy if your jurisdiction or delivery setup requires one, and link it from the footer and form. No legal pages are included, and the site makes no legal claims.
- Optionally set `metadataBase` and an Open Graph image in `app/layout.tsx` once the production domain is known.
