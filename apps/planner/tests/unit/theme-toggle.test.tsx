// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// jsdom has no matchMedia; pretend the OS is in light mode.
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<ThemeToggle>", () => {
  it("cycles system → light → dark → system and applies it to <html>", () => {
    render(
      <Providers>
        <ThemeToggle />
      </Providers>,
    );
    const button = () => screen.getByRole("button");
    expect(button().getAttribute("aria-label")).toMatch(/^Theme: System/);

    fireEvent.click(button());
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(button());
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(button());
    expect(localStorage.getItem("theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light"); // OS is light
  });
});
