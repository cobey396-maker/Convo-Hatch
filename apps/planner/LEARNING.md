# LEARNING.md

A running notebook of everything this project teaches. Each phase adds a
section: what we built, why, the key concepts, and interview questions you
should be able to answer out loud.

---

## Phase 1: Project setup and design system

### What we built, in plain English

Before building any screens, we decided what the app *looks and moves like*
and wrote it down in code once. That "single source of truth" is the design
system. Every later screen is assembled from it, so the app looks
consistent and changes (a new tint color, a rounder corner) happen in one
place.

Concretely:

| Piece | File | What it does |
| --- | --- | --- |
| Workspace | `apps/planner/package.json` | A new app inside the existing npm-workspaces monorepo, next to `website` and `chatbot`. |
| Color + type tokens | `app/globals.css` | CSS variables for light and dark mode, exposed to Tailwind as classes like `bg-surface`, `text-headline`, `rounded-card`. |
| JS tokens | `lib/design/tokens.ts` | The task colors and sizes that JavaScript needs (color picker, contrast tests, later the widget). |
| Motion presets | `lib/design/motion.ts` | Five named springs (`snappy`, `smooth`, `bouncy`, `sheet`, `reflow`) and reusable variants. |
| Theme | `lib/theme.ts`, `components/providers.tsx` | System/light/dark preference without a white flash on load. |
| Components | `components/ui/*` | Button, Card, ListGroup, SegmentedControl, Sheet, TabBar, LargeTitlePage, TaskBlock, Skeleton, Empty/Error states. |
| Style guide | `app/design/` | A page at `/design` that shows all of the above. |
| Tests | `tests/unit/*` | 51 Vitest tests that enforce design rules. |

### Key concepts

**1. Design tokens and semantic naming.**
A token is a named design decision: `--tint: #007aff`. We name tokens by
*role* (`surface`, `label`, `secondary-label`), not by *appearance*
(`white`, `gray-500`). Dark mode then becomes "give the same names different
values" instead of "find every white thing and add a dark variant".

**2. Tailwind v4 `@theme`.**
Tailwind v4 is configured in CSS, not a JS config file. Inside `@theme`,
`--color-surface: var(--surface)` generates `bg-surface`, `text-surface`,
`border-surface` and so on. `--text-headline` plus `--text-headline--font-weight`
makes `text-headline` set size, line height and weight together.

**3. Dark mode without a flash (FOUC).**
The server doesn't know your theme (it lives in `localStorage` and your OS).
If React applied it after hydrating, dark-mode users would see a white frame
first. So `layout.tsx` inlines a tiny script in `<head>` that runs *before the
first paint* and sets `<html data-theme="dark">`. `suppressHydrationWarning`
tells React that this attribute differing from the server HTML is expected.
A unit test runs that script string against a fake browser to prove it
agrees with the TypeScript `resolveTheme()` function.

**4. `useSyncExternalStore`.**
React's official hook for reading state that lives outside React
(`localStorage` here). You give it `subscribe`, `getSnapshot`, and a server
snapshot. It avoids the common bug of reading `localStorage` in `useState`'s
initializer, which crashes on the server or causes hydration mismatches.

**5. Springs instead of durations.**
A duration-based animation ("300ms, ease-out") restarts from zero velocity
when interrupted, which looks robotic. A spring simulates physics: it has
position *and velocity*, so an interrupted animation keeps its momentum.
That's the core of the iOS feel. Motion describes springs with
`visualDuration` (how long until it looks settled) and `bounce`.
For plain CSS transitions we approximate a spring with the `linear()` easing
function (a list of points that overshoots 1 and settles back).

**6. Reduced motion is an accessibility requirement.**
Some people get motion sickness from animation. Two layers handle it:
`<MotionConfig reducedMotion="user">` makes every Motion animation drop
movement (keeping fades), and a `@media (prefers-reduced-motion: reduce)` CSS
rule makes CSS transitions instant. One gotcha: Motion only disables
*transform* animations. Animating `left` would still move, which is why the
spring demo uses `layout` (a transform under the hood) instead.

**7. Layout animations and `layoutId`.**
`<motion.div layout>` measures where an element was and where it is after a
re-render, then animates between them with a transform (the FLIP technique:
First, Last, Invert, Play). `layoutId` does the same across *different*
elements with the same id: the segmented control's sliding thumb. This is
what will make the schedule reflow smoothly in Phase 6.

**8. Server Components vs Client Components.**
In the App Router everything is a Server Component unless the file starts
with `"use client"`. Server Components ship no JS to the browser. We only mark
things as client when they need state, effects or browser APIs (animations,
the theme, the sheet). `app/design/page.tsx` stays a server component and
imports the client `DesignShowcase`.

**9. Tests that enforce design rules.**
Rules from the brief became tests so they can't silently regress:
- every motion preset is a spring (no linear easing),
- the CSS and TypeScript task colors match,
- text on every tinted task block passes WCAG AA contrast (4.5:1) in both
  themes. The test implements the WCAG luminance formula and `color-mix`.

**10. A real bug we hit: `tailwind-merge` and custom tokens.**
`cn()` uses `tailwind-merge` to let later classes override earlier ones. It
didn't know `text-headline` is a font *size*, assumed it was a text *color*,
and deleted `text-on-tint`, so the primary button had black text. We caught it
by screenshotting the page, fixed it with `extendTailwindMerge`, and added a
regression test. Lesson: tooling that "understands" your classes needs to be
told about your custom ones.

### Interview questions

**Q1. How does your app support dark mode, and how do you avoid the white
flash on load?**
Colors are CSS variables named by role (`--surface`, `--label`). Light values
live on `:root`, dark values on `[data-theme="dark"]`, and Tailwind classes
reference the variables, so no component knows which theme is active. The
preference (system/light/dark) is stored in `localStorage`. Because the server
can't read it, a small inline script in `<head>` resolves the theme and sets
`data-theme` before the first paint. React reads the same preference through
`useSyncExternalStore` and listens for OS theme changes when set to "system".

**Q2. Why use spring animations instead of CSS easing curves?**
Springs are physically based: they carry velocity. If a user interrupts an
animation (flicks a sheet, taps twice), a spring continues smoothly from its
current speed, while a duration-based animation restarts from rest and looks
mechanical. Springs also don't need a fixed duration, so the same preset feels
right for short and long distances. We centralize five presets so the whole
app feels consistent, honor Reduce Motion globally with `MotionConfig`, and a
unit test enforces that every preset is a spring.

**Q3. How do you make sure your color palette is accessible?**
Each task block's background is the task color mixed 16% into the surface
color. A unit test reproduces that `color-mix`, computes WCAG relative
luminance, and asserts the contrast ratio between the label color and every
block background is at least 4.5:1 (WCAG AA) in light and dark mode. Another
test parses `globals.css` to make sure the CSS and TypeScript copies of the
palette never drift apart. Secondary text uses translucent label colors so it
adapts to any background.

### Glossary

- **Token**: a named design value (color, size, radius, spring).
- **Semantic color**: a token named by purpose (`danger`) rather than hue (`red`).
- **FOUC**: flash of unstyled (or wrongly themed) content.
- **Hydration**: React attaching interactivity to server-rendered HTML.
- **FLIP**: First, Last, Invert, Play; the trick behind layout animations.
- **WCAG AA**: accessibility standard; 4.5:1 contrast for body text.
- **Safe area**: the parts of an iPhone screen not covered by the notch or
  home indicator (`env(safe-area-inset-*)`).
