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
import { Field, FormError, Notice, useTitle } from "../components/ui";
import { api } from "../lib/api";
import { useLogin, useMe, useRegister, useReturnTo } from "../lib/auth";
import { errorMessage, errorsFrom, validate, type FieldErrors } from "../lib/forms";
import { meKey } from "../lib/query";

function AuthCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="shell py-16 md:py-24">
      <div className="mx-auto max-w-xl bg-sand p-8 md:p-12">
        <p className="micro text-muted">{eyebrow}</p>
        <h1 className="display mt-4 mb-8 text-4xl md:text-5xl">{title}</h1>
        {children}
      </div>
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
    <AuthCard eyebrow="Account" title="Log in">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={errors.form} />
        <Field label="Email" error={errors.email}>
          <input className="input bg-paper" name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input className="input bg-paper" name="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} />
        </Field>
        <button className="btn btn-dark w-full" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <div className="mt-8 flex flex-wrap justify-between gap-4 text-sm">
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
    <AuthCard eyebrow="Account" title="Create an account">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError message={errors.form} />
        <Field label="Name" error={errors.name}>
          <input className="input bg-paper" name="name" autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input bg-paper" name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 10 characters">
          <input className="input bg-paper" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input className="input bg-paper" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} />
        </Field>
        <button className="btn btn-dark w-full" disabled={register.isPending}>
          {register.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-8 text-sm">
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
    <AuthCard eyebrow="Account" title="Reset your password">
      {request.isSuccess ? (
        // The API answers the same whether or not the account exists, so the page does too.
        <Notice>If an account uses that email, a reset link is on its way. It works for one hour.</Notice>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <p className="text-sm text-muted">We'll email you a link to choose a new password.</p>
          <FormError message={errors.form} />
          <Field label="Email" error={errors.email}>
            <input className="input bg-paper" name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
          </Field>
          <button className="btn btn-dark w-full" disabled={request.isPending}>
            Send reset link
          </button>
        </form>
      )}
      <p className="mt-8 text-sm">
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
    <AuthCard eyebrow="Account" title="Choose a new password">
      {reset.isSuccess ? (
        <>
          <Notice>Your password has been changed and you were logged out everywhere. Log in with the new password.</Notice>
          <Link to="/login" className="btn btn-dark mt-8 w-full">
            Log in
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormError message={errors.form} />
          {errors.form && (
            <Link to="/forgot-password" className="link block text-sm">
              Request a new link
            </Link>
          )}
          <Field label="New password" error={errors.password} hint="At least 10 characters">
            <input className="input bg-paper" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <input className="input bg-paper" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} />
          </Field>
          <button className="btn btn-dark w-full" disabled={reset.isPending}>
            Save new password
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
    <AuthCard eyebrow="Account" title="Confirm your email">
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
