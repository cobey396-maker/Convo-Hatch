import { demo } from "@/content/site";

// The real ConvoHatch chatbot for the fictional demo company, framed from the chatbot app.
// It loads only when scrolled near, so the page itself stays fast.
export function LiveChatbotDemo() {
  return (
    <div className="flex flex-col gap-3">
      <div id="live-demo-chat" className="h-[40rem] max-h-[85vh] min-h-[32rem] overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
        <iframe
          src={demo.embedUrl}
          title="ConvoHatch demo chatbot for Cedar Hollow Heating & Air (fictional)"
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
      <p className="text-sm text-petrol-soft">
        {demo.tryThis}{" "}
        <a href={demo.fullDemoUrl} target="_blank" rel="noopener" className="font-semibold text-petrol underline">
          See it installed on a sample contractor website
        </a>
        .
      </p>
    </div>
  );
}
