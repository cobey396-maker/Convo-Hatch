"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { schedule } from "@/content/site";
import {
  BOOKING_LIMITS,
  formatSlot,
  hasBookingErrors,
  validateBooking,
  type BookingDay,
  type BookingErrors,
  type BookingField,
  type BookingInput,
} from "@/lib/booking";
import { Icon } from "./Icon";
import { buttonClasses } from "./ui";

type Load = "loading" | "ready" | "unavailable" | "error";
type Status = "idle" | "submitting" | "error";
type Details = Omit<BookingInput, "slot">;

const EMPTY_DETAILS: Details = { name: "", email: "", phone: "" };
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const INPUT_CLASSES =
  "block w-full rounded-xl border bg-white px-4 py-3 text-base text-petrol placeholder:text-petrol-soft/80 transition-colors focus:border-ocean";

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function BookingCalendar() {
  const [load, setLoad] = useState<Load>("loading");
  const [days, setDays] = useState<BookingDay[]>([]);
  const [timeZone, setTimeZone] = useState<string>(schedule.timeZone);
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState("");
  const [booked, setBooked] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const timesRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  async function loadSlots(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/booking", { cache: "no-store", signal });
      const data = (await response.json()) as { available?: boolean; timeZone?: string; days?: BookingDay[] };
      if (!response.ok || !data.available) {
        setLoad("unavailable");
        return;
      }
      const loaded = data.days ?? [];
      setDays(loaded);
      if (data.timeZone) setTimeZone(data.timeZone);
      setMonth((current) => current || (loaded[0] ? monthKey(loaded[0].date) : ""));
      setLoad("ready");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoad("error");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadSlots(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (booked) doneRef.current?.focus();
  }, [booked]);

  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day.slots])), [days]);
  const months = useMemo(() => [...new Set(days.map((day) => monthKey(day.date)))], [days]);
  const monthIndex = months.indexOf(month);

  const visitorZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : timeZone;
  const zoneName = useMemo(() => {
    const sample = days[0]?.slots[0];
    if (!sample) return "";
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" }).formatToParts(new Date(sample));
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  }, [days, timeZone]);

  function timeLabel(value: string, zone = timeZone) {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
  }

  function chooseDate(next: string) {
    setDate(next);
    setSlot("");
    setNotice("");
    requestAnimationFrame(() => timesRef.current?.focus());
  }

  function chooseSlot(next: string) {
    setSlot(next);
    setNotice("");
    setStatus("idle");
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus());
  }

  function update(field: keyof Details) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...details, [field]: event.target.value };
      setDetails(next);
      if (Object.keys(errors).length > 0) setErrors(validateBooking({ slot, ...trim(next) }));
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const input: BookingInput = { slot, ...trim(details) };
    const found = validateBooking(input);
    setErrors(found);
    if (hasBookingErrors(found)) {
      const first = (["name", "email", "phone"] as const).find((field) => found[field]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setStatus("submitting");
    setNotice("");
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, company_fax: honeypot }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: BookingErrors };

      if (response.ok && data.ok) {
        setBooked(slot);
        setStatus("idle");
        return;
      }
      if (response.status === 409) {
        setNotice(schedule.taken);
        setSlot("");
        setStatus("idle");
        await loadSlots();
        requestAnimationFrame(() => timesRef.current?.focus());
        return;
      }
      if (response.status === 503) {
        setLoad("unavailable");
        return;
      }
      if (response.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus("idle");
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (booked) {
    return (
      <Card>
        <div ref={doneRef} tabIndex={-1} className="text-center outline-none">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ice text-ocean">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-2xl text-petrol">{formatSlot(booked, timeZone)}</h2>
          <p className="mt-3 text-lg text-petrol-soft">{schedule.success}</p>
          <Link href="/" className={buttonClasses("secondary", "mt-8")}>
            Back to the home page
          </Link>
        </div>
      </Card>
    );
  }

  if (load !== "ready") {
    return (
      <Card>
        {load === "loading" ? (
          <p role="status" className="text-petrol-soft">
            Loading available times…
          </p>
        ) : (
          <div role="status" className="flex gap-3 rounded-2xl border border-sky bg-sky-soft p-4 text-petrol">
            <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-medium">
              {load === "unavailable" ? schedule.unavailable : "We couldn’t load available times. Please refresh the page to try again."}
            </p>
          </div>
        )}
      </Card>
    );
  }

  if (days.length === 0) {
    return (
      <Card>
        <p role="status" className="font-medium">
          There are no open times in the next few weeks. Please check back soon, or use the demo request form.
        </p>
      </Card>
    );
  }

  const { year, month: monthNumber } = parseDate(`${month}-01`);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => `${month}-${pad(index + 1)}`),
  ];
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  );
  const slots = date ? byDate.get(date) ?? [] : [];
  const dateLabel = date
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
        new Date(Date.UTC(parseDate(date).year, parseDate(date).month - 1, parseDate(date).day)),
      )
    : "";

  return (
    <Card>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-xl text-petrol" aria-live="polite">
              {monthLabel}
            </h2>
            <div className="flex gap-2">
              <MonthButton
                label="Previous month"
                disabled={monthIndex <= 0}
                onClick={() => setMonth(months[monthIndex - 1])}
                flip
              />
              <MonthButton
                label="Next month"
                disabled={monthIndex >= months.length - 1}
                onClick={() => setMonth(months[monthIndex + 1])}
              />
            </div>
          </div>

          <div role="group" aria-label={`Available days in ${monthLabel}`} className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} aria-hidden="true" className="pb-1 text-xs font-semibold tracking-wide text-petrol-soft uppercase">
                {label}
              </div>
            ))}
            {cells.map((cell, index) => {
              if (!cell) return <div key={`blank-${index}`} aria-hidden="true" />;
              const open = byDate.has(cell);
              const selected = cell === date;
              const dayNumber = Number(cell.slice(8));
              return (
                <button
                  key={cell}
                  type="button"
                  disabled={!open}
                  aria-pressed={selected}
                  aria-label={`${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
                    new Date(Date.UTC(year, monthNumber - 1, dayNumber)),
                  )}${open ? "" : ", no times available"}`}
                  onClick={() => chooseDate(cell)}
                  className={`aspect-square min-h-10 rounded-xl text-base font-semibold transition-colors ${
                    selected
                      ? "bg-ocean text-white"
                      : open
                        ? "bg-sky-soft text-ocean hover:bg-sky"
                        : "cursor-not-allowed text-petrol-soft/50"
                  }`}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>
          <p className="mt-4 flex gap-2 text-sm text-petrol-soft">
            <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {schedule.hoursNote} Times are shown in {zoneName || timeZone}.
            </span>
          </p>
        </div>

        <div>
          <h2 ref={timesRef} tabIndex={-1} className="mb-4 text-xl text-petrol outline-none">
            {date ? dateLabel : "Choose a day"}
          </h2>
          {notice ? (
            <p role="alert" className="mb-4 rounded-2xl bg-danger-soft p-4 font-medium text-danger">
              {notice}
            </p>
          ) : null}
          {date ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {slots.map((value) => (
                <li key={value}>
                  <button
                    type="button"
                    aria-pressed={value === slot}
                    onClick={() => chooseSlot(value)}
                    className={`w-full rounded-xl px-3 py-2.5 font-semibold ring-1 transition-colors ring-inset ${
                      value === slot ? "bg-ocean text-white ring-ocean" : "bg-white text-ocean ring-line hover:ring-ocean"
                    }`}
                  >
                    {timeLabel(value)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-petrol-soft">Pick a highlighted day to see open 30-minute times.</p>
          )}
        </div>
      </div>

      {slot ? (
        <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-8 border-t border-line pt-8">
          <h2 className="text-xl text-petrol">Your details</h2>
          <p className="mt-1 text-petrol-soft">
            {formatSlot(slot, timeZone)}
            {visitorZone && visitorZone !== timeZone ? ` (${timeLabel(slot, visitorZone)} your time)` : ""}
          </p>

          {status === "error" ? (
            <p role="alert" className="mt-5 rounded-2xl bg-danger-soft p-4 font-medium text-danger">
              {schedule.failure}
            </p>
          ) : null}

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <Field id="name" label="Name" error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                maxLength={BOOKING_LIMITS.name}
                value={details.name}
                onChange={update("name")}
                {...fieldA11y("name", errors.name)}
                className={`${INPUT_CLASSES} ${errors.name ? "border-danger" : "border-line"}`}
              />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={BOOKING_LIMITS.email}
                value={details.email}
                onChange={update("email")}
                {...fieldA11y("email", errors.email)}
                className={`${INPUT_CLASSES} ${errors.email ? "border-danger" : "border-line"}`}
              />
            </Field>
            <Field id="phone" label="Phone number" error={errors.phone}>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                maxLength={BOOKING_LIMITS.phone}
                placeholder="(555) 123-4567"
                value={details.phone}
                onChange={update("phone")}
                {...fieldA11y("phone", errors.phone)}
                className={`${INPUT_CLASSES} ${errors.phone ? "border-danger" : "border-line"}`}
              />
            </Field>
          </div>

          {/* Spam trap: hidden from people and assistive tech; bots tend to fill it in. */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="company_fax">Leave this field empty</label>
            <input
              id="company_fax"
              name="company_fax"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          <button type="submit" className={buttonClasses("primary", "mt-6 w-full sm:w-auto")} disabled={status === "submitting"}>
            {status === "submitting" ? "Booking…" : "Book this time"}
          </button>
          <p className="mt-3 text-sm text-petrol-soft">We use these details only to set up and follow up on your call.</p>
        </form>
      ) : null}
    </Card>
  );
}

function trim(details: Details): Details {
  return { name: details.name.trim(), email: details.email.trim(), phone: details.phone.trim() };
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl bg-white p-6 text-petrol shadow-lift sm:p-8">{children}</div>;
}

function MonthButton({ label, disabled, onClick, flip = false }: { label: string; disabled: boolean; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ocean ring-1 ring-line ring-inset hover:ring-ocean disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="sr-only">{label}</span>
      <Icon name="arrow" className={`h-5 w-5 ${flip ? "rotate-180" : ""}`} />
    </button>
  );
}

function fieldA11y(field: BookingField, error: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${field}-error` : undefined,
  } as const;
}

function Field({ id, label, error, children }: { id: BookingField; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium text-petrol">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
