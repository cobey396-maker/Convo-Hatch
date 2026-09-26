import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

type ButtonVariant = "primary" | "secondary" | "onDark";

const BUTTON_BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ocean text-white shadow-card hover:bg-ocean-dark",
  secondary: "bg-white text-ocean ring-1 ring-line ring-inset hover:ring-ocean",
  onDark: "bg-sky text-petrol hover:bg-white",
};

export function buttonClasses(variant: ButtonVariant = "primary", extra = "") {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${extra}`;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-ocean uppercase">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky" />
      {children}
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  heading,
  intro,
  align = "left",
}: {
  id: string;
  eyebrow: string;
  heading: string;
  intro?: string;
  align?: "left" | "center";
}) {
  const alignment = align === "center" ? "mx-auto text-center" : "";
  return (
    <div className={`max-w-2xl ${alignment}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-3xl text-petrol sm:text-4xl">
        {heading}
      </h2>
      {intro ? <p className="mt-4 text-lg text-petrol-soft">{intro}</p> : null}
    </div>
  );
}
