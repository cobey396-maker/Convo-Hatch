"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ASSISTANT_GREETING,
  MAX_ASSISTANT_INPUT,
  SUGGESTED_QUESTIONS,
  containsPersonalDetails,
  scriptedReply,
  type AssistantAction,
} from "@/lib/site-assistant/scripted";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

type Message = { id: number; from: "user" | "assistant"; text: string; action?: AssistantAction };
type Mode = "checking" | "ai" | "scripted";

const HIDDEN_TEXT = "Message hidden — please don’t share personal details here.";
const HISTORY_LIMIT = 16;

const ACTIONS: Record<AssistantAction, { label: string; href: string }> = {
  "request-demo": { label: "Go to the demo request form", href: "/#request-demo" },
  "try-demo": { label: "Try the sample chatbot", href: "/#demo" },
};

function greeting(): Message[] {
  return [{ id: 0, from: "assistant", text: ASSISTANT_GREETING }];
}

export function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("checking");
  const [messages, setMessages] = useState<Message[]>(greeting);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  // The live demo chat has its own input at the bottom; hide this launcher while it's on screen
  // so the two don't overlap (and visitors aren't shown two chats at once).
  const [demoChatVisible, setDemoChatVisible] = useState(false);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const titleId = useId();

  function close(returnFocus: boolean) {
    restoreFocus.current = returnFocus;
    setOpen(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/assistant", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { ai: false }))
      .then((data: { ai?: boolean }) => setMode(data.ai ? "ai" : "scripted"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMode("scripted");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const demoChat = document.getElementById("live-demo-chat");
    if (!demoChat || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setDemoChatVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(demoChat);
    return () => observer.disconnect();
  }, []);

  // Focus the input on open; return focus to the launcher once it's visible again after closing.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        restoreFocus.current = true;
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, waiting, open]);

  async function aiReply(history: Message[]): Promise<string | null> {
    // The greeting is UI only; the API conversation must start with the visitor.
    const turns = history
      .filter((message) => message.id !== 0)
      .slice(-HISTORY_LIMIT)
      .map((message) => ({ role: message.from, content: message.text }));
    while (turns.length > 0 && turns[0].role !== "user") turns.shift();

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: turns }),
      });
      if (response.status === 503) setMode("scripted");
      if (!response.ok) return null;
      const data = (await response.json()) as { reply?: string };
      return data.reply?.trim() || null;
    } catch {
      return null;
    }
  }

  async function ask(rawText: string) {
    const text = rawText.trim().slice(0, MAX_ASSISTANT_INPUT);
    if (!text || waiting) return;
    setDraft("");

    // Personal details are never displayed back or sent to the server.
    if (containsPersonalDetails(text)) {
      const reply = scriptedReply(text);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, from: "user", text: HIDDEN_TEXT },
        { id: nextId.current++, from: "assistant", text: reply.text, action: reply.action },
      ]);
      return;
    }

    const userMessage: Message = { id: nextId.current++, from: "user", text };
    const history = [...messages, userMessage];
    setMessages(history);
    setWaiting(true);

    const scripted = scriptedReply(text);
    const aiText = mode === "ai" ? await aiReply(history) : null;
    // Scripted replies are instant; a short pause keeps the conversation readable.
    if (!aiText) await new Promise((resolve) => setTimeout(resolve, 400));

    setMessages((current) => [
      ...current,
      aiText
        ? { id: nextId.current++, from: "assistant", text: aiText }
        : { id: nextId.current++, from: "assistant", text: scripted.text, action: scripted.action },
    ]);
    setWaiting(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  const showSuggestions = messages.length === 1;

  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open ? (
        <section
          id="site-assistant"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="animate-rise flex h-[min(34rem,calc(100dvh-6rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift"
        >
          <header className="flex items-center justify-between gap-3 bg-petrol px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
                <LogoMark tone="dark" className="h-6 w-6" />
              </span>
              <div className="min-w-0 leading-tight">
                <h2 id={titleId} className="truncate font-sans text-base font-semibold tracking-normal">
                  ConvoHatch assistant
                </h2>
                <p className="text-sm text-sky">Answers from our site</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => close(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-sky"
            >
              <Icon name="x" className="h-5 w-5" />
              <span className="sr-only">Close assistant</span>
            </button>
          </header>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with the ConvoHatch assistant"
            tabIndex={0}
            className="flex-1 space-y-3 overflow-y-auto bg-ice/60 px-4 py-4"
          >
            {messages.map((message) =>
              message.from === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ocean px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-line text-white">
                    <span className="sr-only">You: </span>
                    {message.text}
                  </p>
                </div>
              ) : (
                <div key={message.id} className="flex flex-col items-start gap-2">
                  <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-line text-petrol ring-1 ring-line">
                    <span className="sr-only">Assistant: </span>
                    {message.text}
                  </p>
                  {message.action ? (
                    <a
                      href={ACTIONS[message.action].href}
                      onClick={() => close(false)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sky-soft px-3.5 py-2 text-sm font-semibold text-petrol ring-1 ring-sky ring-inset hover:bg-sky"
                    >
                      {ACTIONS[message.action].label}
                      <Icon name="arrow" className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              ),
            )}
            {waiting ? (
              <div className="flex justify-start" aria-hidden="true">
                <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 ring-1 ring-line">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="animate-typing h-2 w-2 rounded-full bg-ocean"
                      style={{ animationDelay: `${dot * 150}ms` }}
                    />
                  ))}
                </span>
              </div>
            ) : null}
          </div>

          <div className="border-t border-line bg-white px-4 pt-3 pb-4">
            {showSuggestions ? (
              <div role="group" aria-label="Suggested questions" className="flex flex-wrap gap-2 pb-3">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={waiting}
                    onClick={() => void ask(question)}
                    className="rounded-full bg-sky-soft px-3 py-1.5 text-left text-sm font-semibold text-petrol ring-1 ring-sky ring-inset transition-colors hover:bg-sky disabled:opacity-60"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <label htmlFor="site-assistant-input" className="sr-only">
                Ask a question about ConvoHatch
              </label>
              <input
                ref={inputRef}
                id="site-assistant-input"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_ASSISTANT_INPUT}
                autoComplete="off"
                placeholder="Ask about ConvoHatch"
                aria-describedby="site-assistant-hint"
                className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-ice/60 px-4 text-base text-petrol placeholder:text-petrol-soft focus:border-ocean"
              />
              <button
                type="submit"
                disabled={waiting || !draft.trim() || mode === "checking"}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-white hover:bg-ocean-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="send" className="h-5 w-5" />
                <span className="sr-only">Send</span>
              </button>
            </form>
            <p id="site-assistant-hint" className="mt-2 text-sm text-petrol-soft">
              Please don’t share personal details. To reach us, use the{" "}
              <Link href="/#request-demo" onClick={() => close(false)} className="font-semibold text-ocean underline">
                demo request form
              </Link>
              .
            </p>
          </div>
        </section>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls="site-assistant"
        onClick={() => setOpen((value) => !value)}
        className={`items-center gap-2 rounded-full bg-petrol p-2.5 font-semibold text-white shadow-lift transition-colors hover:bg-ocean sm:py-2.5 sm:pr-5 sm:pl-3 ${
          open || demoChatVisible ? "hidden" : "inline-flex"
        }`}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
          <LogoMark tone="dark" className="h-5 w-5" />
        </span>
        <span className="sr-only sm:not-sr-only">Questions? Ask us</span>
      </button>
    </div>
  );
}
