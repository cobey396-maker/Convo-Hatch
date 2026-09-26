import { howItWorks } from "@/content/site";
import { Icon } from "./Icon";
import { Container, SectionHeading } from "./ui";

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="py-20 sm:py-24">
      <Container>
        <SectionHeading id="how-heading" eyebrow={howItWorks.eyebrow} heading={howItWorks.heading} />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-full bg-petrol font-display text-lg font-bold text-sky"
              >
                {index + 1}
              </span>
              <h3 className="mt-5 text-xl text-petrol">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-petrol-soft">{step.body}</p>
            </li>
          ))}
        </ol>
        <aside
          aria-labelledby="booking-note-heading"
          className="mt-8 flex gap-4 rounded-3xl border border-sky bg-sky-soft p-6 sm:p-8"
        >
          <Icon name="info" className="mt-1 h-6 w-6 shrink-0 text-petrol" />
          <div>
            <h3 id="booking-note-heading" className="text-lg text-petrol">
              {howItWorks.bookingNote.title}
            </h3>
            <p className="mt-1 text-petrol">{howItWorks.bookingNote.body}</p>
          </div>
        </aside>
      </Container>
    </section>
  );
}
