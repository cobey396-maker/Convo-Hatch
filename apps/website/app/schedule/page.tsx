import type { Metadata } from "next";
import { schedule, site } from "@/content/site";
import { BookingCalendar } from "@/components/BookingCalendar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteAssistant } from "@/components/SiteAssistant";
import { Container, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: `Schedule a Call | ${site.name}`,
  description: schedule.intro,
};

export default function SchedulePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="schedule-heading" className="py-14 sm:py-20">
          <Container>
            <div className="max-w-2xl">
              <Eyebrow>{schedule.eyebrow}</Eyebrow>
              <h1 id="schedule-heading" className="text-4xl text-petrol sm:text-5xl">
                {schedule.heading}
              </h1>
              <p className="mt-4 text-lg text-petrol-soft">{schedule.intro}</p>
            </div>
            <div className="mt-10 [&_:focus-visible]:outline-ocean">
              <BookingCalendar />
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
      <SiteAssistant />
    </>
  );
}
