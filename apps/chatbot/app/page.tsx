// This app mainly serves the embeddable chat widget; the home page points visitors to the demo.

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">ConvoHatch chatbot service</h1>
      <p className="mt-3 text-gray-700">
        This service hosts the chat widget that ConvoHatch installs on client websites.
      </p>
      <p className="mt-6">
        <a href="/demo" className="inline-block rounded-lg bg-gray-900 px-4 py-2.5 font-semibold text-white">
          Try the demo on a fictional HVAC contractor’s website
        </a>
      </p>
    </main>
  );
}
