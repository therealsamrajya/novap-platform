import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api";

export const meKey = ["me"] as const;

// A 401 anywhere means the session ended (expired, or logged out in another tab).
// Clearing "me" makes RequireAdmin send the user back to the login page.
function onError(err: unknown) {
  if (err instanceof ApiRequestError && err.status === 401) queryClient.setQueryData(meKey, null);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      // 4xx won't change by asking again; only retry network and server errors.
      retry: (count, err) => count < 2 && !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500),
      staleTime: 10_000,
    },
  },
});
