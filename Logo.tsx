export function LogoMark({ tone = "light", className = "h-8 w-8" }: { tone?: "light" | "dark"; className?: string }) {
  const bubble = tone === "light" ? "#123E48" : "#85D7EE";
  const crack = tone === "light" ? "#85D7EE" : "#123E48";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path
        d="M16 4C9.4 4 4 8.8 4 14.7c0 3.2 1.6 6.1 4.1 8L7.3 28l5.6-3c1 .2 2 .3 3.1.3 6.6 0 12-4.8 12-10.6C28 8.8 22.6 4 16 4Z"
        fill={bubble}
      />
      <path
        d="M9 15.6l2.6-2.6 2.6 2.6 2.6-2.6 2.6 2.6 2.6-2.6"
        fill="none"
        stroke={crack}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Wordmark. `tone="light"` is for light backgrounds; `tone="dark"` for petrol backgrounds. */
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark tone={tone} />
      <span
        className={`font-display text-[1.375rem] leading-none font-bold tracking-tight ${
          tone === "light" ? "text-petrol" : "text-white"
        }`}
      >
        Convo<span className={tone === "light" ? "text-ocean" : "text-sky"}>Hatch</span>
      </span>
    </span>
  );
}
