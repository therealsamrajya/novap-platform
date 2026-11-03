import type { AdminCategory } from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// For category pickers and filters. Same key as the Categories page, so edits there refresh these.
export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<AdminCategory[]>("/api/admin/categories"),
  });
