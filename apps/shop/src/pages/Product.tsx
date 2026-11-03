import type { ProductDetail, ProductVariant } from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Price, QueryState, useTitle } from "../components/ui";
import { api, ApiRequestError, assetUrl } from "../lib/api";
import { cart } from "../lib/cart";
import { NotFoundPage } from "./NotFound";

export const productQuery = (slug: string) => ({
  queryKey: ["products", "detail", slug],
  queryFn: () => api.get<ProductDetail>(`/api/products/${encodeURIComponent(slug)}`),
});

export function ProductPage() {
  const slug = useParams().slug!;
  const product = useQuery(productQuery(slug));
  useTitle(product.data?.name);

  if (product.error instanceof ApiRequestError && product.error.status === 404) return <NotFoundPage what="product" />;
  return (
    <div className="shell">
      <QueryState isPending={product.isPending} error={product.error}>
        {product.data && <ProductView key={product.data.id} product={product.data} />}
      </QueryState>
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

  return (
    <>
      <nav aria-label="Breadcrumb" className="py-6 text-[10px] tracking-widest text-neutral-500 uppercase">
        <Link to="/shop" className="hover:text-ink">
          Shop
        </Link>
        {product.category && (
          <>
            {" / "}
            <Link to={`/shop?category=${encodeURIComponent(product.category.slug)}`} className="hover:text-ink">
              {product.category.name}
            </Link>
          </>
        )}
        {" / "}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid items-start gap-10 pb-24 lg:grid-cols-[1.08fr_0.92fr] lg:gap-[7%]">
        <Gallery product={product} />

        <div className="lg:sticky lg:top-28">
          {product.category && <p className="micro text-muted">{product.category.name}</p>}
          <h1 className="display mt-4 text-5xl md:text-7xl">{product.name}</h1>
          {product.subtitle && <p className="mt-3 text-muted">{product.subtitle}</p>}

          <p className="mt-8 text-2xl">
            {variant ? <Price cents={variant.priceCents} compareAt={variant.compareAtCents} /> : "Not available"}
          </p>
          <p className="mt-1 text-xs text-muted">Includes GST. Shipping calculated at checkout.</p>

          {product.variants.length > 1 && (
            <fieldset className="mt-8">
              <legend className="label">Option</legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={v.id === variant?.id}
                    onClick={() => {
                      setVariant(v);
                      setAdded(false);
                    }}
                    className={`border px-5 py-3 text-sm ${
                      v.id === variant?.id ? "border-ink bg-ink text-white" : "border-neutral-300 hover:border-ink"
                    } ${v.inStock ? "" : "text-neutral-400 line-through"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-8 flex flex-wrap items-end gap-3">
            <label>
              <span className="label">Quantity</span>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                className="input w-24"
              />
            </label>
            <button className="btn btn-dark flex-1" disabled={!variant?.inStock} onClick={addToCart}>
              {variant?.inStock ? "Add to cart" : "Sold out"}
            </button>
          </div>
          {added && (
            <p role="status" className="mt-4 text-sm">
              Added to your cart.{" "}
              <Link to="/cart" className="link">
                View cart
              </Link>
            </p>
          )}

          <dl className="mt-10 border-t border-line text-sm">
            {variant && <SpecLine label="SKU" value={variant.sku} />}
            {attributes.map(([k, v]) => (
              <SpecLine key={k} label={k} value={v} />
            ))}
            <SpecLine label="Availability" value={variant?.inStock ? "In stock" : "Sold out"} />
          </dl>

          {product.description && (
            <details open className="border-b border-line py-5">
              <summary className="cursor-pointer text-sm font-semibold">Description</summary>
              {/* Plain text from the admin; pre-line keeps its paragraphs. */}
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-neutral-600">{product.description}</p>
            </details>
          )}
        </div>
      </div>
    </>
  );
}

function SpecLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-4">
      <dt className="text-muted capitalize">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Gallery({ product }: { product: ProductDetail }) {
  const [index, setIndex] = useState(0);
  const main = product.images[index];

  return (
    <div>
      <div className="aspect-square overflow-hidden bg-stone">
        {main ? (
          <img src={assetUrl(main.url)} alt={main.alt || product.name} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-[12rem] font-medium text-black/5">Ō</div>
        )}
      </div>
      {product.images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {product.images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
              className={`aspect-square overflow-hidden border-2 ${i === index ? "border-ink" : "border-transparent"}`}
            >
              <img src={assetUrl(img.url)} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
