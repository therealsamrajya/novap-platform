import type { Category, Paginated, ProductSummary } from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ProductGrid } from "../components/ProductCard";
import { useTitle } from "../components/ui";
import { api } from "../lib/api";

export function HomePage() {
  useTitle(undefined);
  const featured = useQuery({
    queryKey: ["products", { featured: true }],
    queryFn: () => api.get<Paginated<ProductSummary>>("/api/products", { featured: "true", limit: 6 }),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });
  // Empty categories would lead to an empty page.
  const shownCategories = categories.data?.filter((c) => c.productCount > 0).slice(0, 3) ?? [];

  return (
    <>
      <section className="relative overflow-hidden bg-[#0c0d0e] text-white">
        {/* Typographic hero: a giant faded monogram stands in for photography. */}
        <span aria-hidden className="pointer-events-none absolute -right-10 -bottom-40 text-[28rem] leading-none font-medium text-white/[0.04] md:text-[40rem]">
          Ō
        </span>
        <div className="shell relative py-28 md:py-40">
          <p className="micro text-neutral-400">The NŌVAP collection</p>
          <h1 className="display mt-8 max-w-4xl text-6xl md:text-8xl lg:text-9xl">
            Made with <em className="font-serif font-normal">intent.</em>
          </h1>
          <p className="mt-8 max-w-sm leading-relaxed text-neutral-400">
            A small, considered range. Every piece listed with its full details, priced in AUD with GST included.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/shop" className="btn btn-light">
              Shop the collection <span aria-hidden>→</span>
            </Link>
            <Link to="/contact" className="btn border-white/40 text-white hover:bg-white hover:text-ink">
              Ask a question
            </Link>
          </div>
        </div>
      </section>

      <section className="shell py-20 md:py-28">
        <div className="mb-10 flex items-end justify-between gap-6 border-b border-line pb-6">
          <h2 className="display text-4xl md:text-6xl">Featured</h2>
          <Link to="/shop" className="micro border-b border-ink pb-2">
            View all
          </Link>
        </div>
        {featured.data?.items.length ? (
          <ProductGrid products={featured.data.items} />
        ) : (
          !featured.isPending && (
            <p className="text-muted">
              Nothing featured right now. <Link to="/shop" className="link">Browse everything</Link>.
            </p>
          )
        )}
      </section>

      {shownCategories.length > 0 && (
        <section className="shell pb-20 md:pb-28">
          <h2 className="micro mb-6 text-muted">Browse by category</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {shownCategories.map((c, i) => (
              <Link
                key={c.id}
                to={`/shop?category=${encodeURIComponent(c.slug)}`}
                className={`group relative flex h-60 flex-col justify-between overflow-hidden p-7 ${
                  ["bg-stone", "bg-[#c8c3bb]", "bg-[#222] text-white"][i]
                }`}
              >
                <span className="micro">
                  {String(i + 1).padStart(2, "0")} · {c.productCount} {c.productCount === 1 ? "piece" : "pieces"}
                </span>
                <span className="flex items-end justify-between">
                  <span className="text-3xl font-medium tracking-tight">{c.name}</span>
                  <span aria-hidden className="text-2xl transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                    ↗
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="bg-ink py-24 text-paper">
        <div className="shell flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
          <h2 className="display max-w-3xl text-5xl md:text-7xl">
            Questions before you <em className="font-serif font-normal">order?</em>
          </h2>
          <Link to="/contact" className="btn btn-light">
            Contact us <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
