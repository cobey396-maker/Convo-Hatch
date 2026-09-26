import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { Benefits } from "@/components/Benefits";
import { HowItWorks } from "@/components/HowItWorks";
import { DemoSection } from "@/components/DemoSection";
import { Industries } from "@/components/Industries";
import { Faq } from "@/components/Faq";
import { DemoRequest } from "@/components/DemoRequest";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteAssistant } from "@/components/SiteAssistant";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Benefits />
        <HowItWorks />
        <DemoSection />
        <Industries />
        <Faq />
        <DemoRequest />
      </main>
      <SiteFooter />
      <SiteAssistant />
    </>
  );
}
