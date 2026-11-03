import type { LoginInput, User } from "@novap/shared";
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

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/api/auth/logout"),
    // Drop all cached admin data, not only "me", so nothing lingers for the next login.
    onSettled: () => {
      qc.clear();
      qc.setQueryData(meKey, null);
    },
  });
}

// The API checks the admin role on every /api/admin request (401/403); this guard only
// decides what to render, so a customer login never sees an empty dashboard.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;
  if (me.isError) return <p className="p-8 text-sm text-red-700">{me.error.message}</p>;
  if (!me.data || me.data.role !== "admin") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
