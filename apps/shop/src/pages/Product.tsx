import {
  formatAud,
  imagesForVariant,
  type Paginated,
  type ProductDetail,
  type ProductImage,
  type ProductSummary,
  type ProductVariant,
} from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { AskBand, delay, pad, Star, useReveal } from "../components/editorial";
import { plateFor, ProductCard } from "../components/ProductCard";
import { Price, useTitle } from "../components/ui";
import { api, ApiRequestError, assetUrl } from "../lib/api";
import { cart } from "../lib/cart";
import { NotFoundPage } from "./NotFound";

export const productQuery = (slug: string) => ({
  queryKey: ["products", "detail", slug],
  queryFn: () => api.get<ProductDetail>(`/api/products/${encodeURIComponent(slug)}`),
});

// Other pieces shown under the product, from the same category.
const RELATED = 3;

export function ProductPage() {
  const slug = useParams().slug!;
  const product = useQuery(productQuery(slug));
  useTitle(product.data?.name);

  const category = product.data?.category;
  const related = useQuery({
    // One more than shown: the product itself is in its own category.
    queryKey: ["products", { category: category?.slug, limit: RELATED + 1 }],
    queryFn: () => api.get<Paginated<ProductSummary>>("/api/products", { category: category!.slug, limit: RELATED + 1 }),
    enabled: Boolean(category),
  });
  const others = (related.data?.items ?? []).filter((p) => p.id !== product.data?.id).slice(0, RELATED);

  // The product and the related cards arrive separately; each needs observing when it does.
  const ref = useReveal(`${product.data?.id}-${others.map((p) => p.id).join("-")}`);

  if (product.error instanceof ApiRequestError && product.error.status === 404) return <NotFoundPage what="product" />;
  return (
    <div ref={ref} className="bg-sand">
      <section className="grain relative border-b border-ink">
        <div className="shell relative">
          {product.isPending ? (
            <ProductSkeleton />
          ) : product.error ? (
            <p className="py-16 text-sm text-red-700">{product.error.message}</p>
          ) : (
            <ProductView key={product.data.id} product={product.data} />
          )}
        </div>
      </section>

      {category && others.length > 0 && (
        <section className="border-b border-ink/20 bg-paper">
          <div className="shell py-20 md:py-24">
            <div className="mb-10 border-b border-ink pb-6">
              <p data-reveal className="reveal micro flex items-center gap-3 text-crimson">
                <Star className="size-3" />
                Keep looking
              </p>
              <h2 className="headline mt-5 text-5xl md:text-6xl">
                <span data-reveal className="mask" style={delay(80)}>
                  <span>
                    More from <span className="text-crimson italic">{category.name}.</span>
                  </span>
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
              {others.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
              {/* Closing tile, the size of a card's frame: leads on to the whole category. */}
              <Link
                data-reveal
                to={`/shop?category=${encodeURIComponent(category.slug)}`}
                style={delay(others.length * 100)}
                className="reveal group relative flex aspect-4/5 min-w-0 flex-col justify-end overflow-hidden bg-ink p-4 text-paper sm:p-6"
              >
                <span
                  aria-hidden
                  className="absolute top-[-12%] right-[-16%] aspect-square w-[62%] rounded-full bg-crimson transition-transform duration-1000 ease-editorial group-hover:scale-125"
                />
                <span className="headline relative text-3xl sm:text-4xl">
                  The full
                  <br />
                  <span className="italic">range.</span>
                </span>
                <span className="micro relative mt-5 flex w-fit items-center gap-3 border-b border-paper/60 pb-2">
                  View all
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <AskBand />
    </div>
  );
}

function ProductView({ product }: { product: ProductDetail }) {
  // Start on the first variant that can be bought.
  const [variant, setVariant] = useState<ProductVariant | undefined>(
    product.variants.find((v) => v.inStock) ?? product.variants[0],
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function addToCart() {
    if (!variant) return;
    cart.add({ variantId: variant.id, quantity, slug: product.slug });
    setAdded(true);
  }

  const attributes = Object.entries(variant?.attributes ?? {});
  const onSale = variant?.compareAtCents != null && variant.compareAtCents > variant.priceCents;
  const tag = !variant?.inStock ? "Sold out" : onSale ? "Sale" : product.featured ? "Featured" : null;

  return (
    <>
      <nav aria-label="Breadcrumb" className="micro flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/15 py-5 text-ink/55">
        <Link to="/shop" className="hover:text-crimson">
          Shop
        </Link>
        {product.category && (
          <>
            <span aria-hidden className="text-crimson">
              /
            </span>
            <Link to={`/shop?category=${encodeURIComponent(product.category.slug)}`} className="hover:text-crimson">
              {product.category.name}
            </Link>
          </>
        )}
        <span aria-hidden className="text-crimson">
          /
        </span>
        <span aria-current="page" className="text-ink">
          {product.name}
        </span>
      </nav>

      {/* Two cells of the layout grid: the hairline between them runs from the breadcrumb rule
          down to the foot of the section. */}
      <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        {/* The photo stays in view while a long description scrolls past. The gallery caps its
            own width by the viewport height, so the photo fits under the header on short
            screens too. z-10 lifts it above the section's grain. */}
        <div
          data-reveal
          className="reveal relative z-10 min-w-0 pt-8 lg:sticky lg:top-24 lg:self-start lg:pt-12 lg:pr-12 lg:pb-24 xl:pr-16"
        >
          {/* Keyed by variant so picking another one starts its gallery at the first image. */}
          <Gallery
            key={variant?.id}
            images={imagesForVariant(product.images, variant?.id)}
            product={product}
            tag={tag}
            soldOut={!variant?.inStock}
          />
        </div>

        <div className="min-w-0 pt-10 pb-20 lg:border-l lg:border-ink/15 lg:pt-12 lg:pb-24 lg:pl-12 xl:pl-16">
          <p data-reveal className="reveal micro flex items-center gap-3 text-crimson">
            <Star className="size-3" />
            {product.category?.name ?? "NŌVAP"}
          </p>
          <h1 className="headline mt-5 text-[clamp(2.5rem,4vw,4rem)] text-balance">
            <span data-reveal className="mask" style={delay(100)}>
              <span>{product.name}</span>
            </span>
          </h1>
          {product.subtitle && (
            <p data-reveal className="reveal mt-4 font-editorial text-xl text-ink/70 italic md:text-2xl" style={delay(250)}>
              {product.subtitle}
            </p>
          )}

          {/* One reveal for everything below the title. Its className must stay static (see
              useReveal), so the parts that change with state are its children. */}
          <div data-reveal className="reveal" style={delay(350)}>
            <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-ink pt-6">
              <p className="font-editorial text-4xl tracking-tight">
                {variant ? <Price cents={variant.priceCents} compareAt={variant.compareAtCents} /> : "Not available"}
              </p>
              <p className="text-xs text-ink/60">Includes GST. Shipping calculated at checkout.</p>
            </div>

            {product.variants.length > 1 && (
              <fieldset className="mt-8">
                <legend className="label text-ink/60">Option</legend>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const active = v.id === variant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setVariant(v);
                          setAdded(false);
                        }}
                        className={`min-h-11 border px-5 text-sm transition-colors ${
                          active ? "border-ink bg-ink text-paper" : "border-ink/25 hover:border-ink"
                        } ${v.inStock ? "" : `line-through ${active ? "text-paper/60" : "text-ink/40"}`}`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-8 flex flex-wrap items-end gap-3">
              <div>
                <label className="label text-ink/60" htmlFor="product-quantity">
                  Quantity
                </label>
                <div className="flex h-12 border border-ink">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(quantity - 1)}
                    className="w-11 text-lg transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    id="product-quantity"
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-11 [appearance:textfield] bg-transparent text-center text-sm tabular-nums outline-none focus-visible:bg-paper [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={quantity >= 99}
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-11 text-lg transition-colors enabled:hover:bg-ink enabled:hover:text-paper disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                className="btn btn-dark group min-w-56 flex-1 justify-between enabled:hover:border-crimson enabled:hover:bg-crimson"
                disabled={!variant?.inStock}
                onClick={addToCart}
              >
                {variant?.inStock ? (
                  <>
                    Add to cart
                    <span className="flex items-center gap-3 tabular-nums">
                      {formatAud(variant.priceCents * quantity)}
                      <span aria-hidden className="text-base leading-none transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </>
                ) : (
                  "Sold out"
                )}
              </button>
            </div>
            {added && (
              <p role="status" className="mt-3 flex animate-slide-in flex-wrap items-center gap-x-3 gap-y-2 border border-ink/25 px-4 py-3 text-sm">
                <Star className="size-3 text-crimson" />
                Added to your cart.
                <Link to="/cart" className="micro group ml-auto inline-flex items-center gap-2 border-b border-ink pb-1 hover:border-crimson hover:text-crimson">
                  View cart
                  <span aria-hidden className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </p>
            )}

            {product.description && (
              <section className="mt-12">
                <h2 className="micro text-ink/60">Description</h2>
                {/* Plain text from the admin; pre-line keeps its paragraphs. */}
                <p className="mt-4 max-w-prose leading-relaxed whitespace-pre-line text-ink/75">{product.description}</p>
              </section>
            )}

            <section className="mt-12">
              <h2 className="micro text-ink/60">Details</h2>
              <dl className="mt-4 border-t border-ink">
                {variant && <SpecLine label="SKU" value={variant.sku} />}
                {attributes.map(([k, v]) => (
                  <SpecLine key={k} label={k} value={<span className="capitalize">{v}</span>} />
                ))}
                <SpecLine
                  label="Availability"
                  value={
                    <span className={variant?.inStock ? "text-emerald-800" : "text-crimson"}>
                      {variant?.inStock ? "In stock" : "Sold out"}
                    </span>
                  }
                />
              </dl>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function SpecLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-ink/15 py-4">
      <dt className="micro text-ink/60">{label}</dt>
      <dd className="text-right font-editorial text-lg">{value}</dd>
    </div>
  );
}

function Gallery({
  images,
  product,
  tag,
  soldOut,
}: {
  images: ProductImage[];
  product: ProductDetail;
  tag: string | null;
  soldOut: boolean;
}) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const main = images[index];
  const step = (by: number) => setIndex((index + by + count) % count);
  // No photo yet: the same printed plate the piece has on its catalogue card.
  const plate = plateFor(product.slug);
  const arrow = "grid size-11 place-items-center bg-ink text-lg leading-none text-paper transition-colors hover:bg-crimson";

  return (
    // Desktop width is capped so the square photo (gallery width less the 5.5rem rail and gap)
    // never stands taller than the viewport less the 10.5rem above it: header, padding, margin.
    <div
      className={`grid gap-3 lg:gap-4 ${
        count > 1 ? "lg:max-w-[calc(100svh-5rem)] lg:grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:max-w-[calc(100svh-10.5rem)]"
      }`}
    >
      {count > 1 && (
        // A row under the photo on small screens; on desktop a rail beside it, exactly as tall
        // as the photo (the list is absolute, so it scrolls instead of stretching the row).
        <div className="relative order-2 min-w-0 lg:order-1">
          <div className="flex scrollbar-none gap-2 overflow-x-auto lg:absolute lg:inset-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
            {images.map((img, i) => (
              <button
                key={img.url}
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className={`aspect-square w-16 shrink-0 border p-1 transition-[opacity,border-color] duration-300 lg:w-full ${
                  i === index ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={assetUrl(img.url)} alt="" className="size-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`relative order-1 aspect-square min-w-0 overflow-hidden lg:order-2${main ? "bg-stone text-ink" : plate.theme}`}>
        {main ? (
          // Keyed by URL so each newly picked photo fades up into the frame.
          <img
            key={main.url}
            src={assetUrl(main.url)}
            alt={main.alt || product.name}
            className={`size-full animate-slide-in object-cover ${soldOut ? "opacity-70 grayscale" : ""}`}
          />
        ) : (
          <>
            <span aria-hidden className={`absolute aspect-square rounded-full ${plate.sun}`} />
            <span aria-hidden className="absolute inset-3 border border-current/20 md:inset-5" />
            <span aria-hidden className="headline absolute bottom-8 left-7 text-[11rem] italic md:bottom-12 md:left-12 md:text-[17rem]">
              {product.name.charAt(0)}
            </span>
            <span className="micro absolute top-8 left-8 opacity-70 md:top-12 md:left-12">Photo to come</span>
          </>
        )}
        {tag && (
          <span
            className={`micro absolute top-5 right-5 rounded-full px-3.5 py-2 text-paper ring-1 ring-paper/25 md:top-8 md:right-8 ${
              tag === "Sale" ? "bg-crimson" : "bg-ink"
            }`}
          >
            {tag}
          </span>
        )}
        {count > 1 && (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between">
            <span className="micro bg-paper/90 px-3.5 py-3 tabular-nums">
              {pad(index + 1)} <span className="mx-1 text-ink/40">/</span> {pad(count)}
            </span>
            <span className="flex gap-px">
              <button aria-label="Previous image" onClick={() => step(-1)} className={arrow}>
                ←
              </button>
              <button aria-label="Next image" onClick={() => step(1)} className={arrow}>
                →
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Same two cells as the real page, so nothing jumps when the product arrives.
function ProductSkeleton() {
  return (
    <div className="grid animate-pulse py-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]" aria-busy aria-label="Loading product">
      <div className="aspect-square bg-ink/10 lg:mr-12 xl:mr-16" />
      <div className="pt-10 lg:pt-0 lg:pl-12 xl:pl-16">
        <div className="h-3 w-24 bg-ink/10" />
        <div className="mt-6 h-16 w-3/4 bg-ink/10" />
        <div className="mt-10 h-10 w-32 bg-ink/10" />
        <div className="mt-10 h-12 bg-ink/10" />
        <div className="mt-12 h-40 bg-ink/10" />
      </div>
    </div>
  );
}
