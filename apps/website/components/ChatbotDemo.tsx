"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEMO_COMPANY,
  GREETING,
  MAX_INPUT_LENGTH,
  choicesFor,
  handleAction,
  handleText,
  initialState,
  type BotReply,
  type BotState,
  type Choice,
  type RequestSummary as Summary,
  type Turn,
} from "@/lib/demo-bot";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { RequestSummary } from "./RequestSummary";

type Message =
  | { id: number; from: "user"; text: string; redacted: boolean }
  | { id: number; from: "bot"; text: string }
  | { id: number; from: "bot"; summary: Summary };

const REPLY_DELAY_MS = 550;
const REDACTED_TEXT = "Message hidden — personal details aren’t needed in this demo.";

function greetingMessages(): Message[] {
  return [{ id: 0, from: "bot", text: GREETING }];
}

export function ChatbotDemo() {
  const [bot, setBot] = useState<BotState>(initialState);
  const [messages, setMessages] = useState<Message[]>(greetingMessages);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);
  const focusChoicesNext = useRef(false);

  // Keep the newest message in view by scrolling the log itself (not the page).
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, typing]);

  // After choosing a reply button, move focus to the first new option so keyboard users don't lose their place.
  useEffect(() => {
    if (typing || !focusChoicesNext.current) return;
    focusChoicesNext.current = false;
    choicesRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [typing, bot]);

  useEffect(() => {
    const pending = timer;
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  function toMessages(replies: BotReply[]): Message[] {
    return replies.map((replyItem): Message =>
      "summary" in replyItem
        ? { id: nextId.current++, from: "bot", summary: replyItem.summary }
        : { id: nextId.current++, from: "bot", text: replyItem.text },
    );
  }

  function respond(userText: string, redacted: boolean, turn: Turn) {
    setMessages((current) => [...current, { id: nextId.current++, from: "user", text: userText, redacted }]);
    setTyping(true);
    timer.current = setTimeout(() => {
      setMessages((current) => [...current, ...toMessages(turn.replies)]);
      setBot(turn.state);
      setTyping(false);
      timer.current = null;
    }, REPLY_DELAY_MS);
  }

  function choose(choice: Choice) {
    if (typing) return;
    focusChoicesNext.current = true;
    respond(choice.userText ?? choice.label, false, handleAction(bot, choice.action));
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || typing) return;
    const turn = handleText(bot, text);
    respond(turn.redactUserText ? REDACTED_TEXT : text, turn.redactUserText, turn);
    setDraft("");
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    nextId.current = 1;
    setBot(initialState());
    setMessages(greetingMessages());
    setTyping(false);
    setDraft("");
  }

  const choices = choicesFor(bot);

  return (
    <div className="flex h-[40rem] max-h-[85vh] min-h-[32rem] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
      <div className="flex items-center justify-between gap-3 bg-petrol px-4 py-3.5 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
            <LogoMark tone="dark" className="h-6 w-6" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold">{DEMO_COMPANY.name}</p>
            <p className="text-sm text-sky">Demo · fictional company</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-sky"
        >
          <Icon name="reset" className="h-4 w-4" />
          Reset
        </button>
      </div>

      <div
        ref={logRef}
        role="log"
        aria-label="Demo conversation"
        aria-live="polite"
        tabIndex={0}
        className="flex-1 space-y-3 overflow-y-auto bg-ice/60 px-4 py-5 sm:px-5"
      >
        {messages.map((message) => {
          if (message.from === "user") {
            return (
              <div key={message.id} className="flex justify-end">
                <p
                  className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[0.95rem] leading-relaxed ${
                    message.redacted ? "bg-white text-petrol-soft italic ring-1 ring-line" : "bg-ocean text-white"
                  }`}
                >
                  <span className="sr-only">You: </span>
                  {message.text}
                </p>
              </div>
            );
          }
          if ("summary" in message) {
            const { summary } = message;
            return (
              <div key={message.id} className="animate-rise">
                <RequestSummary
                  title="Sample service request"
                  badge="Not submitted"
                  noteTone="demo"
                  rows={[
                    { label: "Service", value: summary.service },
                    { label: "ZIP", value: summary.zip },
                    { label: "Area", value: summary.areaNote },
                    { label: "Details", value: summary.details },
                    { label: "Callback", value: summary.callback },
                    { label: "Contact", value: summary.contact },
                  ]}
                  note="Demo only: nothing was sent to anyone, and no appointment was booked."
                />
              </div>
            );
          }
          return (
            <div key={message.id} className="animate-rise flex justify-start">
              <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[0.95rem] leading-relaxed text-petrol ring-1 ring-line">
                <span className="sr-only">Assistant: </span>
                {message.text}
              </p>
            </div>
          );
        })}
        {typing ? (
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

      <div className="border-t border-line bg-white px-4 pt-3 pb-4 sm:px-5">
        <div
          ref={choicesRef}
          role="group"
          aria-label="Suggested replies"
          className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pb-3"
        >
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              onClick={() => choose(choice)}
              disabled={typing}
              className="rounded-full bg-sky-soft px-3.5 py-2 text-left text-sm font-semibold text-petrol ring-1 ring-sky ring-inset transition-colors hover:bg-sky disabled:cursor-wait disabled:opacity-60"
            >
              {choice.label}
            </button>
          ))}
        </div>
        <form onSubmit={submitText} className="flex items-center gap-2">
          <label htmlFor="demo-chat-input" className="sr-only">
            Type a question for the demo chatbot
          </label>
          <input
            id="demo-chat-input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_INPUT_LENGTH}
            autoComplete="off"
            placeholder="Type a question (no personal details)"
            aria-describedby="demo-chat-hint"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-ice/60 px-4 text-base text-petrol placeholder:text-petrol-soft focus:border-ocean"
          />
          <button
            type="submit"
            disabled={typing || !draft.trim()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean text-white hover:bg-ocean-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="send" className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </button>
        </form>
        <p id="demo-chat-hint" className="mt-2 text-sm text-petrol-soft">
          Scripted demo. Runs in your browser only. Nothing is sent or saved.
        </p>
      </div>
    </div>
  );
}
