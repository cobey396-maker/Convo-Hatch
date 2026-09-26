import { hero } from "@/content/site";
import { ChatPreview } from "./ChatPreview";
import { Icon } from "./Icon";
import { Container, buttonClasses } from "./ui";

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-sky/25 blur-3xl"
      />
      <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-24">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-petrol ring-1 ring-line">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sky" />
            {hero.eyebrow}
          </p>
          <h1
            id="hero-heading"
            className="text-[2.5rem] leading-[1.05] font-bold tracking-[-0.03em] text-petrol sm:text-5xl lg:text-[3.75rem]"
          >
            {hero.headline}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-petrol-soft sm:text-xl sm:leading-relaxed">{hero.body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={hero.primaryCta.href} className={buttonClasses("primary")}>
              {hero.primaryCta.label}
              <Icon name="arrow" className="h-5 w-5" />
            </a>
            <a href={hero.secondaryCta.href} className={buttonClasses("secondary")}>
              {hero.secondaryCta.label}
            </a>
          </div>
          <p className="mt-6 max-w-md text-sm text-petrol-soft">{hero.note}</p>
        </div>
        <ChatPreview />
      </Container>
    </section>
  );
}
