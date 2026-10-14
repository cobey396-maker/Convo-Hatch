"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/design/motion";

/**
 * iOS segmented control (e.g. "Day | Week", "System | Light | Dark").
 *
 * The white "thumb" behind the selected option is a single motion.div with a
 * shared `layoutId`. When the selection changes, React renders the thumb
 * inside a different button; Motion notices the same layoutId moved and
 * animates it there on a spring instead of teleporting. This is called a
 * "shared layout animation".
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  // Unique per instance, so two controls on one page don't share a thumb.
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid rounded-[10px] bg-fill p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className="relative h-8 rounded-lg text-subhead font-medium"
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-lg bg-surface shadow-card dark:bg-[#636366]"
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
