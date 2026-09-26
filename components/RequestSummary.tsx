import { Icon } from "./Icon";

export interface SummaryRow {
  label: string;
  value: string;
}

/** Card that shows how a chat conversation turns into a clear request for the contractor. */
export function RequestSummary({
  title,
  badge,
  rows,
  note,
  noteTone = "ready",
}: {
  title: string;
  badge?: string;
  rows: readonly SummaryRow[];
  note: string;
  noteTone?: "ready" | "demo";
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-base font-semibold text-petrol">{title}</p>
        {badge ? (
          <span className="rounded-full bg-sky-soft px-2.5 py-0.5 text-xs font-semibold text-petrol">{badge}</span>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="font-medium text-petrol-soft">{row.label}</dt>
            <dd className="font-semibold text-petrol">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p
        className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
          noteTone === "ready" ? "bg-ice text-ocean" : "bg-sky-soft text-petrol"
        }`}
      >
        <Icon name={noteTone === "ready" ? "check" : "info"} className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{note}</span>
      </p>
    </div>
  );
}
