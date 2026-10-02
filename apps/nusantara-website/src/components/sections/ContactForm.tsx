"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import { ENQUIRY_TOPICS, validateEnquiry, type EnquiryErrors, type EnquiryInput, type SubmissionStatus } from "@/lib/contact";

const EMPTY: EnquiryInput = { topic: "", name: "", email: "", organisation: "", message: "", consent: false, website: "" };
const FIELD_ORDER = ["topic", "name", "email", "message", "consent"] as const;

export function ContactForm() {
  const [values, setValues] = useState<EnquiryInput>(EMPTY);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [delivery, setDelivery] = useState<SubmissionStatus>("not-configured");
  const started = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t && ENQUIRY_TOPICS.some((x) => x.id === t)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preselect from deep link once on mount
      setValues((v) => ({ ...v, topic: t }));
    }
  }, []);

  const set = <K extends keyof EnquiryInput>(k: K, v: EnquiryInput[K]) => {
    if (!started.current) {
      started.current = true;
      track({ name: "contact_started", topic: values.topic || null });
    }
    const next = { ...values, [k]: v };
    setValues(next);
    if (touched[k as string] || Object.keys(errors).length) setErrors(validateEnquiry(next));
  };
  const blur = (k: string) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validateEnquiry(values));
  };
  const show = (k: keyof EnquiryErrors) => (touched[k] || state !== "idle" ? errors[k] : undefined);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateEnquiry(values);
    setErrors(errs);
    setTouched(Object.fromEntries(FIELD_ORDER.map((k) => [k, true])));
    if (Object.keys(errs).length) {
      setState("error");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setState("submitting");
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await r.json();
      if (!r.ok) {
        setErrors(data.errors ?? {});
        setState("error");
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      const status: SubmissionStatus = data.status === "delivered" ? "delivered" : "not-configured";
      setDelivery(status);
      track({ name: "contact_submitted", topic: values.topic, delivery: status });
      setState("done");
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch {
      setState("error");
      setErrors({});
    }
  };

  if (state === "done") {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="border border-teal-800 bg-white p-8 outline-none">
        <p className="eyebrow text-stone">Enquiry received</p>
        <h2 className="display-s mt-4 text-teal-900">Thank you, {values.name.split(" ")[0]}.</h2>
        {delivery === "delivered" ? (
          <p className="mt-4 text-[15px] leading-relaxed text-charcoal">Your enquiry has been received and will be routed to the appropriate team.</p>
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-charcoal">
            Your enquiry passed validation. <strong>In this management-review prototype, enquiries are not stored or sent.</strong>{" "}
            Once a delivery channel is approved, messages will be routed to the appropriate team.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setValues(EMPTY);
            setErrors({});
            setTouched({});
            setState("idle");
          }}
          className="mt-6 h-11 border border-teal-800/40 px-5 text-[14px] font-medium text-teal-800 hover:bg-teal-800 hover:text-white"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  const errorList = FIELD_ORDER.filter((k) => errors[k]);
  const inputCls = (bad?: string) =>
    `mt-2 block w-full border bg-white px-4 py-3 text-[15px] text-ink placeholder:text-mist focus:outline-none focus:ring-2 focus:ring-gold-500/40 ${
      bad ? "border-down" : "border-rule focus:border-teal-800"
    }`;

  return (
    <form noValidate onSubmit={onSubmit} aria-describedby="form-note">
      {state === "error" && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-8 border-l-2 border-down bg-down-soft px-5 py-4 outline-none">
          {errorList.length ? (
            <>
              <p className="font-semibold text-down">Please correct {errorList.length === 1 ? "the following" : `${errorList.length} fields`}:</p>
              <ul className="mt-2 space-y-1 text-[14px]">
                {errorList.map((k) => (
                  <li key={k}>
                    <a href={`#field-${k}`} className="text-charcoal underline">
                      {errors[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-down">Something went wrong. Please try again.</p>
          )}
        </div>
      )}

      <fieldset id="field-topic" aria-describedby={show("topic") ? "err-topic" : undefined}>
        <legend className="text-[14px] font-semibold text-ink">
          Type of enquiry <span className="text-down" aria-hidden>*</span>
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ENQUIRY_TOPICS.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer gap-3 border p-4 transition-colors ${
                values.topic === t.id ? "border-teal-800 bg-teal-50" : "border-rule bg-white hover:border-teal-600"
              }`}
            >
              <input
                type="radio"
                name="topic"
                value={t.id}
                checked={values.topic === t.id}
                onChange={() => set("topic", t.id)}
                onBlur={() => blur("topic")}
                className="mt-1 h-4 w-4 accent-teal-800"
                required
              />
              <span>
                <span className="block text-[14.5px] font-medium text-ink">{t.label}</span>
                <span className="mt-0.5 block text-[13px] text-stone">{t.text}</span>
              </span>
            </label>
          ))}
        </div>
        {show("topic") && (
          <p id="err-topic" className="mt-2 text-[13px] text-down">
            {errors.topic}
          </p>
        )}
      </fieldset>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="field-name" className="text-[14px] font-semibold text-ink">
            Full name <span className="text-down" aria-hidden>*</span>
          </label>
          <input
            id="field-name"
            name="name"
            autoComplete="name"
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => blur("name")}
            aria-invalid={!!show("name")}
            aria-describedby={show("name") ? "err-name" : undefined}
            className={inputCls(show("name"))}
          />
          {show("name") && (
            <p id="err-name" className="mt-2 text-[13px] text-down">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="field-email" className="text-[14px] font-semibold text-ink">
            Email address <span className="text-down" aria-hidden>*</span>
          </label>
          <input
            id="field-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => blur("email")}
            aria-invalid={!!show("email")}
            aria-describedby={show("email") ? "err-email" : undefined}
            className={inputCls(show("email"))}
          />
          {show("email") && (
            <p id="err-email" className="mt-2 text-[13px] text-down">
              {errors.email}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="field-organisation" className="text-[14px] font-semibold text-ink">
            Organisation <span className="font-normal text-stone">(optional)</span>
          </label>
          <input
            id="field-organisation"
            name="organisation"
            autoComplete="organization"
            value={values.organisation}
            onChange={(e) => set("organisation", e.target.value)}
            className={inputCls()}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="field-message" className="text-[14px] font-semibold text-ink">
            Message <span className="text-down" aria-hidden>*</span>
          </label>
          <textarea
            id="field-message"
            name="message"
            rows={6}
            required
            value={values.message}
            onChange={(e) => set("message", e.target.value)}
            onBlur={() => blur("message")}
            aria-invalid={!!show("message")}
            aria-describedby={`count-message${show("message") ? " err-message" : ""}`}
            className={inputCls(show("message"))}
          />
          <div className="mt-2 flex justify-between gap-4 text-[13px]">
            <span id="err-message" className="text-down">
              {show("message") ?? ""}
            </span>
            <span id="count-message" className="num shrink-0 text-stone">
              {values.message.trim().length} / 2,000
            </span>
          </div>
        </div>
      </div>

      {/* Honeypot — hidden from people and assistive technology */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set("website", e.target.value)} />
        </label>
      </div>

      <div id="field-consent" className="mt-8">
        <label className="flex cursor-pointer gap-3 text-[14px] leading-relaxed text-charcoal">
          <input
            type="checkbox"
            checked={values.consent}
            onChange={(e) => set("consent", e.target.checked)}
            onBlur={() => blur("consent")}
            aria-invalid={!!show("consent")}
            aria-describedby={show("consent") ? "err-consent" : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-teal-800"
          />
          <span>
            I have read the{" "}
            <Link href="/legal/privacy" className="text-teal-800 underline">
              privacy notice
            </Link>{" "}
            and understand that this enquiry does not constitute a request for, or an offer of, any investment product.{" "}
            <span className="text-down" aria-hidden>*</span>
          </span>
        </label>
        {show("consent") && (
          <p id="err-consent" className="mt-2 pl-7 text-[13px] text-down">
            {errors.consent}
          </p>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-6">
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex h-12 items-center gap-3 bg-teal-800 px-7 text-[14px] font-medium tracking-wide text-white transition-colors hover:bg-teal-900 disabled:opacity-60"
        >
          {state === "submitting" ? "Sending…" : "Submit enquiry"}
        </button>
        <p id="form-note" className="text-[13px] text-stone">
          <span className="text-down" aria-hidden>*</span> Required. Prototype: enquiries are validated but not sent.
        </p>
      </div>
    </form>
  );
}
