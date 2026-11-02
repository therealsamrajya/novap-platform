// Response shapes shared by the API and the frontends.

// Every non-2xx API response has this shape (see CLAUDE.md "Error responses").
// Frontends only need to read `error`; `issues` is present on validation errors (400).
export type ApiError = {
  error: string;
  issues?: { path: PropertyKey[]; message: string }[];
};
