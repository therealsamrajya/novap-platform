import { useSearchParams } from "react-router";

// List filters live in the URL (?page=2&q=...), so reload, back and shared links keep them.
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;

  // Changing a filter goes back to page 1; otherwise you could land past the last page.
  const set = (changes: Partial<Record<K | "page", string | number>>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!("page" in changes)) next.delete("page");
      for (const [k, v] of Object.entries(changes)) {
        if (v === "" || v === undefined || (k === "page" && v === 1)) next.delete(k);
        else next.set(k, String(v));
      }
      return next;
    });

  return { page, ...values, set };
}
