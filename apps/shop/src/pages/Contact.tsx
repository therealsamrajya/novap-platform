import { contactMessageSchema, type ContactMessageInput, type ContactReceived } from "@novap/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { delay, lineField as field, pad, Star, useReveal } from "../components/editorial";
import { Field, FormError, useTitle } from "../components/ui";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";
import { errorsFrom, validate, type FieldErrors } from "../lib/forms";
// Same decorative cut-outs as the landing page, so every use has alt="".
import blossom from "../assets/home/blossom.webp";
import toriiMist from "../assets/home/torii-mist.webp";

const steps = [
  { title: "Say what it's about", body: "A product, an order or shipping. One subject per message keeps the answer short." },
  { title: "Add your order number", body: "For an existing order, include the order number from your confirmation email." },
  { title: "We reply by email", body: "Usually within one business day, to the address you give here." },
];

export function ContactPage() {
  useTitle("Contact");
  const me = useMe();
  const [errors, setErrors] = useState<FieldErrors>({});
  const send = useMutation({
    mutationFn: (input: ContactMessageInput) => api.post<ContactReceived>("/api/contact", input),
    onError: (err) => setErrors(errorsFrom(err)),
  });
  const ref = useReveal("contact");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { data, errors } = validate(contactMessageSchema, Object.fromEntries(form));
    setErrors(errors ?? {});
    if (data) send.mutate(data);
  }

  return (
    <div ref={ref}>
      <section className="grain relative overflow-hidden border-b border-ink bg-sand">
        {/* Layout-grid hairline, like a crop mark on a proof sheet. */}
        <span aria-hidden data-reveal className="rule-y absolute inset-y-0 right-[26%] hidden w-px bg-ink/15 lg:block" style={delay(200)} />

        <div className="shell relative grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="relative z-10">
            <p data-reveal className="reveal micro flex items-center gap-3 text-ink/70">
              <Star className="size-3 text-crimson" />
              Contact
            </p>
            <h1 className="headline mt-6 text-[clamp(3.25rem,7.5vw,6.5rem)]">
              <span data-reveal className="mask" style={delay(100)}>
                <span>
                  Get in <span className="text-crimson italic">touch.</span>
                </span>
              </span>
            </h1>
            <p data-reveal className="reveal mt-6 max-w-md font-editorial text-lg leading-snug md:text-xl" style={delay(300)}>
              Questions about a product, an order or shipping. We reply by email, usually within one business day.
            </p>
          </div>

          {/* The catalogue hero's collage with a different subject: sun, gate in the mist, blossom branch. */}
          <div aria-hidden className="relative hidden aspect-5/6 lg:block">
            <div data-reveal className="sun absolute top-[3%] left-[4%] aspect-square w-[82%] rounded-full bg-crimson" style={delay(250)} />
            <div className="halftone absolute right-0 bottom-[6%] h-[38%] w-[58%] mask-[linear-gradient(to_top_left,black,transparent_75%)]" />
            <div data-reveal className="reveal absolute bottom-[4%] left-[-18%] w-[136%]" style={delay(450)}>
              <img src={toriiMist} alt="" className="w-full max-w-none" />
            </div>
            <div data-reveal className="reveal absolute top-[-3%] right-[-5%] w-[44%]" style={delay(800)}>
              <img src={blossom} alt="" className="w-full animate-drift" />
            </div>
            <Star className="absolute top-[30%] left-[-4%] size-5 animate-drift text-ink" />
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="shell grid gap-14 py-16 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-[10%]">
          <div>
            <p data-reveal className="reveal micro text-crimson">
              Write to us
            </p>
            <h2 className="headline mt-6 text-5xl md:text-6xl">
              <span data-reveal className="mask" style={delay(80)}>
                <span>Three lines</span>
              </span>
              <span data-reveal className="mask" style={delay(180)}>
                <span>
                  are <span className="text-crimson italic">plenty.</span>
                </span>
              </span>
            </h2>

            <ol className="mt-12">
              {steps.map((s, i) => (
                <li key={s.title} className="group relative grid grid-cols-[3.5rem_1fr] gap-4 py-6">
                  <span aria-hidden data-reveal className="rule-x absolute inset-x-0 top-0 h-px bg-ink" style={delay(i * 150)} />
                  {/* A second, red rule wipes over the black one while the row is hovered. */}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-crimson transition-transform duration-700 ease-editorial group-hover:scale-x-100" />
                  <span
                    data-reveal
                    className="reveal headline text-4xl text-ink/15 tabular-nums transition-colors duration-500 group-hover:text-crimson"
                    style={delay(i * 150 + 100)}
                  >
                    {pad(i + 1)}
                  </span>
                  <div data-reveal className="reveal" style={delay(i * 150 + 150)}>
                    <h3 className="font-editorial text-2xl">{s.title}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/70">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {send.isSuccess ? (
            // Not a [data-reveal]: it mounts after the observer has run, so it animates itself.
            <div role="status" className="relative grid animate-slide-in content-start justify-items-start gap-6 self-start overflow-hidden border border-ink/25 p-8 md:p-14">
              <span aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full bg-crimson" />
              <Star className="relative size-4 text-crimson" />
              <p className="headline relative text-5xl md:text-6xl">
                Message <span className="text-crimson italic">sent.</span>
              </p>
              <p className="relative max-w-sm leading-relaxed text-ink/70">Thanks, your message is in. We'll reply to the email address you gave.</p>
              <Link to="/shop" className="btn btn-dark group relative">
                Back to the shop
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          ) : (
            // Keyed on the user so the name/email defaults fill in once /me has loaded.
            <form
              key={me.data?.id ?? "guest"}
              data-reveal
              onSubmit={onSubmit}
              noValidate
              className="reveal space-y-9 self-start border-t border-ink pt-10"
              style={delay(200)}
            >
              <FormError message={errors.form} />
              <div className="grid gap-9 sm:grid-cols-2">
                <Field label="Name" error={errors.name}>
                  <input className={`${field} h-12`} name="name" autoComplete="name" defaultValue={me.data?.name} aria-invalid={!!errors.name} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input
                    className={`${field} h-12`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={me.data?.email}
                    aria-invalid={!!errors.email}
                  />
                </Field>
              </div>
              <Field label="Subject" error={errors.subject} hint="An order number, or the piece you're asking about">
                <input className={`${field} h-12`} name="subject" aria-invalid={!!errors.subject} />
              </Field>
              <Field label="Message" error={errors.message}>
                <textarea className={`${field} min-h-44 resize-y py-3 leading-snug`} name="message" aria-invalid={!!errors.message} />
              </Field>
              {/* Honeypot: hidden from people (and screen readers); bots that fill it are ignored by the API. */}
              <div aria-hidden className="absolute -left-[9999px]">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <button className="btn btn-dark group" disabled={send.isPending}>
                {send.isPending ? "Sending…" : "Send message"}
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
