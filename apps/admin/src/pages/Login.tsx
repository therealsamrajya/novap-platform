import { loginSchema } from "@novap/shared";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Field, FormError } from "../components/ui";
import { useLogin, useLogout, useMe } from "../lib/auth";
import { errorsFrom, validate, type FieldErrors } from "../lib/forms";

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const logout = useLogout();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [errors, setErrors] = useState<FieldErrors>({});

  if (me.data?.role === "admin") return <Navigate to={from} replace />;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { data, errors } = validate(loginSchema, { email: form.get("email"), password: form.get("password") });
    setErrors(errors ?? {});
    if (!data) return;
    login.mutate(data, {
      onSuccess: (user) => {
        if (user.role === "admin") return navigate(from, { replace: true });
        // A customer account is logged in now; end that session so it doesn't linger in this browser.
        logout.mutate();
        setErrors({ form: "This account doesn't have admin access." });
      },
      onError: (err) => setErrors(errorsFrom(err)),
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={onSubmit} noValidate className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-lg font-semibold">
          NŌVAP <span className="font-normal text-zinc-500">admin</span>
        </h1>
        <FormError message={errors.form} />
        <Field label="Email" error={errors.email}>
          <input className="input" name="email" type="email" autoComplete="username" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password}>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
          />
        </Field>
        <button className="btn btn-primary w-full justify-center" disabled={login.isPending}>
          {login.isPending ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
