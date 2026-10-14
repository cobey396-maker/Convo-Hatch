import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
  it("lets later Tailwind classes win", () => {
    expect(cn("px-4 py-2", "px-6")).toBe("py-2 px-6");
    expect(cn("bg-tint", "bg-danger")).toBe("bg-danger");
  });
});

describe("cn with our custom type scale", () => {
  it("keeps a text color next to a custom text size", () => {
    // Regression: this used to return just "text-headline".
    expect(cn("text-on-tint", "text-headline")).toBe("text-on-tint text-headline");
  });
  it("still lets one custom size replace another", () => {
    expect(cn("text-body", "text-title3")).toBe("text-title3");
  });
});
