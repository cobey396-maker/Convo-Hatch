"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

/**
 * iOS-style bottom sheet, built on Vaul.
 *
 * Vaul does the hard parts: drag-to-dismiss that follows your finger,
 * velocity detection (a quick flick closes it even if you only dragged a
 * little), snapping back if you let go early, focus trapping and Escape to
 * close for keyboard users. It animates with Apple's own sheet curve.
 *
 * `shouldScaleBackground` shrinks the page behind the sheet a little, like
 * iOS does. That needs the [vaul-drawer-wrapper] element in app/layout.tsx.
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          // With no description, tell Radix (under Vaul) not to point
          // aria-describedby at an element that doesn't exist.
          {...(!description && { "aria-describedby": undefined })}
          className={cn(
            "pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col",
            "rounded-t-sheet bg-surface-elevated shadow-float outline-none",
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-9 shrink-0 rounded-full bg-tertiary-label" />
          <div className="px-5 pb-2 pt-3">
            <Drawer.Title className="text-title3">{title}</Drawer.Title>
            {description && (
              <Drawer.Description className="mt-0.5 text-subhead text-secondary-label">
                {description}
              </Drawer.Description>
            )}
          </div>
          <div className="overflow-y-auto px-5 pb-6">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
