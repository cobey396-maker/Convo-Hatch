import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/ChatWidget";
import { isWidgetAiConfigured } from "@/lib/ai";
import { getActiveClient } from "@/lib/clients";
import { toPublicView } from "@/lib/config";
import { getDb, isDatabaseConfigured } from "@/lib/db";

// The chat panel shown inside the iframe that public/widget.js adds to a client's website, or
// framed directly in a page section with ?layout=inline.
// Which sites may frame it is set per client in middleware.ts.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ layout?: string | string[] }>;
}) {
  const { publicId } = await params;
  // ?layout=inline: framed directly inside a page section (no loader, no close button).
  const inline = (await searchParams).layout === "inline";

  if (!isDatabaseConfigured()) {
    return (
      <main className="grid h-dvh place-items-center bg-white p-6 text-center text-gray-800">
        <p>The chat is unavailable right now.</p>
      </main>
    );
  }

  const client = await getActiveClient(await getDb(), publicId);
  if (!client) notFound();

  return <ChatWidget client={toPublicView(client)} aiAvailable={isWidgetAiConfigured()} inline={inline} />;
}
