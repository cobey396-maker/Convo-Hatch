import { faq } from "@/content/site";
import { Container, SectionHeading } from "./ui";

interface FaqContent {
  eyebrow: string;
  heading: string;
  items: readonly { question: string; answer: string }[];
}

export function Faq({ id = "faq", content = faq }: { id?: string; content?: FaqContent }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="bg-white py-20 sm:py-24">
      <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading id={`${id}-heading`} eyebrow={content.eyebrow} heading={content.heading} />
        <div className="divide-y divide-line border-y border-line">
          {content.items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-5 font-display text-lg font-semibold text-petrol [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ice text-ocean transition-transform duration-200 group-open:rotate-45"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="max-w-2xl pb-6 text-petrol-soft">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
