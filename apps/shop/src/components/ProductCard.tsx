import type { ProductSummary } from "@novap/shared";
import { Link } from "react-router";
import { assetUrl } from "../lib/api";
import { Price } from "./ui";

export function ProductCard({ product }: { product: ProductSummary }) {
  const tag = !product.inStock ? "Sold out" : product.onSale ? "Sale" : product.featured ? "Featured" : null;
  return (
    <article className="group min-w-0">
      <Link to={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[1.04] overflow-hidden bg-stone">
          {product.image ? (
            <img
              src={assetUrl(product.image.url)}
              alt={product.image.alt || product.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            // No photo yet: a quiet monogram instead of a broken image.
            <div className="grid size-full place-items-center text-8xl font-medium text-black/5">Ō</div>
          )}
          {tag && (
            <span
              className={`micro absolute top-4 left-4 px-3 py-2 text-[9px] ${
                tag === "Sold out" ? "bg-ink/85 text-white" : "bg-paper/90 text-ink"
              }`}
            >
              {tag}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-4 pt-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium tracking-tight md:text-xl">{product.name}</h3>
            {product.subtitle && <p className="mt-1 truncate text-xs text-muted">{product.subtitle}</p>}
          </div>
          <span aria-hidden className="text-xl font-light transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="micro text-[9px] text-muted">{product.category?.name ?? "NŌVAP"}</span>
          <Price cents={product.priceFromCents} from />
        </div>
      </Link>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
