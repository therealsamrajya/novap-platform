import type { LoginInput, RegisterInput, User } from "@novap/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { api, ApiRequestError } from "./api";
import { meKey } from "./query";

// The logged-in user, or null. A 401 from /me just means "not logged in".
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api.get<User>("/api/auth/me");
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<User>("/api/auth/login", input),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<User>("/api/auth/register", input),
    onSuccess: (user) => qc.setQueryData(meKey, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/api/auth/logout"),
    // Account data (orders) must not linger for the next person on this browser.
    onSettled: () => {
      qc.removeQueries({ queryKey: ["account"] });
      qc.setQueryData(meKey, null);
    },
  });
}

// Account pages only. Sends guests to /login and brings them back afterwards.
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <p className="shell py-24 text-sm text-muted">Loading…</p>;
  if (me.isError) return <p className="shell py-24 text-sm text-red-700">{me.error.message}</p>;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

// Where to go after logging in: back to the page that asked for it, if any.
export const useReturnTo = () => (useLocation().state as { from?: string } | null)?.from ?? "/account";
