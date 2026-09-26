import { hero } from "@/content/site";
import { LogoMark } from "./Logo";
import { RequestSummary } from "./RequestSummary";

export function ChatPreview() {
  const { preview } = hero;
  return (
    <figure className="relative mx-auto w-full max-w-md">
      <figcaption className="mb-3 flex items-center justify-between text-sm font-medium text-petrol-soft">
        <span className="rounded-full bg-white px-3 py-1 ring-1 ring-line">{preview.label}</span>
        <span>{preview.timestamp}</span>
      </figcaption>

      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
        <div className="flex items-center gap-3 bg-petrol px-5 py-4 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
            <LogoMark tone="dark" className="h-6 w-6" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold">{preview.company}</p>
            <p className="text-sm text-sky">Website assistant</p>
          </div>
        </div>

        <ol className="space-y-3 bg-ice/60 px-4 py-5 sm:px-5" aria-label="Example chat messages">
          {preview.messages.map((message, index) => {
            const fromVisitor = message.from === "visitor";
            return (
              <li
                key={index}
                className={`animate-rise flex ${fromVisitor ? "justify-end" : "justify-start"}`}
                style={{ animationDelay: `${150 + index * 180}ms` }}
              >
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed ${
                    fromVisitor
                      ? "rounded-br-md bg-ocean text-white"
                      : "rounded-bl-md bg-white text-petrol ring-1 ring-line"
                  }`}
                >
                  <span className="sr-only">{fromVisitor ? "Customer: " : "Assistant: "}</span>
                  {message.text}
                </p>
              </li>
            );
          })}
        </ol>

        <div
          className="animate-rise border-t border-line bg-ice/60 px-4 pb-5 sm:px-5"
          style={{ animationDelay: `${150 + preview.messages.length * 180}ms` }}
        >
          <p className="py-3 text-center text-xs font-semibold tracking-wide text-petrol-soft uppercase">
            Sent to your office
          </p>
          <RequestSummary title={preview.summary.title} rows={preview.summary.rows} note={preview.summary.note} />
        </div>
      </div>
    </figure>
  );
}
