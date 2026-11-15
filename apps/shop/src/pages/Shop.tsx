import { productSortValues, type Category, type Paginated, type ProductSort, type ProductSummary } from "@novap/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AskBand, delay, Star, useReveal } from "../components/editorial";
import { ProductGrid, ProductGridSkeleton } from "../components/ProductCard";
import { useTitle } from "../components/ui";
import { api } from "../lib/api";
import { useListParams } from "../lib/list-params";
// Same decorative cut-outs as the landing page, so every use has alt="".
import blossom from "../assets/home/blossom.webp";
import bust from "../assets/home/bust.webp";
import pagoda from "../assets/home/pagoda.webp";
import street from "../assets/home/street.webp";
import torii from "../assets/home/torii.webp";

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
  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const pages = Math.ceil(total / LIMIT);
  const first = (page - 1) * LIMIT + 1;
  const categoryOptions: { slug: string; name: string; count?: number }[] = [
    { slug: "", name: "Everything" },
    // Empty categories would lead to an empty page.
    ...(categories.data ?? []).filter((c) => c.productCount > 0).map((c) => ({ slug: c.slug, name: c.name, count: c.productCount })),
  ];

  const filtered = Boolean(q || category || inStock);
  const clear = () => set({ q: "", category: "", inStock: "" });

  // A new page starts at the top of the results, not wherever the pager was.
  const results = useRef<HTMLDivElement>(null);
  const goToPage = (next: number) => {
    set({ page: next });
    results.current?.scrollIntoView({ block: "start" });
  };

  // New cards (another page, another filter) are new elements, so they need observing again.
  const ref = useReveal(items.map((p) => p.id).join("-"));

  return (
    <div ref={ref}>
      <section className="grain relative overflow-hidden border-b border-ink bg-sand">
        {/* Layout-grid hairline, like a crop mark on a proof sheet. */}
        <span aria-hidden data-reveal className="rule-y absolute inset-y-0 right-[26%] hidden w-px bg-ink/15 lg:block" style={delay(200)} />

        <div className="shell relative grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="relative z-10">
            <p data-reveal className="reveal micro flex items-center gap-3 text-ink/70">
              <Star className="size-3 text-crimson" />
              {current ? "Collection" : "The NŌVAP catalogue"}
            </p>
            <h1 className="headline mt-6 text-[clamp(3.25rem,7.5vw,6.5rem)]">
              <span data-reveal className="mask" style={delay(100)}>
                <span>
                  {current ? "Shop" : "The"} <span className="text-crimson italic">{current?.name ?? "Collection"}.</span>
                </span>
              </span>
            </h1>
            <p data-reveal className="reveal mt-6 max-w-md font-editorial text-lg leading-snug md:text-xl" style={delay(300)}>
              Every piece, in one place. Prices are in AUD and include GST.
            </p>
          </div>

          {/* The landing page hero's collage, smaller: sun, temple, statue, blossom branch. */}
          <div aria-hidden className="relative hidden aspect-5/6 lg:block">
            <div data-reveal className="sun absolute top-[3%] left-[4%] aspect-square w-[82%] rounded-full bg-crimson" style={delay(250)} />
            <div className="halftone absolute right-0 bottom-[6%] h-[38%] w-[58%] mask-[linear-gradient(to_top_left,black,transparent_75%)]" />
            <div data-reveal className="reveal absolute right-[-7%] bottom-[5%] w-[64%]" style={delay(450)}>
              <img src={pagoda} alt="" className="w-full mask-[linear-gradient(to_bottom,black_70%,transparent)]" />
            </div>
            <div data-reveal className="reveal absolute bottom-0 left-[-6%] w-[80%]" style={delay(600)}>
              <img src={bust} alt="" className="w-full mask-[linear-gradient(to_bottom,black_78%,transparent)]" />
            </div>
            <div data-reveal className="reveal absolute top-[-3%] right-[-5%] w-[44%]" style={delay(800)}>
              <img src={blossom} alt="" className="w-full animate-drift" />
            </div>
            <Star className="absolute top-[30%] left-[-4%] size-5 animate-drift text-ink" />
          </div>
        </div>
      </section>

      <div className="bg-sand">
        <div className="shell grid gap-10 pt-10 pb-24 md:pt-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
          {/* Filter rail: beside the grid on desktop, above it on small screens. */}
          <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100svh-9rem)] lg:self-start lg:overflow-y-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                set({ q: search.trim() });
              }}
            >
              <label className="label text-ink/60" htmlFor="shop-search">
                Search
              </label>
              <input
                id="shop-search"
                className="h-11 w-full border-b border-ink/30 bg-transparent font-editorial text-xl outline-none placeholder:text-ink/35 placeholder:italic focus:border-crimson"
                name="q"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or description"
              />
            </form>

            <div className="mt-8" role="group" aria-labelledby="shop-categories">
              <p id="shop-categories" className="label text-ink/60">
                Category
              </p>
              {/* A list on desktop; a row of chips that wraps when the rail sits above the grid. */}
              <div className="flex flex-wrap gap-2 lg:block lg:border-t lg:border-ink">
                {categoryOptions.map((c) => {
                  const active = c.slug === category;
                  return (
                    <button
                      key={c.slug}
                      aria-pressed={active}
                      onClick={() => set({ category: c.slug })}
                      className={`group/row flex items-baseline gap-3 border px-4 py-2.5 text-left lg:w-full lg:border-0 lg:border-b lg:border-ink/15 lg:px-0 lg:py-3 ${
                        active ? "border-ink max-lg:bg-ink max-lg:text-paper" : "border-ink/25"
                      }`}
                    >
                      <span
                        className={`min-w-0 truncate font-editorial text-lg transition-[translate,color] duration-500 ease-editorial lg:text-xl lg:group-hover/row:translate-x-1.5 ${
                          active ? "italic lg:text-crimson" : ""
                        }`}
                      >
                        {c.name}
                      </span>
                      {c.count != null && <span className="micro ml-auto opacity-50 tabular-nums">{c.count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="micro mt-8 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-4 accent-crimson"
                checked={inStock === "true"}
                onChange={(e) => set({ inStock: e.target.checked ? "true" : "" })}
              />
              In stock only
            </label>
            {filtered && (
              <button className="micro mt-7 border-b border-ink pb-1.5 hover:border-crimson hover:text-crimson" onClick={clear}>
                Clear filters ×
              </button>
            )}

            {/* Pinboard under the filters: a taped print with a branch laid across its corner.
                Only on screens tall enough to show it without the rail having to scroll. */}
            <div aria-hidden className="relative mt-14 hidden h-48 lg:[@media(min-height:880px)]:block">
              <div className="absolute top-2 left-1 w-44 -rotate-3 transition-transform duration-700 ease-editorial hover:rotate-0">
                <img src={street} alt="" className="w-full drop-shadow-[0_14px_18px_rgb(0_0_0/0.3)]" />
                <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 bg-champagne/80 shadow-sm" />
              </div>
              <img src={blossom} alt="" className="pointer-events-none absolute -top-7 left-28 w-28 animate-drift" />
            </div>
          </aside>

          {/* scroll-mt clears the sticky masthead when a new page scrolls this into view. */}
          <div ref={results} className="min-w-0 scroll-mt-28">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
              <p className="micro text-ink/60" aria-live="polite">
                {products.isPending
                  ? "Loading…"
                  : total === 0
                    ? "No pieces"
                    : `Showing ${first}–${first + items.length - 1} of ${total} ${total === 1 ? "piece" : "pieces"}`}
              </p>
              <div className="flex items-center gap-3">
                <label className="micro text-ink/60" htmlFor="shop-sort">
                  Sort by
                </label>
                <select
                  id="shop-sort"
                  className="h-9 cursor-pointer border-b border-ink/30 bg-transparent text-sm outline-none focus:border-crimson"
                  value={sort || "newest"}
                  onChange={(e) => set({ sort: e.target.value === "newest" ? "" : e.target.value })}
                >
                  {productSortValues.map((s) => (
                    <option key={s} value={s}>
                      {sortLabels[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {products.isPending ? (
              <ProductGridSkeleton count={6} />
            ) : products.error ? (
              <p className="py-16 text-sm text-red-700">{products.error.message}</p>
            ) : items.length ? (
              // Dimmed while the next page or filter loads behind the previous results.
              <div className={`transition-opacity duration-300 ${products.isPlaceholderData ? "opacity-50" : ""}`}>
                <ProductGrid products={items} />
              </div>
            ) : (
              <div className="relative grid justify-items-start gap-6 overflow-hidden border border-ink/25 p-8 md:p-14">
                <span aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full bg-crimson" />
                <img src={torii} alt="" className="pointer-events-none absolute right-[-2%] bottom-0 hidden h-[78%] w-auto max-w-none mix-blend-multiply md:block" />
                <Star className="relative size-4 text-crimson" />
                <p className="headline relative text-5xl md:text-6xl">
                  Nothing <span className="text-crimson italic">here.</span>
                </p>
                <p className="relative max-w-sm leading-relaxed text-ink/70">No piece matches these filters. Loosen them and the whole collection comes back.</p>
                <button className="btn btn-dark relative" onClick={clear}>
                  Clear filters
                </button>
              </div>
            )}
            {/* Shown even for a single page (arrows disabled), so the place to turn pages is
                always where shoppers expect it. */}
            {pages >= 1 && <Pager page={page} pages={pages} onPage={goToPage} />}
          </div>
        </div>
      </div>

      {/* Closing band, the same on every page of results. */}
      <AskBand />
    </div>
  );
}

// First, last, and the pages around the current one; "gap" marks a run that was left out.
function pageList(page: number, pages: number) {
  const out: (number | "gap")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  }
  return out;
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const arrow = "micro flex h-11 items-center gap-3 px-2 disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:text-crimson";
  return (
    <nav aria-label="Pages" className="mt-16 flex items-center justify-between gap-4 border-t border-ink pt-6">
      <button className={arrow} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <span aria-hidden className="text-xl leading-none">
          ←
        </span>
        <span className="max-sm:sr-only">Previous</span>
      </button>
      <ol className="flex items-center gap-1.5">
        {pageList(page, pages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-ink/40">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
                className={`grid size-11 place-items-center font-editorial text-lg tabular-nums transition-colors ${
                  p === page ? "bg-ink text-paper" : "hover:bg-ink/10"
                }`}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ol>
      <button className={arrow} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <span className="max-sm:sr-only">Next</span>
        <span aria-hidden className="text-xl leading-none">
          →
        </span>
      </button>
    </nav>
  );
}
