// This app only serves the embeddable chat widget. There is nothing for visitors here.

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">ConvoHatch chatbot service</h1>
      <p className="mt-3 text-gray-700">
        This service hosts the chat widget that ConvoHatch installs on client websites. See apps/chatbot/README.md for setup.
      </p>
    </main>
  );
}
