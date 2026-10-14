import type { Metadata } from "next";
import { DesignShowcase } from "./design-showcase";

export const metadata: Metadata = { title: "Design System" };

// The page itself is a Server Component; the interactive showcase is a
// Client Component imported into it. That split is the App Router pattern:
// render on the server by default, opt into the browser only where needed.
export default function DesignPage() {
  return <DesignShowcase />;
}
