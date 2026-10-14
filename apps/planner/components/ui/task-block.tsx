"use client";

import { Check, Lock, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/design/motion";
import type { TaskColor } from "@/lib/design/tokens";

/**
 * One colored block on the schedule.
 *
 *   kind="event" — a fixed event you entered (class, work). Lock icon:
 *                  the planner never moves these.
 *   kind="task"  — a work session the auto-planner placed for you.
 *                  Sparkle icon: "the app chose this time".
 *
 * The color comes from the `task-block` utility in globals.css, which reads
 * the CSS variable --block. We set --block inline to var(--task-<color>), so
 * the block automatically switches to the dark-mode shade too.
 *
 * `layout` tells Motion to animate this block to its new position whenever
 * the layout changes. That one prop is what makes the schedule "reflow"
 * smoothly after a drag in Phase 6.
 */
export function TaskBlock({
  title,
  timeLabel,
  color,
  kind = "task",
  completed = false,
  className,
  onClick,
}: {
  title: string;
  timeLabel: string;
  color: TaskColor;
  kind?: "task" | "event";
  completed?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const Icon = kind === "event" ? Lock : Sparkles;
  return (
    <motion.button
      type="button"
      layout
      transition={spring.reflow}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ "--block": `var(--task-${color})` } as CSSProperties}
      className={cn(
        "task-block flex w-full items-start gap-3 rounded-block py-3 pl-4 pr-3 text-left",
        completed && "opacity-60",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-headline", completed && "line-through")}>{title}</div>
        <div className="mt-0.5 flex items-center gap-1 text-footnote text-secondary-label">
          <Icon aria-hidden size={12} />
          <span>{timeLabel}</span>
          <span className="sr-only">{kind === "event" ? "(fixed event)" : "(auto-planned)"}</span>
        </div>
      </div>
      {completed && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring.bouncy}
          className="grid size-6 place-items-center rounded-full bg-success text-white"
        >
          <Check aria-label="Completed" size={14} strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}
