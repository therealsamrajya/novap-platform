import type { Paginated } from "@novap/shared";

// Rows to skip for a 1-based page number.
export const pageOffset = (page: number, limit: number) => (page - 1) * limit;

export const paginated = <T>(items: T[], total: number, page: number, limit: number): Paginated<T> => ({
  items,
  page,
  limit,
  total,
});
