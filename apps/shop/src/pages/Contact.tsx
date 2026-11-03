import { contactMessageSchema, type ContactMessageInput, type ContactReceived } from "@novap/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Field, FormError, Notice, PageHero, useTitle } from "../components/ui";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";
import { errorsFrom, validate, type FieldErrors } from "../lib/forms";

export function ContactPage() {
  useTitle("Contact");
  const me = useMe();
  const [errors, setErrors] = useState<FieldErrors>({});
  const send = useMutation({
    mutationFn: (input: ContactMessageInput) => api.post<ContactReceived>("/api/contact", input),
    onError: (err) => setErrors(errorsFrom(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { data, errors } = validate(contactMessageSchema, Object.fromEntries(form));
    setErrors(errors ?? {});
    if (data) send.mutate(data);
  }

  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch">
        Questions about a product, an order or shipping. We reply by email, usually within one business day.
      </PageHero>
      <div className="shell grid gap-12 py-16 md:grid-cols-[0.75fr_1.25fr] md:gap-[12%]">
        <div className="space-y-6 text-sm leading-relaxed text-muted">
          <h2 className="display text-4xl text-ink md:text-5xl">Write to us</h2>
          <p>For an existing order, include the order number from your confirmation email.</p>
        </div>

        {send.isSuccess ? (
          <Notice>
            <p className="font-medium text-ink">Thanks, your message is in.</p>
            <p className="mt-1">We'll reply to the email address you gave.</p>
          </Notice>
        ) : (
          // Keyed on the user so the name/email defaults fill in once /me has loaded.
          <form key={me.data?.id ?? "guest"} onSubmit={onSubmit} noValidate className="space-y-6">
            <FormError message={errors.form} />
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Name" error={errors.name}>
                <input className="input" name="name" autoComplete="name" defaultValue={me.data?.name} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input
                  className="input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={me.data?.email}
                  aria-invalid={!!errors.email}
                />
              </Field>
            </div>
            <Field label="Subject" error={errors.subject}>
              <input className="input" name="subject" aria-invalid={!!errors.subject} />
            </Field>
            <Field label="Message" error={errors.message}>
              <textarea className="input h-auto min-h-40 py-3" name="message" aria-invalid={!!errors.message} />
            </Field>
            {/* Honeypot: hidden from people (and screen readers); bots that fill it are ignored by the API. */}
            <div aria-hidden className="absolute -left-[9999px]">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <button className="btn btn-dark" disabled={send.isPending}>
              {send.isPending ? "Sending…" : "Send message"} <span aria-hidden>→</span>
            </button>
          </form>
        )}
      </div>
    </>
  );
}
