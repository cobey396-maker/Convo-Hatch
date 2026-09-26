import { demoRequest } from "@/content/site";
import { DemoRequestForm } from "./DemoRequestForm";
import { Icon } from "./Icon";
import { Container } from "./ui";

export function DemoRequest() {
  return (
    <section id="request-demo" aria-labelledby="request-heading" className="on-dark bg-petrol py-20 text-white sm:py-24">
      <Container className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-sky uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky" />
            {demoRequest.eyebrow}
          </p>
          <h2 id="request-heading" className="text-3xl sm:text-4xl">
            {demoRequest.heading}
          </h2>
          <p className="mt-4 text-lg text-white/85">{demoRequest.intro}</p>
          <ul className="mt-8 space-y-3">
            {demoRequest.points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky text-petrol">
                  <Icon name="check" className="h-4 w-4" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-white/85">
            Prefer to talk it through?{" "}
            <a href="/schedule" className="font-semibold text-sky underline underline-offset-4 hover:text-white">
              Schedule a free 30-minute call
            </a>
            .
          </p>
        </div>
        {/* The form sits on a white card, so reset focus rings to the light-background style. */}
        <div className="[&_:focus-visible]:outline-ocean">
          <DemoRequestForm />
        </div>
      </Container>
    </section>
  );
}
