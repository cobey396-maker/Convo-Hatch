"use client";

import { motion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The iOS "large title" screen layout.
 *
 * At the top of the page you see a big bold title (34px) and a nav bar that
 * is fully transparent. As you scroll, the big title scrolls away under the
 * bar, and at the same moment:
 *   - a small centered title fades in inside the bar, and
 *   - the bar itself fades from transparent to frosted glass with a hairline.
 *
 * How: useScroll() gives us a live "motion value" for window.scrollY. Motion
 * values update outside React's render cycle, so scrolling never re-renders
 * the component; useTransform maps scroll position to opacity directly on
 * the GPU-friendly style property. That is what keeps it at 60/120fps.
 *
 * Pulling down past the top (iOS rubber-banding) slightly enlarges the
 * title, another small native detail.
 */
export function LargeTitlePage({
  title,
  subtitle,
  leading,
  trailing,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { scrollY } = useScroll();
  // scrollY 28→48px: the large title is now mostly hidden under the bar.
  const barOpacity = useTransform(scrollY, [28, 48], [0, 1]);
  const largeTitleScale = useTransform(scrollY, [-100, 0], [1.1, 1], { clamp: true });

  return (
    <div className={cn("min-h-dvh pb-28", className)}>
      <header className="pt-safe sticky top-0 z-30">
        <motion.div
          aria-hidden
          style={{ opacity: barOpacity }}
          className="glass absolute inset-0 border-b border-glass-border"
        />
        <div className="relative mx-auto grid h-11 max-w-2xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <div className="flex justify-start">{leading}</div>
          <motion.span style={{ opacity: barOpacity }} className="text-headline" aria-hidden>
            {title}
          </motion.span>
          <div className="flex justify-end">{trailing}</div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <motion.h1
          style={{ scale: largeTitleScale }}
          className="origin-left pb-1 pt-1 text-large-title"
        >
          {title}
        </motion.h1>
        {subtitle && <p className="text-subhead text-secondary-label">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
