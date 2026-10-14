"use client";

import { CalendarDays, CalendarRange, Flame, Settings, Users, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/design/motion";

export type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The app's five main sections. Routes are built in Phases 4, 8, 9, 10. */
export const APP_TABS: TabItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/week", label: "Week", icon: CalendarRange },
  { href: "/streaks", label: "Streaks", icon: Flame },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Frosted-glass tab bar pinned to the bottom of the screen.
 *
 * - `glass` (globals.css) = translucent background + backdrop blur, so the
 *   schedule scrolling underneath shows through, blurred.
 * - `pb-safe` adds padding for the iPhone home indicator.
 * - The active tab is tinted; tapping an icon gives a tiny spring "pop".
 *
 * `fixed={false}` renders it inline, which the /design preview uses.
 */
export function TabBar({
  items = APP_TABS,
  activeHref,
  onSelect,
  fixed = true,
}: {
  items?: TabItem[];
  activeHref?: string;
  onSelect?: (href: string) => void;
  fixed?: boolean;
}) {
  const pathname = usePathname();
  const current = activeHref ?? pathname;

  return (
    <nav
      aria-label="Main"
      className={cn(
        "glass pb-safe z-30 border-t border-glass-border",
        fixed && "fixed inset-x-0 bottom-0",
      )}
    >
      <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = current === href || current.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                // In preview mode the hrefs are only labels; don't prefetch them.
                prefetch={onSelect ? false : undefined}
                aria-current={active ? "page" : undefined}
                onClick={
                  onSelect
                    ? (e) => {
                        e.preventDefault();
                        onSelect(href);
                      }
                    : undefined
                }
                className={cn(
                  "flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-tint" : "text-secondary-label",
                )}
              >
                <motion.span whileTap={{ scale: 0.85 }} transition={spring.snappy}>
                  <Icon aria-hidden size={24} strokeWidth={active ? 2.4 : 1.9} />
                </motion.span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
