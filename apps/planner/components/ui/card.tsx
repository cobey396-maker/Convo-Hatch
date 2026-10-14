import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A rounded white (or dark gray) surface with a soft shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card bg-surface p-4 shadow-card", className)} {...props} />
  );
}

/**
 * iOS "inset grouped" list: rows inside one rounded card, separated by
 * hairlines that start after the icon, like the Settings app.
 */
export function ListGroup({
  header,
  footer,
  className,
  children,
}: {
  header?: string;
  footer?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      {header && (
        <h3 className="mb-1.5 px-4 text-footnote uppercase text-secondary-label">{header}</h3>
      )}
      <div className="overflow-hidden rounded-card bg-surface shadow-card [&>*+*]:border-t [&>*+*]:border-separator">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-secondary-label">{footer}</p>}
    </section>
  );
}

export function ListRow({
  icon,
  title,
  detail,
  trailing,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  detail?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3 px-4 py-2.5", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-body">{title}</div>
        {detail && <div className="truncate text-subhead text-secondary-label">{detail}</div>}
      </div>
      {trailing}
    </div>
  );
}
