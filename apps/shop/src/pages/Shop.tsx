import { productSortValues, type Category, type Paginated, type ProductSort, type ProductSummary } from "@novap/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ProductGrid } from "../components/ProductCard";
import { PageHero, Pagination, QueryState, useTitle } from "../components/ui";
import { api } from "../lib/api";
import { useListParams } from "../lib/list-params";

const LIMIT = 12;

const sortLabels: Record<ProductSort, string> = {
  newest: "Newest",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
  name: "Name",
};

export function ShopPage() {
  const { page, q, category, sort, inStock, set } = useListParams(["q", "category", "sort", "inStock"] as const);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });
  const current = categories.data?.find((c) => c.slug === category);
  useTitle(current?.name ?? "Shop");

  // Search as you type: the box is local state, pushed to the URL 300ms after typing stops.
  // Clearing the box shows everything again without needing Enter.
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]); // URL changed elsewhere (Clear filters, back button)
  useEffect(() => {
    const next = search.trim();
    if (next === q) return;
    const id = setTimeout(() => set({ q: next }, { replace: true }), 300);
    return () => clearTimeout(id);
  }, [search, q]); // `set` left out: it is recreated every render

  const products = useQuery({
    queryKey: ["products", { page, q, category, sort, inStock }],
    queryFn: () =>
      api.get<Paginated<ProductSummary>>("/api/products", { page, limit: LIMIT, q, category, sort, inStock }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHero eyebrow="Shop" title={current?.name ?? "The collection"}>
        Every price is in AUD and includes GST.
      </PageHero>

      <div className="shell py-12">
        <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Category">
          <Chip active={!category} onClick={() => set({ category: "" })}>
            All
          </Chip>
          {categories.data
            ?.filter((c) => c.productCount > 0)
            .map((c) => (
              <Chip key={c.id} active={c.slug === category} onClick={() => set({ category: c.slug })}>
                {c.name}
              </Chip>
            ))}
        </div>

        <div className="mb-10 flex flex-wrap items-end gap-4 border-b border-line pb-8">
          <form
            className="min-w-56 flex-1 md:max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              set({ q: search.trim() });
            }}
          >
            <label className="label" htmlFor="shop-search">
              Search
            </label>
            <input
              id="shop-search"
              className="input"
              name="q"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or description"
            />
          </form>
          <div className="min-w-48">
            <label className="label" htmlFor="shop-sort">
              Sort
            </label>
            <select id="shop-sort" className="input" value={sort || "newest"} onChange={(e) => set({ sort: e.target.value === "newest" ? "" : e.target.value })}>
              {productSortValues.map((s) => (
                <option key={s} value={s}>
                  {sortLabels[s]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex h-12 items-center gap-2 text-sm">
            <input type="checkbox" checked={inStock === "true"} onChange={(e) => set({ inStock: e.target.checked ? "true" : "" })} />
            In stock only
          </label>
          {products.data && (
            <span className="micro ml-auto pb-4 text-muted">
              {products.data.total} {products.data.total === 1 ? "piece" : "pieces"}
            </span>
          )}
        </div>

        <QueryState isPending={products.isPending} error={products.error}>
          {products.data?.items.length ? (
            <ProductGrid products={products.data.items} />
          ) : (
            <div className="border border-dashed border-neutral-400 p-10 text-muted">
              Nothing matches these filters.{" "}
              <button className="link" onClick={() => set({ q: "", category: "", inStock: "" })}>
                Clear filters
              </button>
            </div>
          )}
          {products.data && <Pagination page={page} limit={LIMIT} total={products.data.total} onPage={(page) => set({ page })} />}
        </QueryState>
      </div>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`micro border px-5 py-3 ${active ? "border-ink bg-ink text-white" : "border-neutral-300 hover:border-ink"}`}
    >
      {children}
    </button>
  );
}
