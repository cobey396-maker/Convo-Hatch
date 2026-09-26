"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { nav } from "@/content/site";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { Container, buttonClasses } from "./ui";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close(true);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) close(false);
    }
    // Close if the viewport grows past the mobile breakpoint.
    const desktop = window.matchMedia("(min-width: 1024px)");
    function onBreakpoint(event: MediaQueryListEvent) {
      if (event.matches) close(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open, close]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ice/90 backdrop-blur supports-[backdrop-filter]:bg-ice/80">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-ocean focus:shadow-card"
      >
        Skip to content
      </a>
      <Container className="flex h-18 items-center justify-between gap-4">
        <Link href="/#top" className="rounded-md" aria-label="ConvoHatch, back to top">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1 lg:gap-2">
            {nav.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-3 py-2 font-medium whitespace-nowrap text-petrol transition-colors hover:bg-white hover:text-ocean"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {/* Wrapper controls visibility so it doesn't fight the button's own display class. */}
          <div className="hidden sm:block">
            <a href={nav.cta.href} className={buttonClasses("primary", "min-h-11 px-5 py-2.5 whitespace-nowrap")}>
              {nav.cta.label}
            </a>
          </div>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-petrol ring-1 ring-line ring-inset hover:bg-white lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </Container>

      <div
        ref={panelRef}
        id="mobile-menu"
        hidden={!open}
        className="border-t border-line bg-ice lg:hidden"
      >
        <Container className="py-4">
          <nav aria-label="Mobile">
            <ul className="flex flex-col gap-1">
              {nav.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => close(false)}
                    className="block rounded-xl px-3 py-3 text-lg font-medium text-petrol hover:bg-white hover:text-ocean"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <a
            href={nav.cta.href}
            onClick={() => close(false)}
            className={buttonClasses("primary", "mt-4 w-full")}
          >
            {nav.cta.label}
          </a>
        </Container>
      </div>
    </header>
  );
}
