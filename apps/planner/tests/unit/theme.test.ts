import { describe, expect, it } from "vitest";
import { isThemePreference, resolveTheme, THEME_SCRIPT } from "@/lib/theme";

describe("theme", () => {
  it("resolves 'system' using the OS setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("an explicit choice beats the OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("rejects junk from localStorage", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("purple")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  // The inline script runs before React, so it must agree with resolveTheme().
  // We execute it against a fake browser for each case.
  it.each([
    ["dark", false, "dark"],
    ["light", true, "light"],
    [null, true, "dark"],
    [null, false, "light"],
    ["garbage", true, "dark"],
  ] as const)("pre-paint script: stored=%s osDark=%s → %s", (stored, osDark, expected) => {
    const html = { dataset: {} as Record<string, string> };
    const fakeWindow = { matchMedia: () => ({ matches: osDark }) };
    const fakeStorage = { getItem: () => stored };
    new Function("window", "document", "localStorage", THEME_SCRIPT)(
      fakeWindow,
      { documentElement: html },
      fakeStorage,
    );
    expect(html.dataset.theme).toBe(expected);
  });
});
