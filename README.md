# ConvoHatch website

Marketing site for ConvoHatch, which adds custom chatbots to websites for local service businesses (HVAC first, then plumbing, electrical, roofing, and other trades).

Built with Next.js (App Router), TypeScript, and Tailwind CSS v4. Fonts are Outfit (headings) and Manrope (body), loaded with `next/font/google`.

## Run locally

Requires Node.js 22.6 or newer (Node 22 LTS or 24 LTS).

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests for the demo chatbot script and form validation (Node's built-in test runner) |
| `npm run build` | Production build |
| `npm run check` | All of the above, in order |

## Demo request form: configure before launch

The "Request a Demo" form posts to `app/api/demo-request/route.ts`, which delivers requests using server-side environment variables. **Until one delivery option is configured, the form shows that online requests are unavailable and its fields are disabled.** It never shows a success message unless delivery succeeded.

1. Copy `.env.example` to `.env.local` (local) or add the same variables in your host's settings (production).
2. Configure **one** option:
   - **Email via [Resend](https://resend.com):** set `RESEND_API_KEY`, `DEMO_REQUEST_TO_EMAIL`, and `DEMO_REQUEST_FROM_EMAIL`. The sender must be on a domain you have verified in Resend. The visitor's email is set as `reply_to`.
   - **Webhook:** set `DEMO_REQUEST_WEBHOOK_URL` (must be `https://`), for example a Zapier, Make, or n8n hook, or a CRM endpoint. Optionally set `DEMO_REQUEST_WEBHOOK_SECRET`, which is sent as `Authorization: Bearer <secret>`. The body is JSON: `{ type, submittedAt, name, business, email, website, trade, message }`.
   - If both are configured, Resend is used.
3. Restart the server, submit a test request, and confirm it arrives.

Notes:

- Credentials are read only on the server. Don't prefix them with `NEXT_PUBLIC_`.
- The route validates input on the server too, uses a hidden spam-trap field, checks the request origin, and limits body size. Consider adding rate limiting at your host (for example, Vercel firewall rules) before heavy traffic.
- Logs never include submitted personal information. Failed deliveries log only the provider and HTTP status.

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
- Optionally add `ANTHROPIC_API_KEY` to turn on AI replies in the site assistant, then set a spending limit in the Anthropic Console.
- Add a privacy policy if your jurisdiction or delivery setup requires one, and link it from the footer and form. No legal pages are included, and the site makes no legal claims.
- Optionally set `metadataBase` and an Open Graph image in `app/layout.tsx` once the production domain is known.
