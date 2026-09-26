"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { demoRequest } from "@/content/site";
import {
  DEMO_REQUEST_FIELDS,
  EMPTY_DEMO_REQUEST,
  FIELD_LIMITS,
  TRADES,
  hasErrors,
  validateDemoRequest,
  type DemoRequestErrors,
  type DemoRequestField,
  type DemoRequestInput,
} from "@/lib/demo-request";
import { Icon } from "./Icon";
import { buttonClasses } from "./ui";

type Availability = "checking" | "available" | "unavailable";
type Status = "idle" | "submitting" | "success" | "error";

const INPUT_CLASSES =
  "block w-full rounded-xl border bg-white px-4 py-3 text-base text-petrol placeholder:text-petrol-soft/80 transition-colors focus:border-ocean disabled:cursor-not-allowed disabled:bg-ice";

function trimAll(values: DemoRequestInput): DemoRequestInput {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()]),
  ) as unknown as DemoRequestInput;
}

export function DemoRequestForm() {
  const [availability, setAvailability] = useState<Availability>("checking");
  const [values, setValues] = useState<DemoRequestInput>(EMPTY_DEMO_REQUEST);
  const [errors, setErrors] = useState<DemoRequestErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [honeypot, setHoneypot] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/demo-request", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { available: false }))
      .then((data: { available?: boolean }) => setAvailability(data.available ? "available" : "unavailable"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setAvailability("unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (status === "success" || status === "error") statusRef.current?.focus();
  }, [status]);

  function update(field: DemoRequestField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = { ...values, [field]: event.target.value };
      setValues(next);
      if (status === "success" || status === "error") setStatus("idle");
      // Once someone has tried to submit, keep errors in sync as they type.
      if (attempted) setErrors(validateDemoRequest(trimAll(next)));
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (availability !== "available" || status === "submitting") return;

    const input = trimAll(values);
    const found = validateDemoRequest(input);
    setAttempted(true);
    setErrors(found);
    if (hasErrors(found)) {
      const first = DEMO_REQUEST_FIELDS.find((field) => found[field]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, company_fax: honeypot }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; errors?: DemoRequestErrors };

      if (response.ok && data.ok) {
        setStatus("success");
        setValues(EMPTY_DEMO_REQUEST);
        setErrors({});
        setAttempted(false);
        return;
      }
      if (response.status === 503) {
        setAvailability("unavailable");
        setStatus("idle");
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

  const disabled = availability !== "available";
  const errorCount = Object.keys(errors).length;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="rounded-3xl bg-white p-6 text-petrol shadow-lift sm:p-8">
      {availability === "unavailable" ? (
        <div role="status" className="mb-6 flex gap-3 rounded-2xl border border-sky bg-sky-soft p-4 text-petrol">
          <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="font-medium">{demoRequest.unavailable}</p>
        </div>
      ) : null}

      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {status === "success" ? (
          <div className="mb-6 flex gap-3 rounded-2xl bg-ice p-4 font-medium text-ocean">
            <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{demoRequest.success}</p>
          </div>
        ) : null}
        {status === "error" ? (
          <div className="mb-6 flex gap-3 rounded-2xl bg-danger-soft p-4 font-medium text-danger">
            <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{demoRequest.failure}</p>
          </div>
        ) : null}
        {attempted && errorCount > 0 ? (
          <p className="mb-6 rounded-2xl bg-danger-soft p-4 font-medium text-danger">
            Please fix {errorCount === 1 ? "1 field" : `${errorCount} fields`} below.
          </p>
        ) : null}
      </div>

      <fieldset disabled={disabled} className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Demo request details</legend>

        <Field id="name" label="Name" error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={FIELD_LIMITS.name}
            value={values.name}
            onChange={update("name")}
            {...fieldA11y("name", errors.name)}
            className={`${INPUT_CLASSES} ${errors.name ? "border-danger" : "border-line"}`}
          />
        </Field>

        <Field id="business" label="Business name" error={errors.business}>
          <input
            id="business"
            name="business"
            type="text"
            autoComplete="organization"
            required
            maxLength={FIELD_LIMITS.business}
            value={values.business}
            onChange={update("business")}
            {...fieldA11y("business", errors.business)}
            className={`${INPUT_CLASSES} ${errors.business ? "border-danger" : "border-line"}`}
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
            maxLength={FIELD_LIMITS.email}
            value={values.email}
            onChange={update("email")}
            {...fieldA11y("email", errors.email)}
            className={`${INPUT_CLASSES} ${errors.email ? "border-danger" : "border-line"}`}
          />
        </Field>

        <Field id="website" label="Website URL" optional error={errors.website}>
          <input
            id="website"
            name="website"
            type="text"
            autoComplete="url"
            inputMode="url"
            placeholder="yourbusiness.com"
            maxLength={FIELD_LIMITS.website}
            value={values.website}
            onChange={update("website")}
            {...fieldA11y("website", errors.website)}
            className={`${INPUT_CLASSES} ${errors.website ? "border-danger" : "border-line"}`}
          />
        </Field>

        <Field id="trade" label="Trade" error={errors.trade} className="sm:col-span-2">
          <div className="relative">
            <select
              id="trade"
              name="trade"
              required
              value={values.trade}
              onChange={update("trade")}
              {...fieldA11y("trade", errors.trade)}
              className={`${INPUT_CLASSES} appearance-none pr-11 ${errors.trade ? "border-danger" : "border-line"}`}
            >
              <option value="">Choose your trade</option>
              {TRADES.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
            <Icon
              name="chevron"
              className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-ocean"
            />
          </div>
        </Field>

        <Field
          id="message"
          label="What do you need help with?"
          error={errors.message}
          className="sm:col-span-2"
          hint={`${values.message.length}/${FIELD_LIMITS.message} characters`}
        >
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            maxLength={FIELD_LIMITS.message}
            placeholder="For example: we miss calls after hours and get a lot of service-area questions."
            value={values.message}
            onChange={update("message")}
            {...fieldA11y("message", errors.message, true)}
            className={`${INPUT_CLASSES} resize-y ${errors.message ? "border-danger" : "border-line"}`}
          />
        </Field>

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

        <div className="sm:col-span-2">
          <button type="submit" className={buttonClasses("primary", "w-full sm:w-auto")} disabled={disabled || status === "submitting"}>
            {availability === "checking"
              ? "Checking availability…"
              : status === "submitting"
                ? "Sending…"
                : "Request a Demo"}
          </button>
          <p className="mt-3 text-sm text-petrol-soft">
            We use these details only to follow up about your demo request.
          </p>
        </div>
      </fieldset>
    </form>
  );
}

function fieldA11y(field: DemoRequestField, error: string | undefined, hasHint = false) {
  const describedBy = [error ? `${field}-error` : null, hasHint ? `${field}-hint` : null].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

function Field({
  id,
  label,
  optional = false,
  error,
  hint,
  className = "",
  children,
}: {
  id: DemoRequestField;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 font-medium text-petrol">
        <span>{label}</span>
        <span className="text-sm font-normal text-petrol-soft">{optional ? "Optional" : "Required"}</span>
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-right text-sm text-petrol-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
