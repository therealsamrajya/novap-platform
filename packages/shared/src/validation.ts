// Message only for a missing field; every other problem keeps its own message.
// (A plain `{ error: "..." }` on the schema would also replace the max-length message.)
export const required = (message: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? message : undefined),
});
