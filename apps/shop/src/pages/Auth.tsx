import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type EmailRequested,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@novap/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { delay, lineField, Star, useReveal } from "../components/editorial";
import { Field, FormError, Notice, useTitle } from "../components/ui";
// Same decorative cut-outs as the landing page, so every use has alt="".
import blossom from "../assets/home/blossom.webp";
import toriiMist from "../assets/home/torii-mist.webp";
import { api } from "../lib/api";
import { useLogin, useMe, useRegister, useReturnTo } from "../lib/auth";
import { errorMessage, errorsFrom, validate, type FieldErrors } from "../lib/forms";
import { meKey } from "../lib/query";

// Two halves of one spread: a sand panel with the headline and the landing page's collage,
// and the form on paper. The inner widths keep both halves on the header's .shell margins.
const half = "mx-auto w-[calc(100%-2.5rem)] md:w-[calc(100%-7rem)] lg:w-[min(calc(100%-3.5rem),700px)]";
const input = `${lineField} h-12`;

function Accent({ children }: { children: ReactNode }) {
  return <span className="text-crimson italic">{children}</span>;
}

function Arrow() {
  return (
    <span aria-hidden className="transition-transform group-hover:translate-x-1">
      →
    </span>
  );
}

function AuthCard({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro?: string; children: ReactNode }) {
  const ref = useReveal("auth");
  return (
    <div ref={ref} className="grid border-b border-ink lg:min-h-[calc(100svh-6rem)] lg:grid-cols-2">
      <section className="grain relative overflow-hidden border-b border-ink bg-sand lg:border-r lg:border-b-0">
        {/* Small screens get the sun alone, cut off by the corner. */}
        <span aria-hidden data-reveal className="sun absolute -top-24 -right-24 size-56 rounded-full bg-crimson lg:hidden" />

        <div className={`${half} relative z-10 py-12 md:py-16 lg:mr-0 lg:py-20 lg:pr-14`}>
          <p data-reveal className="reveal micro flex items-center gap-3 text-ink/70">
            <Star className="size-3 text-crimson" />
            {eyebrow}
          </p>
          <h1 className="headline mt-6 text-[clamp(3rem,5.6vw,5.5rem)]">
            <span data-reveal className="mask" style={delay(100)}>
              <span>{title}</span>
            </span>
          </h1>
          {intro && (
            <p data-reveal className="reveal mt-6 max-w-sm font-editorial text-lg leading-snug md:text-xl" style={delay(300)}>
              {intro}
            </p>
          )}
        </div>

        {/* Same collage as the contact page: sun, gate in the mist, blossom branch. */}
        <div aria-hidden className="absolute right-[8%] bottom-0 hidden aspect-5/6 w-[min(48%,21rem)] lg:block">
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
      </section>

      <section className="flex items-center bg-paper">
        <div className={`${half} py-12 md:py-16 lg:ml-0 lg:py-20 lg:pl-14`}>
          <div data-reveal className="reveal max-w-md border-t border-ink pt-10 lg:mx-auto" style={delay(200)}>
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}

const formValues = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget));

export function LoginPage() {
  useTitle("Log in");
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [errors, setErrors] = useState<FieldErrors>({});

  if (me.data) return <Navigate to={returnTo} replace />;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data, errors } = validate(loginSchema, formValues(e));
    setErrors(errors ?? {});
    if (data) login.mutate(data, { onSuccess: () => navigate(returnTo, { replace: true }), onError: (err) => setErrors(errorsFrom(err)) });
  }

  return (
    <AuthCard
      eyebrow="Account"
      title={
        <>
          Log <Accent>in.</Accent>
        </>
      }
      intro="Welcome back. Your orders and details are where you left them."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <FormError message={errors.form} />
        <Field label="Email" error={errors.email}>
          <input className={input} name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input className={input} name="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} />
        </Field>
        <button className="btn btn-dark group w-full" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
          <Arrow />
        </button>
      </form>
      <div className="mt-10 flex flex-wrap justify-between gap-4 text-sm">
        <Link to="/register" state={{ from: returnTo }} className="link">
          Create an account
        </Link>
        <Link to="/forgot-password" className="link">
          Forgot your password?
        </Link>
      </div>
    </AuthCard>
  );
}

export function RegisterPage() {
  useTitle("Create an account");
  const me = useMe();
  const register = useRegister();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [errors, setErrors] = useState<FieldErrors>({});

  if (me.data && !register.isSuccess) return <Navigate to={returnTo} replace />;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = formValues(e);
    const { data, errors } = validate(registerSchema, values);
    // Not part of the API schema: only the form needs to catch a typo in the new password.
    const mismatch: FieldErrors = values.password !== values.confirm ? { confirm: "Passwords don't match" } : {};
    setErrors({ ...errors, ...mismatch });
    if (data && !Object.keys(mismatch).length) {
      register.mutate(data, { onSuccess: () => navigate(returnTo, { replace: true }), onError: (err) => setErrors(errorsFrom(err)) });
    }
  }

  return (
    <AuthCard
      eyebrow="Account"
      title={
        <>
          Create an <Accent>account.</Accent>
        </>
      }
      intro="Keep every order in one place."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-8">
        <FormError message={errors.form} />
        <Field label="Name" error={errors.name}>
          <input className={input} name="name" autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className={input} name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <div className="grid gap-8 sm:grid-cols-2">
          <Field label="Password" error={errors.password} hint="At least 10 characters">
            <input className={input} name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <input className={input} name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} />
          </Field>
        </div>
        <button className="btn btn-dark group w-full" disabled={register.isPending}>
          {register.isPending ? "Creating…" : "Create account"}
          <Arrow />
        </button>
      </form>
      <p className="mt-10 text-sm">
        Already have one?{" "}
        <Link to="/login" state={{ from: returnTo }} className="link">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  useTitle("Reset your password");
  const [errors, setErrors] = useState<FieldErrors>({});
  const request = useMutation({
    mutationFn: (input: ForgotPasswordInput) => api.post<EmailRequested>("/api/auth/password/forgot", input),
    onError: (err) => setErrors(errorsFrom(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data, errors } = validate(forgotPasswordSchema, formValues(e));
    setErrors(errors ?? {});
    if (data) request.mutate(data);
  }

  return (
    <AuthCard
      eyebrow="Account"
      title={
        <>
          Reset your <Accent>password.</Accent>
        </>
      }
      intro="We'll email you a link to choose a new password."
    >
      {request.isSuccess ? (
        // The API answers the same whether or not the account exists, so the page does too.
        <Notice>If an account uses that email, a reset link is on its way. It works for one hour.</Notice>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-8">
          <FormError message={errors.form} />
          <Field label="Email" error={errors.email}>
            <input className={input} name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
          </Field>
          <button className="btn btn-dark group w-full" disabled={request.isPending}>
            {request.isPending ? "Sending…" : "Send reset link"}
            <Arrow />
          </button>
        </form>
      )}
      <p className="mt-10 text-sm">
        <Link to="/login" className="link">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}

// Linked from the reset email: SHOP_URL/reset-password?token=...
export function ResetPasswordPage() {
  useTitle("Choose a new password");
  const token = useSearchParams()[0].get("token") ?? "";
  const qc = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const reset = useMutation({
    mutationFn: (input: ResetPasswordInput) => api.post<void>("/api/auth/password/reset", input),
    // The API ends every session, this browser's too.
    onSuccess: () => qc.setQueryData(meKey, null),
    onError: (err) => setErrors(errorsFrom(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = formValues(e);
    const { data, errors } = validate(resetPasswordSchema, { token, password: values.password });
    const mismatch: FieldErrors = values.password !== values.confirm ? { confirm: "Passwords don't match" } : {};
    // A bad token is the link's fault, not a field the user can fix.
    setErrors({ ...errors, ...mismatch, ...(errors?.token && { form: "This reset link is incomplete. Request a new one." }) });
    if (data && !Object.keys(mismatch).length) reset.mutate(data);
  }

  return (
    <AuthCard
      eyebrow="Account"
      title={
        <>
          Choose a new <Accent>password.</Accent>
        </>
      }
      intro="Saving it logs you out everywhere, this browser too."
    >
      {reset.isSuccess ? (
        <>
          <Notice>Your password has been changed and you were logged out everywhere. Log in with the new password.</Notice>
          <Link to="/login" className="btn btn-dark group mt-8 w-full">
            Log in
            <Arrow />
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-8">
          <FormError message={errors.form} />
          {errors.form && (
            <Link to="/forgot-password" className="link block text-sm">
              Request a new link
            </Link>
          )}
          <Field label="New password" error={errors.password} hint="At least 10 characters">
            <input className={input} name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <input className={input} name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} />
          </Field>
          <button className="btn btn-dark group w-full" disabled={reset.isPending}>
            {reset.isPending ? "Saving…" : "Save new password"}
            <Arrow />
          </button>
        </form>
      )}
    </AuthCard>
  );
}

// Linked from the confirmation email: SHOP_URL/verify-email?token=...
export function VerifyEmailPage() {
  useTitle("Confirm your email");
  const token = useSearchParams()[0].get("token") ?? "";
  const qc = useQueryClient();
  const verify = useMutation({
    mutationFn: () => api.post<void>("/api/auth/verify-email", { token }),
    // emailVerified changed, and guest orders with this email may now show in the account.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meKey });
      qc.invalidateQueries({ queryKey: ["account"] });
    },
  });

  // Tokens are single use, so send it exactly once (StrictMode runs effects twice in dev).
  const sent = useRef(false);
  const { mutate } = verify;
  useEffect(() => {
    if (sent.current || !token) return;
    sent.current = true;
    mutate();
  }, [token, mutate]);

  return (
    <AuthCard
      eyebrow="Account"
      title={
        <>
          Confirm your <Accent>email.</Accent>
        </>
      }
    >
      {!token || verify.isError ? (
        <>
          <FormError message={token ? errorMessage(verify.error) : "This link is incomplete."} />
          <p className="mt-6 text-sm">
            Links work for 24 hours and only once. You can send a new one from{" "}
            <Link to="/account" className="link">
              your account
            </Link>
            .
          </p>
        </>
      ) : verify.isSuccess ? (
        <>
          <Notice>Thanks, your email is confirmed.</Notice>
          <Link to="/account" className="btn btn-dark mt-8 w-full">
            Go to your account
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">Confirming…</p>
      )}
    </AuthCard>
  );
}
