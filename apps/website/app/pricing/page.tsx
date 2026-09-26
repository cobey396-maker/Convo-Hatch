import type { Metadata } from "next";
import Link from "next/link";
import { pricing, site } from "@/content/site";
import { Faq } from "@/components/Faq";
import { Icon } from "@/components/Icon";
import { SiteAssistant } from "@/components/SiteAssistant";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Container, Eyebrow, buttonClasses } from "@/components/ui";

export const metadata: Metadata = {
  title: `Pricing | ${site.name}`,
  description: pricing.intro,
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="pricing-heading" className="relative overflow-hidden py-14 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-sky/25 blur-3xl"
          />
          <Container className="relative">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>{pricing.eyebrow}</Eyebrow>
              <h1 id="pricing-heading" className="text-4xl text-petrol sm:text-5xl">
                {pricing.heading}
              </h1>
              <p className="mt-4 text-lg text-petrol-soft sm:text-xl sm:leading-relaxed">{pricing.intro}</p>
            </div>

            <ul className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
              {pricing.plans.map((plan, index) => (
                <li
                  key={plan.id}
                  className="flex flex-col rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8"
                >
                  <h2 id={`plan-${plan.id}`} className="text-sm font-semibold tracking-wide text-ocean uppercase">
                    {plan.name}
                  </h2>
                  <p className="mt-3 font-display text-petrol">
                    <span className="sr-only">{plan.priceLabel}</span>
                    <span aria-hidden="true">
                      <span className="text-4xl font-bold tracking-[-0.02em] sm:text-5xl">{plan.price}</span>
                      {plan.period ? <span className="ml-1 text-lg font-semibold text-petrol-soft">{plan.period}</span> : null}
                    </span>
                  </p>
                  {plan.setup ? <p className="mt-1 font-medium text-petrol">{plan.setup}</p> : null}
                  <p className="mt-4 text-petrol-soft">{plan.description}</p>

                  <h3 className="mt-6 text-base font-semibold text-petrol">{plan.listHeading}</h3>
                  <ul className="mt-3 space-y-3">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        {plan.id === "core" ? (
                          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-soft text-ocean">
                            <Icon name="check" className="h-4 w-4" />
                          </span>
                        ) : (
                          // Scope options, not included features, so no checkmark.
                          <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-ocean" />
                          </span>
                        )}
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-8">
                    <p className="flex gap-3 rounded-2xl bg-ice p-4 text-sm text-petrol">
                      <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-ocean" />
                      <span>{plan.note}</span>
                    </p>
                    <Link
                      href={plan.cta.href}
                      className={buttonClasses(index === 0 ? "primary" : "secondary", "mt-6 w-full")}
                    >
                      {plan.cta.label}
                      <Icon name="arrow" className="h-5 w-5" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="covers-heading" className="pb-20 sm:pb-24">
          <Container>
            <div className="mx-auto max-w-5xl">
              <h2 id="covers-heading" className="text-2xl text-petrol sm:text-3xl">
                {pricing.covers.heading}
              </h2>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {pricing.covers.items.map((item) => (
                  <li key={item.title} className="rounded-3xl border border-line bg-white/60 p-6 sm:p-8">
                    <h3 className="text-xl text-petrol">{item.title}</h3>
                    <p className="mt-2 text-petrol-soft">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        <Faq id="pricing-faq" content={pricing.faq} />
      </main>
      <SiteFooter />
      <SiteAssistant />
    </>
  );
}
