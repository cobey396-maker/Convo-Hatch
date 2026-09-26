import { industries } from "@/content/site";
import { Icon } from "./Icon";
import { Container, SectionHeading } from "./ui";

export function Industries() {
  const { featured } = industries;
  return (
    <section id="industries" aria-labelledby="industries-heading" className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          id="industries-heading"
          eyebrow={industries.eyebrow}
          heading={industries.heading}
          intro={industries.intro}
        />

        <div className="on-dark mt-12 grid gap-8 rounded-3xl bg-petrol p-6 text-white sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky text-petrol">
                <Icon name={featured.icon} />
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-sky">
                Our starting focus
              </span>
            </div>
            <h3 className="mt-5 text-2xl sm:text-3xl">{featured.title}</h3>
            <p className="mt-3 max-w-xl text-white/85">{featured.body}</p>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-sky uppercase">Questions it can handle</p>
            <ul className="mt-3 space-y-2.5">
              {featured.examples.map((example) => (
                <li key={example} className="rounded-2xl bg-white/10 px-4 py-3 text-white">
                  {example}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {industries.others.map((item) => (
            <li key={item.title} className="rounded-3xl bg-white p-6 shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ice text-ocean">
                <Icon name={item.icon} />
              </span>
              <h3 className="mt-4 text-lg text-petrol">{item.title}</h3>
              <p className="mt-1.5 text-petrol-soft">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
