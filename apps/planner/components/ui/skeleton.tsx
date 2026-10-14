import { cn } from "@/lib/cn";

/**
 * Loading placeholder. A gray shape the size of the real content, with a
 * light band sweeping across it. Skeletons beat spinners because the layout
 * doesn't jump when data arrives, and the screen feels faster.
 *
 * aria-hidden: screen readers should hear the "Loading…" status on the
 * container, not a pile of empty boxes.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-xl bg-fill",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:bg-linear-to-r after:from-transparent after:via-white/25 after:to-transparent",
        "after:animate-[shimmer_1.4s_infinite] dark:after:via-white/5",
        className,
      )}
    />
  );
}

/** Skeleton shaped like a list of schedule blocks, used by Today/Week. */
export function BlockListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-4 w-12 shrink-0" />
          <Skeleton className="h-16 flex-1 rounded-block" />
        </div>
      ))}
    </div>
  );
}
