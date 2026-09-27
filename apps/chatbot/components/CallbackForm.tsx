"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { PublicClientView } from "@/lib/config";
import {
  CALLBACK_TIMES,
  EMPTY_LEAD,
  LEAD_LIMITS,
  OTHER_SERVICE,
  callbackDayOptions,
  describeCallbackPreference,
  hasLeadErrors,
  normalizeLead,
  validateLead,
  type LeadErrors,
  type LeadField,
  type LeadInput,
  type TypedDetails,
} from "@/lib/lead-fields";
import { detectHazards, safetyMessage } from "@/lib/safety";
import { post } from "./api";

type Step = "form" | "review" | "done";

const FIELD_ORDER: (LeadField | "contact")[] = ["name", "phone", "email", "contact", "zip", "service", "details", "preferredDay", "preferredTime", "timeZone"];

// Fictional details for demos. 555-01xx numbers and .example domains are reserved for fiction.
const SAMPLE_DETAILS = {
  name: "Jordan Sample",
  phone: "(555) 010-0142",
  email: "jordan@example.com",
  zip: "54321",
  details: "Upstairs is warm and the AC is blowing warm air. (Demo sample request.)",
};

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function zoneLabel(timeZone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? timeZone
    );
  } catch {
    return timeZone;
  }
}

interface Props {
  client: PublicClientView;
  /** Starts (or, with forceNew, restarts an expired) chat session and returns its ID. */
  ensureConversation: (forceNew?: boolean) => Promise<string | null>;
  onClose: (message?: string) => void;
  /** Details the visitor typed into the chat, kept only in the browser, to save retyping. */
  prefill?: TypedDetails;
}

export function CallbackForm({ client, ensureConversation, onClose, prefill = {} }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [lead, setLead] = useState<LeadInput>({ ...EMPTY_LEAD, ...prefill, timeZone: client.timeZone });
  const [duplicate, setDuplicate] = useState(false);
  const dayOptions = useMemo(() => callbackDayOptions(client.timeZone, client.officeHours), [client.timeZone, client.officeHours]);
  const leadContext = { timeZone: client.timeZone, hours: client.officeHours };
  const [errors, setErrors] = useState<LeadErrors>({});
  const [visitorZone, setVisitorZone] = useState<string | null>(null);
  const [inServiceArea, setInServiceArea] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reference, setReference] = useState("");
  // One key per reviewed request: a retry after a network error can't create a second lead.
  const idempotencyKey = useRef(newKey());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const baseId = useId();
  const services = [...client.services, OTHER_SERVICE];

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && zone !== client.timeZone) setVisitorZone(zone);
  }, [client.timeZone]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function update(field: LeadField, value: string) {
    setLead((current) => ({ ...current, [field]: value }));
    if (errors[field] || (errors.contact && (field === "email" || field === "phone"))) {
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        if (field === "email" || field === "phone") delete next.contact;
        return next;
      });
    }
  }

  function focusFirstError(found: LeadErrors) {
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    const target = first === "contact" ? "phone" : first;
    formRef.current?.querySelector<HTMLElement>(`[name="${target}"]`)?.focus();
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeLead(lead);
    const found = validateLead(normalized, client.services, leadContext);
    setErrors(found);
    if (hasLeadErrors(found)) {
      focusFirstError(found);
      return;
    }
    setLead(normalized);
    idempotencyKey.current = newKey();
    setSubmitError("");
    const check = await post<{ inServiceArea: boolean }>("/api/widget/service-area", { publicId: client.publicId, zip: normalized.zip });
    setInServiceArea(check && check.status === 200 ? check.data.inServiceArea : null);
    setStep("review");
  }

  async function send(conversationId: string | null) {
    if (!conversationId) return null;
    return post<{ reference: string; duplicate?: boolean }>("/api/widget/leads", {
      publicId: client.publicId,
      conversationId,
      idempotencyKey: idempotencyKey.current,
      confirmed: true,
      lead,
    });
  }

  async function submit() {
    if (sending) return;
    setSending(true);
    setSubmitError("");
    let result = await send(await ensureConversation());
    // A chat that expired while the tab was open: start a new one and send again with the same key.
    if (result?.status === 404) result = await send(await ensureConversation(true));
    setSending(false);

    if (result?.status === 200 && result.data.reference) {
      setReference(result.data.reference);
      setDuplicate(Boolean(result.data.duplicate));
      setStep("done");
      return;
    }
    if (result?.status === 422) {
      const found = (result.data as { errors?: LeadErrors }).errors ?? {};
      setErrors(found);
      setStep("form");
      setTimeout(() => focusFirstError(found), 0);
      return;
    }
    const phone = client.contact.phone ? ` You can also call the office at ${client.contact.phone}.` : "";
    if (!result) {
      // The request may or may not have reached the server; resending is safe (same idempotency key).
      setSubmitError(
        `We couldn’t reach the server, so we can’t tell whether your request was saved. Check your connection and press Send request again. It won’t create a duplicate.${phone}`,
      );
    } else if (result.status >= 500) {
      setSubmitError(`Your request wasn’t saved because of a problem on our side. Please try again in a minute.${phone}`);
    } else {
      setSubmitError(result.data.message ?? `Your request wasn’t sent. Please try again.${phone}`);
    }
  }

  function fillSample() {
    setLead((current) => ({
      ...current,
      ...SAMPLE_DETAILS,
      service: client.services[0] ?? OTHER_SERVICE,
      preferredTime: CALLBACK_TIMES[2],
    }));
    setErrors({});
  }

  const fieldClass =
    "mt-1 block w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-base text-gray-900 aria-[invalid=true]:border-red-700";
  const errorText = (field: LeadField | "contact") =>
    errors[field] ? (
      <p id={`${baseId}-${field}-error`} className="mt-1 text-sm text-red-700">
        {errors[field]}
      </p>
    ) : null;
  const describedBy = (field: LeadField, hint?: string) =>
    [hint, errors[field] && `${baseId}-${field}-error`, (field === "email" || field === "phone") && errors.contact && `${baseId}-contact-error`]
      .filter(Boolean)
      .join(" ") || undefined;

  if (step === "done") {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <h2 ref={headingRef} tabIndex={-1} className="font-sans text-xl font-semibold tracking-normal text-gray-900">
          {duplicate ? "Already received" : "Request received"}
        </h2>
        {duplicate ? (
          <p className="text-gray-800">
            This matches a request you already sent today (reference <strong className="font-semibold">{reference}</strong>), so it
            wasn’t sent again. {client.businessName}’s office already has it. If something changed, mention it when they contact you.
          </p>
        ) : (
          <p className="text-gray-800">
            Your reference is <strong className="font-semibold">{reference}</strong>. {client.businessName}’s office will contact you
            to follow up. Your preferred time is a request, not a guaranteed response time.
          </p>
        )}
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          This is a callback request, not a confirmed appointment. No visit is scheduled until the office confirms it with you.
        </p>
        {client.isDemo ? (
          <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
            Demo: this business is fictional. Your request was saved in the demo’s test storage and was not sent to any contractor.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => onClose(`Your callback request ${reference} was received. It isn’t a confirmed appointment.`)}
          className="mt-auto rounded-lg bg-[var(--brand)] px-4 py-2.5 font-semibold text-[var(--brand-text)]"
        >
          Back to chat
        </button>
      </div>
    );
  }

  if (step === "review") {
    const rows: [string, string][] = [
      ["Name", lead.name],
      ["Phone", lead.phone || "Not provided"],
      ["Email", lead.email || "Not provided"],
      ["Service ZIP code", lead.zip],
      ["Service needed", lead.service],
      ["Details", lead.details || "None"],
      ["Preferred callback", describeCallbackPreference(lead, zoneLabel(lead.timeZone))],
    ];
    const hazards = detectHazards(lead.details);
    return (
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
        <h2 ref={headingRef} tabIndex={-1} className="font-sans text-xl font-semibold tracking-normal text-gray-900">
          Review your request
        </h2>
        <dl className="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[8.5rem_1fr] gap-2 px-3 py-2">
              <dt className="font-semibold text-gray-700">{label}</dt>
              <dd className="break-words whitespace-pre-line text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
        {inServiceArea === false ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            ZIP {lead.zip} isn’t on {client.businessName}’s service-area list. You can still send the request, but they may not be able
            to help at that address.
          </p>
        ) : null}
        <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-800">
          This sends a callback request to {client.businessName}. It is <strong>not</strong> a confirmed appointment; the office will
          contact you.{client.isDemo ? " Demo: nothing is sent to a real business." : ""}
        </p>
        {hazards.length ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">
            {safetyMessage(hazards)} Sending this request does not send emergency help.
          </p>
        ) : null}
        {submitError ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {submitError}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onClose("Callback request cancelled. Nothing was sent.")}
            disabled={sending}
            className="min-h-11 rounded-lg px-3 py-2.5 font-semibold text-gray-800 underline"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={sending}
            className="min-h-11 flex-1 rounded-lg border border-gray-400 px-4 py-2.5 font-semibold text-gray-900"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            aria-busy={sending}
            className="min-h-11 flex-1 rounded-lg bg-[var(--brand)] px-4 py-2.5 font-semibold text-[var(--brand-text)] disabled:opacity-70"
          >
            {sending ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={review} noValidate className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="font-sans text-xl font-semibold tracking-normal text-gray-900">
          Request a callback
        </h2>
        <button type="button" onClick={() => onClose()} className="min-h-11 shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-gray-700 underline">
          Back to chat
        </button>
      </div>
      <p className="text-sm text-gray-700">
        {client.businessName}’s office will contact you. This is not an appointment booking. You’ll review everything before sending.
      </p>
      {client.isDemo ? (
        <button
          type="button"
          onClick={fillSample}
          className="min-h-11 self-start rounded-lg border border-dashed border-gray-500 px-3 py-2 text-sm font-semibold text-gray-800"
        >
          Fill in fictional sample details
        </button>
      ) : null}

      <div>
        <label htmlFor={`${baseId}-name`} className="text-sm font-semibold text-gray-900">
          Name
        </label>
        <input
          id={`${baseId}-name`}
          name="name"
          autoComplete="name"
          maxLength={LEAD_LIMITS.name}
          value={lead.name}
          onChange={(event) => update("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name")}
          className={fieldClass}
        />
        {errorText("name")}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">How can the office reach you?</legend>
        <p id={`${baseId}-contact-hint`} className="text-sm text-gray-700">
          Enter a phone number, an email address, or both. International numbers: start with + and the country code.
        </p>
        <label htmlFor={`${baseId}-phone`} className="mt-2 block text-sm font-semibold text-gray-900">
          Phone
        </label>
        <input
          id={`${baseId}-phone`}
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={LEAD_LIMITS.phone}
          value={lead.phone}
          onChange={(event) => update("phone", event.target.value)}
          aria-invalid={Boolean(errors.phone || errors.contact)}
          aria-describedby={describedBy("phone", `${baseId}-contact-hint`)}
          className={fieldClass}
        />
        {errorText("phone")}
        <label htmlFor={`${baseId}-email`} className="mt-2 block text-sm font-semibold text-gray-900">
          Email
        </label>
        <input
          id={`${baseId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={LEAD_LIMITS.email}
          value={lead.email}
          onChange={(event) => update("email", event.target.value)}
          aria-invalid={Boolean(errors.email || errors.contact)}
          aria-describedby={describedBy("email", `${baseId}-contact-hint`)}
          className={fieldClass}
        />
        {errorText("email")}
        {errorText("contact")}
      </fieldset>

      <div>
        <label htmlFor={`${baseId}-zip`} className="text-sm font-semibold text-gray-900">
          ZIP code where you need service
        </label>
        <input
          id={`${baseId}-zip`}
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={lead.zip}
          onChange={(event) => update("zip", event.target.value.replace(/\D/g, ""))}
          aria-invalid={Boolean(errors.zip)}
          aria-describedby={describedBy("zip")}
          className={`${fieldClass} max-w-[9rem]`}
        />
        {errorText("zip")}
      </div>

      <div>
        <label htmlFor={`${baseId}-service`} className="text-sm font-semibold text-gray-900">
          Service needed
        </label>
        <select
          id={`${baseId}-service`}
          name="service"
          value={lead.service}
          onChange={(event) => update("service", event.target.value)}
          aria-invalid={Boolean(errors.service)}
          aria-describedby={describedBy("service")}
          className={fieldClass}
        >
          <option value="">Choose a service</option>
          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
        {errorText("service")}
      </div>

      <div>
        <label htmlFor={`${baseId}-details`} className="text-sm font-semibold text-gray-900">
          Details <span className="font-normal text-gray-700">(optional)</span>
        </label>
        <textarea
          id={`${baseId}-details`}
          name="details"
          rows={3}
          maxLength={LEAD_LIMITS.details}
          value={lead.details}
          onChange={(event) => update("details", event.target.value)}
          aria-invalid={Boolean(errors.details)}
          aria-describedby={describedBy("details")}
          className={fieldClass}
        />
        {errorText("details")}
      </div>

      <div>
        <label htmlFor={`${baseId}-day`} className="text-sm font-semibold text-gray-900">
          Preferred callback day
        </label>
        <select
          id={`${baseId}-day`}
          name="preferredDay"
          value={lead.preferredDay}
          onChange={(event) => update("preferredDay", event.target.value)}
          aria-invalid={Boolean(errors.preferredDay)}
          aria-describedby={describedBy("preferredDay", `${baseId}-day-hint`)}
          className={fieldClass}
        >
          {dayOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={option.closed}>
              {option.label}
            </option>
          ))}
        </select>
        <p id={`${baseId}-day-hint`} className="mt-1 text-sm text-gray-700">
          Dates are in {client.timeZoneLabel}. A preferred day is a request, not an appointment.
        </p>
        {errorText("preferredDay")}
      </div>

      <div>
        <label htmlFor={`${baseId}-time`} className="text-sm font-semibold text-gray-900">
          Preferred callback time
        </label>
        <select
          id={`${baseId}-time`}
          name="preferredTime"
          value={lead.preferredTime}
          onChange={(event) => update("preferredTime", event.target.value)}
          aria-invalid={Boolean(errors.preferredTime)}
          aria-describedby={describedBy("preferredTime", `${baseId}-zone-hint`)}
          className={fieldClass}
        >
          <option value="">Choose a time</option>
          {CALLBACK_TIMES.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        {errorText("preferredTime")}
        {visitorZone ? (
          <fieldset className="mt-2">
            <legend id={`${baseId}-zone-hint`} className="text-sm text-gray-800">
              Which time zone are these times in?
            </legend>
            {[client.timeZone, visitorZone].map((zone) => (
              <label key={zone} className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="radio"
                  name="timeZone"
                  value={zone}
                  checked={lead.timeZone === zone}
                  onChange={() => update("timeZone", zone)}
                  className="h-4 w-4"
                />
                {zoneLabel(zone)}
                {zone === client.timeZone ? ` (${client.businessName})` : " (yours)"}
              </label>
            ))}
          </fieldset>
        ) : (
          <p id={`${baseId}-zone-hint`} className="mt-1 text-sm text-gray-700">
            Times are in {client.timeZoneLabel}.
          </p>
        )}
        {errorText("timeZone")}
        <p className="mt-2 text-sm text-gray-700">
          Your preferred day and time are a request. The office will reach out as soon as it can; this doesn’t book an appointment.
        </p>
      </div>

      <button type="submit" className="mt-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 font-semibold text-[var(--brand-text)]">
        Review request
      </button>
    </form>
  );
}
