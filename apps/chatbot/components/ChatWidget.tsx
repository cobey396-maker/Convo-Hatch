"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { PublicClientView } from "@/lib/config";
import { post, tellHost } from "./api";
import { CallbackForm } from "./CallbackForm";

const MAX_MESSAGE = 500;

type Source = "ai" | "faq" | "rule" | "limit";
interface Message {
  id: number;
  from: "user" | "assistant";
  text: string;
  source?: Source;
  suggestCallback?: boolean;
}

interface Props {
  client: PublicClientView;
  aiAvailable: boolean;
}

export function ChatWidget({ client, aiAvailable: aiInitially }: Props) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "assistant", text: client.branding.greeting }]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(aiInitially);
  const [chatClosed, setChatClosed] = useState(false);
  const [view, setView] = useState<"chat" | "callback">("chat");
  const [notice, setNotice] = useState("");

  const conversationId = useRef<string | null>(null);
  const starting = useRef<Promise<string | null> | null>(null);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const callbackButtonRef = useRef<HTMLButtonElement>(null);

  // Tell the host page the widget loaded, with the branding its launcher button needs.
  useEffect(() => {
    tellHost({
      type: "ready",
      businessName: client.businessName,
      launcherLabel: client.branding.launcherLabel,
      color: client.branding.primaryColor,
      textColor: client.branding.textColor,
    });
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.data?.source !== "convohatch-loader") return;
      if (event.data.type === "open") {
        // The panel is visible now; move focus into it.
        setTimeout(() => {
          const target =
            document.querySelector<HTMLElement>("[data-autofocus]") ?? inputRef.current ?? callbackButtonRef.current;
          target?.focus();
        }, 30);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [client]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") tellHost({ type: "close" });
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, waiting, view]);

  const add = useCallback((message: Omit<Message, "id">) => {
    setMessages((current) => [...current, { ...message, id: nextId.current++ }]);
  }, []);

  /** Chats start on first use, so page views that never open the widget don't count against limits. */
  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId.current) return conversationId.current;
    starting.current ??= (async () => {
      const result = await post<{ conversationId: string }>("/api/widget/conversations", { publicId: client.publicId });
      starting.current = null;
      if (result?.status === 200 && result.data.conversationId) {
        conversationId.current = result.data.conversationId;
        return conversationId.current;
      }
      setNotice(result?.data.message ?? "The chat couldn’t connect. Please check your connection and try again.");
      return null;
    })();
    return starting.current;
  }, [client.publicId]);

  async function ask(raw: string) {
    const text = raw.trim().slice(0, MAX_MESSAGE);
    if (!text || waiting || chatClosed) return;
    setDraft("");
    setNotice("");
    add({ from: "user", text });
    setWaiting(true);

    const id = await ensureConversation();
    const result = id
      ? await post<{ reply: { text: string; source: Source; suggestCallback?: boolean }; aiAvailable: boolean; conversationClosed?: boolean }>(
          "/api/widget/messages",
          { publicId: client.publicId, conversationId: id, message: text },
        )
      : null;
    setWaiting(false);

    if (result?.status === 200) {
      add({ from: "assistant", ...result.data.reply });
      setAiAvailable(result.data.aiAvailable);
      if (result.data.conversationClosed) setChatClosed(true);
    } else if (id) {
      setNotice(result?.data.message ?? "That message didn’t go through. Please try again.");
    }
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function closeCallback(message?: string) {
    setView("chat");
    if (message) add({ from: "assistant", text: message, source: "rule" });
    setTimeout(() => callbackButtonRef.current?.focus(), 0);
  }

  const brand = {
    "--brand": client.branding.primaryColor,
    "--brand-text": client.branding.textColor,
  } as CSSProperties;
  const showStarters = messages.length === 1;
  const starters = [...client.faqs.slice(0, 2).map((faq) => faq.question), "Do you serve my ZIP code?", "What are your hours?"];

  return (
    <div style={brand} className="flex h-dvh flex-col bg-white font-sans text-gray-900">
      <header className="flex items-center gap-3 bg-[var(--brand)] px-4 py-3 text-[var(--brand-text)]">
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate font-sans text-base font-semibold tracking-normal">{client.businessName}</h1>
          <p className="text-sm opacity-90">AI assistant</p>
        </div>
        <button
          type="button"
          onClick={() => tellHost({ type: "close" })}
          aria-label="Close chat"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 focus-visible:outline-[var(--brand-text)]"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="space-y-1 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs leading-snug text-gray-700">
        <p>
          <strong className="font-semibold">Automated AI assistant.</strong> Answers come only from {client.businessName}’s approved
          information. It can’t book appointments or give repair advice.
        </p>
        {client.isDemo ? (
          <p className="font-semibold text-amber-900">Demo of a fictional business: requests are never sent to a contractor.</p>
        ) : null}
        {!aiAvailable ? (
          <p className="font-semibold text-gray-900">Live AI is unavailable: automatic answers from approved information only.</p>
        ) : null}
      </div>

      {view === "callback" ? (
        <CallbackForm client={client} ensureConversation={ensureConversation} onClose={closeCallback} />
      ) : (
        <>
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label={`Conversation with ${client.businessName}’s assistant`}
            tabIndex={0}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) =>
              message.from === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gray-800 px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-line text-white">
                    <span className="sr-only">You: </span>
                    {message.text}
                  </p>
                </div>
              ) : (
                <div key={message.id} className="flex flex-col items-start gap-1">
                  <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-line">
                    <span className="sr-only">Assistant: </span>
                    {message.text}
                  </p>
                  {message.source ? (
                    <span className="px-1 text-xs text-gray-600">{message.source === "ai" ? "AI-generated answer" : "Automatic reply"}</span>
                  ) : null}
                  {message.suggestCallback ? (
                    <button
                      type="button"
                      onClick={() => setView("callback")}
                      className="rounded-full border border-[var(--brand)] px-3 py-1 text-sm font-semibold text-gray-900"
                    >
                      Request a callback
                    </button>
                  ) : null}
                </div>
              ),
            )}
            {waiting ? (
              <p className="text-sm text-gray-600" aria-live="polite">
                Assistant is typing…
              </p>
            ) : null}
            {showStarters ? (
              <div className="flex flex-wrap gap-2 pt-1" aria-label="Suggested questions" role="group">
                {starters.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void ask(question)}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-900 hover:border-gray-500"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {notice ? (
            <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {notice}
            </p>
          ) : null}

          <div className="border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              ref={callbackButtonRef}
              type="button"
              onClick={() => setView("callback")}
              className="mb-2 w-full rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-text)]"
            >
              Request a callback
            </button>
            {chatClosed ? (
              <p className="text-sm text-gray-700">This chat has ended. You can still request a callback.</p>
            ) : (
              <form onSubmit={onSubmit} className="flex gap-2">
                <label htmlFor="widget-message" className="sr-only">
                  Type your question
                </label>
                <input
                  ref={inputRef}
                  id="widget-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={MAX_MESSAGE}
                  autoComplete="off"
                  placeholder="Type your question…"
                  className="min-w-0 flex-1 rounded-lg border border-gray-400 px-3 py-2 text-base"
                />
                <button
                  type="submit"
                  disabled={waiting || !draft.trim()}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            )}
            <p className="mt-2 text-center text-[0.7rem] text-gray-500">Please don’t share personal details in the chat.</p>
          </div>
        </>
      )}
    </div>
  );
}
