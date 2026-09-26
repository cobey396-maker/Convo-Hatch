import Link from "next/link";
import { footer, site } from "@/content/site";
import { Logo } from "./Logo";
import { Container } from "./ui";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="on-dark bg-petrol text-white">
      <Container className="flex flex-col gap-10 py-14 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link href="/#top" className="inline-block rounded-md" aria-label="ConvoHatch, back to top">
            <Logo tone="dark" />
          </Link>
          <p className="mt-4 text-white/85">{site.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-3">
            {footer.sections.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="rounded-sm font-medium text-white/90 hover:text-sky">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-6 text-sm text-white/75">
          <p>
            © {year} {site.name}. Chat examples on this site are illustrations, and the demo company is fictional.
          </p>
        </Container>
      </div>
    </footer>
  );
}
