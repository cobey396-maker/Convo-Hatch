# Auto-Planner

Tell it what you need to do, and it plans your week. A mobile-first schedule
app for teens and young adults, with a native iOS feel.

> Status: **Phase 1 of 12 complete** (project setup and design system).
> Screenshots, the architecture diagram and full setup docs arrive in Phase 11.
> What each phase taught is in [LEARNING.md](LEARNING.md).

## Run it

From the repository root (Node.js 22.6+):

```bash
npm install
npm run dev:planner
```

Open http://localhost:3002, then http://localhost:3002/design for the style guide.

## Checks

| Command (repo root) | What it does |
| --- | --- |
| `npm run lint -w @convohatch/planner` | ESLint |
| `npm run typecheck -w @convohatch/planner` | TypeScript |
| `npm test -w @convohatch/planner` | Vitest unit tests |
| `npm run check:planner` | All of the above, then a production build |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Motion · Vaul ·
zod · Vitest · Playwright. Coming in later phases: Supabase (Postgres, Auth,
Realtime), Prisma, dnd-kit, the Claude API, and Capacitor.

## Layout

```
app/
  globals.css        design tokens (colors, type, radii, springs) for light + dark
  layout.tsx         root layout, theme script, providers
  design/            /design style guide
components/
  providers.tsx      theme + reduced-motion config
  ui/                design-system components
lib/
  design/tokens.ts   tokens JS needs (task colors, spacing)
  design/motion.ts   spring presets and animation variants
  theme.ts           theme preference logic
tests/unit/          Vitest tests
```

## Roadmap

1. ✅ Project setup, design system
2. Database schema + Prisma + RLS
3. Auth + onboarding
4. Today and Week views with fixed events
5. Tasks + auto-scheduling algorithm + unit tests
6. Drag-to-reschedule + swipe-to-complete
7. Natural-language input with Claude API
8. Streaks + weekly recap
9. Friends + shared free time + realtime
10. Notifications, settings, privacy/terms pages
11. PWA setup, testing, deploy to Vercel
12. Capacitor wrap for iOS/Android + store-launch checklist
