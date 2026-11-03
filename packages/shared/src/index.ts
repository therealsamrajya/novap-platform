// Shared between api, shop and admin.
// One source of truth for types + validation: the API validates with these
// schemas, the frontends use the same schemas for forms and the inferred types.

export * from "./admin";
export * from "./api";
export * from "./auth";
export * from "./catalog";
export * from "./contact";
export * from "./money";
export * from "./schemas";
export * from "./slug";
export * from "./validation";
