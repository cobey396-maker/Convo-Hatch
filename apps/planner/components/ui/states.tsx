"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { scaleIn } from "@/lib/design/motion";
import { Button } from "./button";

/**
 * Empty and error states. Every screen has one of each (brief requirement),
 * and they share a layout: big friendly icon, short title, one sentence,
 * one clear action. The copy should never blame the user.
 */
function StateLayout({
  icon,
  title,
  message,
  action,
  role,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  role?: "alert";
}) {
  return (
    <motion.div
      role={role}
      variants={scaleIn}
      initial="initial"
      animate="animate"
      className="flex flex-col items-center px-8 py-12 text-center"
    >
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-fill text-3xl">
        {icon}
      </div>
      <h2 className="text-title3">{title}</h2>
      <p className="mt-1 max-w-xs text-subhead text-secondary-label">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function EmptyState(props: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return <StateLayout {...props} />;
}

export function ErrorState({
  title = "Something went sideways",
  message = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <StateLayout
      role="alert"
      icon="🫠"
      title={title}
      message={message}
      action={
        onRetry && (
          <Button variant="tinted" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
