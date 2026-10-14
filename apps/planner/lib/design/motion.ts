import type { Transition, Variants } from "motion/react";

/**
 * ANIMATION PRESETS
 * =================
 *
 * Why springs instead of durations + easing curves?
 *
 * A classic CSS animation says "go from A to B in 300ms along this curve".
 * If the user interrupts it halfway (taps again, flicks a sheet), the next
 * animation starts from a standstill, which looks robotic. A spring is
 * physics: it has a current position AND velocity. Interrupt it and the new
 * animation carries the existing momentum, which is exactly how iOS feels.
 *
 * Motion lets us describe a spring in two human-friendly numbers:
 *   - visualDuration: roughly how long until it *looks* settled (seconds)
 *   - bounce: 0 = no overshoot, 0.5 = very springy
 *
 * Every animated component imports one of these presets instead of inventing
 * its own numbers. That keeps the whole app feeling consistent, and it is the
 * rule the brief asks for: no linear easing anywhere. A unit test
 * (tests/unit/motion.test.ts) enforces that every preset here is a spring.
 */
export const spring = {
  /** Taps, toggles, small UI feedback. Quick and crisp. */
  snappy: { type: "spring", visualDuration: 0.2, bounce: 0.15 },
  /** Default for elements moving on screen: cards, list items, page content. */
  smooth: { type: "spring", visualDuration: 0.35, bounce: 0.1 },
  /** Playful moments: the completion checkmark, streak flame, points badge. */
  bouncy: { type: "spring", visualDuration: 0.45, bounce: 0.4 },
  /** Bottom sheets and full-screen transitions. Mirrors iOS sheet physics. */
  sheet: { type: "spring", visualDuration: 0.4, bounce: 0.05 },
  /** Blocks reflowing in the schedule after a drag (Phase 6). */
  reflow: { type: "spring", visualDuration: 0.3, bounce: 0.12 },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof spring;

/** Used instead of any spring when the user has Reduce Motion turned on. */
export const instant: Transition = { duration: 0 };

/**
 * Pick the right transition for the user's accessibility setting.
 *
 *   const reduce = useReducedMotion();
 *   <motion.div transition={transitionFor("bouncy", reduce)} />
 *
 * Note: <MotionConfig reducedMotion="user"> (in components/providers.tsx)
 * already disables movement globally; this helper is for cases where we want
 * to skip even opacity fades, like the confetti on a streak milestone.
 */
export function transitionFor(name: SpringName, reduceMotion: boolean | null): Transition {
  return reduceMotion ? instant : spring[name];
}

/* ---------------------------------------------------------------------------
 * VARIANTS: named animation states that components switch between.
 * `initial` → `animate` on mount, `exit` on unmount (inside <AnimatePresence>).
 * ------------------------------------------------------------------------- */

/** Content that slides up slightly as it fades in: cards, sections. */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: spring.smooth },
  exit: { opacity: 0, y: -8, transition: spring.snappy },
};

/** Things that "pop" into place: badges, toasts, the empty-state icon. */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: spring.bouncy },
  exit: { opacity: 0, scale: 0.96, transition: spring.snappy },
};

/** Put on a list container: its children animate in one after another. */
export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

/** How far a pressed button shrinks. Subtle is better: 0.97, not 0.9. */
export const PRESS_SCALE = 0.97;
