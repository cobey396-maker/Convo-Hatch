/**
 * Design tokens that JavaScript needs to know about.
 *
 * Most styling lives in app/globals.css and is used through Tailwind classes.
 * But some code needs the raw values: the color picker lists the task colors,
 * push notifications and the home-screen widget can't read CSS, and tests
 * check color contrast. Those values live here.
 *
 * TASK_COLORS must match the --task-* variables in globals.css; the unit test
 * tests/unit/tokens.test.ts parses the CSS and fails if they ever differ.
 */

export const TASK_COLORS = {
  blue: { light: "#007aff", dark: "#0a84ff", label: "Blue" },
  green: { light: "#34c759", dark: "#30d158", label: "Green" },
  indigo: { light: "#5856d6", dark: "#5e5ce6", label: "Indigo" },
  orange: { light: "#ff9500", dark: "#ff9f0a", label: "Orange" },
  pink: { light: "#ff2d55", dark: "#ff375f", label: "Pink" },
  purple: { light: "#af52de", dark: "#bf5af2", label: "Purple" },
  red: { light: "#ff3b30", dark: "#ff453a", label: "Red" },
  teal: { light: "#30b0c7", dark: "#40c8e0", label: "Teal" },
  yellow: { light: "#ffcc00", dark: "#ffd60a", label: "Yellow" },
} as const;

/** The union "blue" | "green" | ... derived from the object above, so adding
 * a color in one place updates the type everywhere. */
export type TaskColor = keyof typeof TASK_COLORS;

export const TASK_COLOR_NAMES = Object.keys(TASK_COLORS) as TaskColor[];

/** Page and text colors, used by the contrast test and by native code later. */
export const SURFACES = {
  light: { surface: "#ffffff", label: "#000000" },
  dark: { surface: "#1c1c1e", label: "#ffffff" },
} as const;

/** How strongly a task color tints a block's background (matches the 16% in
 * the `task-block` utility in globals.css). */
export const BLOCK_TINT = 0.16;

/** Spacing follows a 4-point grid (Tailwind's default: p-1 = 4px, p-4 = 16px).
 * These are the named steps we reach for most. */
export const SPACE = {
  gutter: 16, // horizontal page padding on phones
  gutterWide: 24, // on tablets and up
  stack: 12, // gap between cards in a list
  section: 32, // gap between sections
} as const;

/** Minimum touch target from Apple's Human Interface Guidelines. */
export const MIN_TAP = 44;
