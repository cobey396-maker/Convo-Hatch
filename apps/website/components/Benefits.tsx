import { benefits } from "@/content/site";
import { Icon } from "./Icon";
import { Container, SectionHeading } from "./ui";

export function Benefits() {
  return (
    <section id="benefits" aria-labelledby="benefits-heading" className="bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          id="benefits-heading"
          eyebrow={benefits.eyebrow}
          heading={benefits.heading}
          intro={benefits.intro}
        />
        <ul className="mt-12 grid gap-5 sm:grid-cols-2">
          {benefits.items.map((item) => (
            <li
              key={item.title}
              className="rounded-3xl border border-line bg-ice/50 p-6 transition-shadow duration-300 hover:shadow-card sm:p-8"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky text-petrol">
                <Icon name={item.icon} />
              </span>
              <h3 className="mt-5 text-xl text-petrol">{item.title}</h3>
              <p className="mt-2 text-petrol-soft">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
