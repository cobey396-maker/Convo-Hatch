import { demo } from "@/content/site";
import { ChatbotDemo } from "./ChatbotDemo";
import { Icon } from "./Icon";
import { Container, SectionHeading } from "./ui";

export function DemoSection() {
  return (
    <section id="demo" aria-labelledby="demo-heading" className="bg-white py-20 sm:py-24">
      <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div>
          <SectionHeading id="demo-heading" eyebrow={demo.eyebrow} heading={demo.heading} intro={demo.intro} />

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl bg-ice p-6">
              <h3 className="text-lg text-petrol">{demo.shows.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {demo.shows.items.map((item) => (
                  <li key={item} className="flex gap-3 text-petrol">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky text-petrol">
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-line p-6">
              <h3 className="text-lg text-petrol">{demo.wontDo.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {demo.wontDo.items.map((item) => (
                  <li key={item} className="flex gap-3 text-petrol-soft">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ice text-petrol-soft">
                      <Icon name="x" className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <ChatbotDemo />
      </Container>
    </section>
  );
}
