import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

/**
 * Temporary home page for Phase 1. In Phase 3 this becomes onboarding for
 * new visitors and a redirect to /today for signed-in users.
 */
export default function Home() {
  return (
    <main className="pt-safe relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="pt-safe absolute right-3 top-2">
        <ThemeToggle />
      </div>
      <div className="mb-6 grid size-16 place-items-center rounded-[18px] bg-tint text-3xl text-on-tint shadow-float">
        ✦
      </div>
      <h1 className="text-large-title">{APP_NAME}</h1>
      <p className="mt-2 text-body text-secondary-label">{APP_TAGLINE}</p>
      <Link
        href="/design"
        className="mt-8 inline-flex h-[52px] items-center justify-center rounded-button bg-tint text-headline text-on-tint shadow-card"
      >
        View the design system
      </Link>
      <p className="mt-3 text-center text-footnote text-tertiary-label">Phase 1 · Setup & design system</p>
    </main>
  );
}
