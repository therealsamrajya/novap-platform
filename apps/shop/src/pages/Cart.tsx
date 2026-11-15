import { checkoutSchema, formatAud, imagesForVariant, type CheckoutCreated, type CheckoutInput, type ProductDetail } from "@novap/shared";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { delay, lineField, pad, Star, useReveal } from "../components/editorial";
import { Field, FormError, Notice, Price, useTitle } from "../components/ui";
import { api, assetUrl } from "../lib/api";
import { useMe } from "../lib/auth";
import { cart, useCart, type CartLine } from "../lib/cart";
import { errorsFrom, validate, type FieldErrors } from "../lib/forms";
import { productQuery } from "./Product";

export function CartPage() {
  useTitle("Cart");
  const lines = useCart();

  // The cart only stores ids; names and prices come fresh from the API, one request per product.
  const slugs = [...new Set(lines.map((l) => l.slug))];
  const products = useQueries({ queries: slugs.map(productQuery) });
  const bySlug = new Map(slugs.map((slug, i) => [slug, products[i]!]));
  const loading = products.some((p) => p.isPending);

  const rows = lines.map((line) => {
    const product = bySlug.get(line.slug)?.data;
    const variant = product?.variants.find((v) => v.id === line.variantId);
    return { line, product, variant };
  });
  // A product that 404s or a variant that's gone was deactivated or deleted since it was added.
  const unavailable = loading ? [] : rows.filter((r) => !r.variant || !r.variant.inStock);
  const subtotal = rows.reduce((sum, r) => sum + (r.variant ? r.variant.priceCents * r.line.quantity : 0), 0);

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  // Rows added in another tab get observed too.
  const ref = useReveal(String(lines.length));

  return (
    <div ref={ref}>
      <section className="grain relative overflow-hidden border-b border-ink bg-sand">
        <div className="shell relative flex flex-wrap items-end justify-between gap-8 py-12 md:py-16">
          <div>
            <p data-reveal className="reveal micro flex items-center gap-3 text-ink/70">
              <Star className="size-3 text-crimson" />
              Cart
            </p>
            <h1 className="headline mt-6 text-[clamp(3.25rem,7.5vw,6.5rem)]">
              <span data-reveal className="mask" style={delay(100)}>
                <span>
                  Your <span className="text-crimson italic">cart.</span>
                </span>
              </span>
            </h1>
          </div>
          <p data-reveal className="reveal flex items-baseline gap-3" style={delay(300)}>
            <span className="headline text-6xl text-ink/15 tabular-nums md:text-7xl">{pad(count)}</span>
            <span className="micro text-ink/70">{count === 1 ? "Item" : "Items"}</span>
          </p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="shell py-12 md:py-20">
          {!lines.length ? (
            // Not a [data-reveal]: it can mount after the observer has run, so it animates itself.
            <div className="relative grid animate-slide-in justify-items-start gap-6 overflow-hidden border border-ink/25 p-8 md:p-14">
              <span aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full bg-crimson" />
              <Star className="relative size-4 text-crimson" />
              <p className="headline relative text-5xl md:text-6xl">
                Nothing here <span className="text-crimson italic">yet.</span>
              </p>
              <p className="relative max-w-sm leading-relaxed text-ink/70">Your cart is empty.</p>
              <Link to="/shop" className="btn btn-dark group relative">
                Browse the shop
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          ) : (
            <div className="grid items-start gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-[7%]">
              <ul className="border-b border-ink">
                {rows.map((row, i) => (
                  <CartRow key={row.line.variantId} {...row} index={i} loading={loading} />
                ))}
              </ul>

              <aside data-reveal className="reveal space-y-7 border-t border-ink bg-sand p-8 md:p-10 lg:sticky lg:top-8" style={delay(200)}>
                <p className="micro text-crimson">Summary</p>
                <dl className="space-y-4 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt>Subtotal</dt>
                    <dd className="font-editorial text-3xl tracking-tight tabular-nums">{loading ? "…" : formatAud(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-ink/15 pt-4 text-ink/70">
                    <dt>Shipping</dt>
                    <dd>Calculated at checkout</dd>
                  </div>
                </dl>
                <p className="text-xs leading-relaxed text-muted">Prices include GST. Final prices are confirmed on the payment page.</p>
                {unavailable.length > 0 ? (
                  <Notice>Remove the items marked unavailable to continue.</Notice>
                ) : (
                  <CheckoutForm lines={lines} disabled={loading} />
                )}
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CartRow({
  line,
  product,
  variant,
  index,
  loading,
}: {
  line: CartLine;
  product?: ProductDetail;
  variant?: ProductDetail["variants"][number];
  index: number;
  loading: boolean;
}) {
  // The variant's own picture when it has one (a colour, a flavour), else the product's.
  const image = product && imagesForVariant(product.images, variant?.id)[0];
  return (
    <li data-reveal className="reveal group relative flex gap-5 py-7 md:gap-7" style={delay(index * 100)}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-ink" />
      {/* A second, red rule wipes over the black one while the row is hovered. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-crimson transition-transform duration-700 ease-editorial group-hover:scale-x-100" />
      <span aria-hidden className="headline hidden w-12 shrink-0 text-4xl text-ink/15 tabular-nums transition-colors duration-500 group-hover:text-crimson md:block">
        {pad(index + 1)}
      </span>
      <Link to={`/products/${line.slug}`} className="size-24 shrink-0 overflow-hidden bg-stone md:size-32">
        {image && <img src={assetUrl(image.url)} alt="" className="size-full object-cover transition-transform duration-700 ease-editorial group-hover:scale-105" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex justify-between gap-4">
          <div className="min-w-0">
            <Link to={`/products/${line.slug}`} className="font-editorial text-2xl leading-tight tracking-tight hover:text-crimson">
              {product?.name ?? (loading ? "Loading…" : "Unavailable product")}
            </Link>
            {variant && product && product.variants.length > 1 && <p className="micro mt-2 text-ink/60">{variant.label}</p>}
            {!loading && (!variant || !variant.inStock) && (
              <p className="mt-2 text-sm text-red-800">{variant ? "Sold out" : "No longer available"}</p>
            )}
          </div>
          {variant && (
            <div className="text-right font-editorial text-xl tabular-nums">
              <Price cents={variant.priceCents * line.quantity} />
              {line.quantity > 1 && <p className="font-sans text-xs text-muted">{formatAud(variant.priceCents)} each</p>}
            </div>
          )}
        </div>
        <div className="mt-auto flex items-center gap-5">
          <label className="flex items-center gap-3">
            <span className="micro text-ink/60">Qty</span>
            <input
              type="number"
              min={1}
              max={99}
              value={line.quantity}
              onChange={(e) => cart.setQuantity(line.variantId, Number(e.target.value) || 1)}
              className={`${lineField} h-10 w-16 text-center tabular-nums`}
            />
          </label>
          <button className="micro text-ink/60 underline-offset-4 hover:text-crimson hover:underline" onClick={() => cart.remove(line.variantId)}>
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function CheckoutForm({ lines, disabled }: { lines: CartLine[]; disabled: boolean }) {
  const me = useMe();
  const [errors, setErrors] = useState<FieldErrors>({});
  const checkout = useMutation({
    mutationFn: (input: CheckoutInput) => api.post<CheckoutCreated>("/api/checkout", input),
    // Stripe's hosted page takes the card. The cart is cleared on the success page, not here,
    // so cancelling on Stripe brings the buyer back to a full cart.
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (err) => setErrors(errorsFrom(err)),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = me.data ? undefined : String(new FormData(e.currentTarget).get("email") ?? "").trim();
    // Guests need an email for the receipt; the shared schema leaves it optional for logged-in users.
    if (email === "") return setErrors({ email: "Enter your email for the order confirmation" });
    const { data, errors } = validate(checkoutSchema, {
      items: lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
      email,
    });
    setErrors(errors ?? {});
    if (data) checkout.mutate(data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 border-t border-ink/15 pt-7">
      <FormError message={errors.form ?? errors.items} />
      {me.data ? (
        <p className="text-sm">
          Confirmation goes to <strong className="font-medium">{me.data.email}</strong>.
        </p>
      ) : (
        <>
          <Field label="Email" error={errors.email}>
            <input className={`${lineField} h-12`} name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
          </Field>
          <p className="text-xs text-muted">
            Checking out as a guest.{" "}
            <Link to="/login" state={{ from: "/cart" }} className="link">
              Log in
            </Link>{" "}
            to keep the order in your account.
          </p>
        </>
      )}
      <button className="btn btn-dark group w-full" disabled={disabled || checkout.isPending || checkout.isSuccess}>
        {checkout.isPending || checkout.isSuccess ? "Going to payment…" : "Checkout"}
        <span aria-hidden className="transition-transform group-hover:translate-x-1">
          →
        </span>
      </button>
    </form>
  );
}
