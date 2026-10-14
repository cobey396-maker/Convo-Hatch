import { describe, expect, it } from "vitest";
import { instant, spring, transitionFor } from "@/lib/design/motion";

describe("animation presets", () => {
  // The brief's rule "no linear easing" becomes a test, so it can't regress.
  it.each(Object.entries(spring))("%s is a spring", (_name, t) => {
    expect(t.type).toBe("spring");
    expect(t).not.toHaveProperty("ease");
  });

  it("springs settle within half a second so the UI never feels sluggish", () => {
    for (const t of Object.values(spring)) expect(t.visualDuration).toBeLessThanOrEqual(0.5);
  });

  it("uses the spring normally and an instant transition for Reduce Motion", () => {
    expect(transitionFor("bouncy", false)).toBe(spring.bouncy);
    expect(transitionFor("bouncy", null)).toBe(spring.bouncy); // unknown yet → animate
    expect(transitionFor("bouncy", true)).toBe(instant);
  });
});
