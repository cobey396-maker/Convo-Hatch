import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCK_TINT, SURFACES, TASK_COLORS, TASK_COLOR_NAMES } from "@/lib/design/tokens";

/**
 * These tests protect the design system from two classic mistakes:
 *   1. The CSS and the TypeScript copies of a color drift apart.
 *   2. Someone adds a pretty color that makes block text unreadable.
 */

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** Pull `--name: value;` declarations out of one CSS rule block. */
function varsIn(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector ${selector} not found in globals.css`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

describe("task colors stay in sync between CSS and TypeScript", () => {
  const light = varsIn(":root");
  const dark = varsIn('[data-theme="dark"]');

  it.each(TASK_COLOR_NAMES)("%s matches in light and dark", (name) => {
    expect(light[`task-${name}`]).toBe(TASK_COLORS[name].light);
    expect(dark[`task-${name}`]).toBe(TASK_COLORS[name].dark);
  });

  it("CSS defines no task colors that TypeScript doesn't know about", () => {
    const cssNames = Object.keys(light)
      .filter((k) => k.startsWith("task-"))
      .map((k) => k.slice("task-".length));
    expect(cssNames.sort()).toEqual([...TASK_COLOR_NAMES].sort());
  });
});

/* --- WCAG contrast math -------------------------------------------------
 * Contrast ratio = (L1 + 0.05) / (L2 + 0.05), where L is "relative
 * luminance" (how bright a color looks to the human eye, 0 = black, 1 =
 * white). WCAG AA requires at least 4.5 for normal text.
 * ---------------------------------------------------------------------- */
type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Same as CSS color-mix(in srgb, color P%, base). */
function mix(color: RGB, base: RGB, amount: number): RGB {
  return color.map((c, i) => Math.round(c * amount + base[i] * (1 - amount))) as RGB;
}

describe("block text is readable on every task color", () => {
  for (const mode of ["light", "dark"] as const) {
    it.each(TASK_COLOR_NAMES)(`%s in ${mode} mode passes WCAG AA (4.5:1)`, (name) => {
      const surface = hexToRgb(SURFACES[mode].surface);
      const background = mix(hexToRgb(TASK_COLORS[name][mode]), surface, BLOCK_TINT);
      const ratio = contrast(hexToRgb(SURFACES[mode].label), background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("the contrast helper agrees with known values", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  });
});
