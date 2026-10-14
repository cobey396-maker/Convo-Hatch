import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know about our custom type scale. Without this it
 * sees `text-headline` and `text-on-tint`, assumes both are text COLORS, and
 * throws away whichever came first, so a button would lose its white text.
 * Telling it these names are font SIZES makes it keep both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "large-title",
        "title1",
        "title2",
        "title3",
        "headline",
        "body",
        "callout",
        "subhead",
        "footnote",
        "caption",
      ],
    },
  },
});

/**
 * Combine class names, letting later Tailwind classes override earlier ones.
 *
 *   cn("px-4 py-2", isBig && "px-6")  →  "py-2 px-6"
 *
 * clsx handles the conditionals (false/undefined are dropped); twMerge knows
 * that px-6 and px-4 conflict and keeps only the last one. Components use this
 * so callers can pass a `className` that safely overrides the defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
