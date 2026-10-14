"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "@/components/providers";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/design/motion";
import type { ThemePreference } from "@/lib/theme";

/** Tap order: system → light → dark → system. */
const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const LABEL = { system: "System", light: "Light", dark: "Dark" } as const;

/**
 * One-tap theme switch for nav bars. Shows the CURRENT mode's icon; tapping
 * moves to the next one. The icon swap is animated: the old icon spins out
 * while the new one springs in (AnimatePresence handles the exit).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const Icon = ICON[preference];
  const next = NEXT[preference];

  return (
    <motion.button
      type="button"
      onClick={() => setPreference(next)}
      whileTap={{ scale: 0.88 }}
      transition={spring.snappy}
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[preference]}`}
      className={cn(
        "grid size-11 place-items-center rounded-full text-tint",
        "transition-colors duration-200 hover:bg-fill",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={preference}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={spring.bouncy}
        >
          <Icon aria-hidden size={22} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
