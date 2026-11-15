import type { ProductSummary } from "@novap/shared";
import { Link } from "react-router";
import { assetUrl } from "../lib/api";
import { delay } from "./editorial";
import { Price } from "./ui";

// A piece with no photo yet gets a printed plate instead: a coloured ground, a sun and the
// piece's initial set large. Type and shapes only, so nothing on it can be mistaken for the
// product. Full class names, so Tailwind's scanner can see them.
const plates = [
  { theme: "bg-ink text-paper", sun: "bg-crimson top-[-16%] right-[-18%] w-[68%]" },
  { theme: "bg-stone text-ink", sun: "bg-crimson top-[16%] left-[18%] w-[50%]" },
  { theme: "bg-crimson text-paper", sun: "bg-ink bottom-[-24%] left-[-16%] w-[82%]" },
  { theme: "bg-champagne text-ink", sun: "bg-paper top-[12%] right-[12%] w-[42%]" },
  { theme: "bg-[#22201e] text-paper", sun: "bg-crimson bottom-[14%] right-[-22%] w-[62%]" },
];

// Picked from the slug, so a piece keeps its plate whatever the page, sort or filter.
export function plateFor(slug: string) {
  let sum = 0;
  for (const ch of slug) sum += ch.charCodeAt(0);
  return plates[sum % plates.length]!;
}

// Every card is the same size, so the grid stays even on any page of results. The photo is
// cropped to the 4:5 frame (object-cover), never stretched, whatever shape was uploaded.
// `index` only staggers the scroll reveal (the page must call useReveal).
export function ProductCard({ product, index }: { product: ProductSummary; index: number }) {
  const tag = !product.inStock ? "Sold out" : product.onSale ? "Sale" : product.featured ? "Featured" : null;
  const plate = plateFor(product.slug);
  return (
    // Stagger by column, not by position, so the last card on a page doesn't wait seconds.
    <article data-reveal className="reveal group min-w-0" style={delay((index % 3) * 100)}>
      <Link to={`/products/${product.slug}`} className="block">
        <div className={`relative aspect-4/5 overflow-hidden ${product.image ? "bg-stone text-ink" : plate.theme}`}>
          {product.image ? (
            <img
              src={assetUrl(product.image.url)}
              alt={product.image.alt || product.name}
              loading="lazy"
              className={`absolute inset-0 size-full object-cover transition-transform duration-1000 ease-editorial group-hover:scale-105 ${
                product.inStock ? "" : "opacity-70 grayscale"
              }`}
            />
          ) : (
            <>
              <span
                aria-hidden
                className={`absolute aspect-square rounded-full transition-transform duration-1000 ease-editorial group-hover:scale-110 ${plate.sun}`}
              />
              <span aria-hidden className="absolute inset-2 border border-current/20 sm:inset-3" />
              <span aria-hidden className="headline absolute bottom-5 left-4 text-[5.5rem] italic sm:bottom-7 sm:left-6 sm:text-[9rem]">
                {product.name.charAt(0)}
              </span>
              <span className="micro absolute top-5 left-5 text-[9px] opacity-70 sm:top-7 sm:left-7">Photo to come</span>
            </>
          )}
          {tag && (
            <span
              className={`micro absolute top-4 right-4 rounded-full px-3 py-1.5 text-[9px] text-paper ring-1 ring-paper/25 sm:top-6 sm:right-6 ${
                tag === "Sale" ? "bg-crimson" : "bg-ink"
              }`}
            >
              {tag}
            </span>
          )}
          {/* Slides up over the foot of the frame on hover or keyboard focus. */}
          <span
            aria-hidden
            className="micro absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between bg-ink px-4 py-4 text-paper transition-transform duration-500 ease-editorial group-hover:translate-y-0 group-has-focus-visible:translate-y-0"
          >
            View piece
            <span className="text-base leading-none">→</span>
          </span>
        </div>

        <div className="relative mt-4 border-t border-ink/25 pt-3">
          {/* A red rule wipes over the hairline while the card is hovered. */}
          <span aria-hidden className="absolute inset-x-0 -top-px h-px origin-left scale-x-0 bg-crimson transition-transform duration-700 ease-editorial group-hover:scale-x-100" />
          <p className="micro truncate text-[9px] text-crimson">{product.category?.name ?? "NŌVAP"}</p>
          <h3 className="mt-2 truncate font-editorial text-xl leading-tight tracking-tight transition-colors duration-300 group-hover:text-crimson sm:text-2xl">
            {product.name}
          </h3>
          <div className="mt-1.5 flex flex-col gap-x-4 gap-y-1 text-sm sm:flex-row sm:items-baseline sm:justify-between">
            <span className="truncate text-ink/60">{product.subtitle}</span>
            <span className="shrink-0">
              <Price cents={product.priceFromCents} from />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

const gridClass = "grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3";

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className={gridClass}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  );
}

// Same footprint as the real grid, so nothing jumps when the products arrive.
export function ProductGridSkeleton({ count }: { count: number }) {
  return (
    <div className={gridClass} aria-busy aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-4/5 bg-stone" />
          <div className="mt-4 h-3 w-1/4 bg-stone" />
          <div className="mt-3 h-6 w-3/4 bg-stone" />
          <div className="mt-3 h-4 w-1/2 bg-stone" />
        </div>
      ))}
    </div>
  );
}
