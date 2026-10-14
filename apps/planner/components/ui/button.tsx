"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { PRESS_SCALE, spring } from "@/lib/design/motion";

/**
 * iOS-style button.
 *
 * Variants follow Apple's button styles:
 *   filled  — solid tint color, white text. The main action on a screen.
 *   tinted  — light tint background, tint text. Secondary actions.
 *   plain   — text only. Toolbar and inline actions.
 *   danger  — destructive actions (delete, remove friend).
 *
 * It is a motion.button so pressing it shrinks it slightly on a spring
 * (whileTap), the tactile "squish" that makes iOS buttons feel physical.
 */
const variants = {
  filled: "bg-tint text-on-tint shadow-card",
  tinted: "bg-tint/12 text-tint",
  plain: "bg-transparent text-tint",
  danger: "bg-danger/12 text-danger",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-subhead font-semibold",
  md: "h-11 px-5 text-headline", // 44px tall: Apple's minimum tap target
  lg: "h-[52px] px-6 text-headline w-full",
} as const;

export type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", className, type = "button", disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: PRESS_SCALE }}
      transition={spring.snappy}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-button",
        "transition-opacity duration-200 disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
