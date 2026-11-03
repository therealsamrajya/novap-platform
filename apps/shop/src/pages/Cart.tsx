import { checkoutSchema, formatAud, type CheckoutCreated, type CheckoutInput, type ProductDetail } from "@novap/shared";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Field, FormError, Notice, PageHero, Price, useTitle } from "../components/ui";
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

  return (
    <>
      <PageHero eyebrow="Cart" title="Your cart" />
      <div className="shell py-12 md:py-16">
        {!lines.length ? (
          <div className="bg-sand p-10 md:p-16">
            <p className="text-lg">Your cart is empty.</p>
            <Link to="/shop" className="btn btn-dark mt-8">
              Browse the shop <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-12 lg:grid-cols-[1.4fr_1fr]">
            <ul className="border-t border-line">
              {rows.map((row) => (
                <CartRow key={row.line.variantId} {...row} loading={loading} />
              ))}
            </ul>

            <aside className="space-y-6 bg-sand p-8">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{loading ? "…" : formatAud(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-muted">
                  <dt>Shipping</dt>
                  <dd>Calculated at checkout</dd>
                </div>
              </dl>
              <p className="text-xs text-muted">Prices include GST. Final prices are confirmed on the payment page.</p>
              {unavailable.length > 0 ? (
                <Notice>Remove the items marked unavailable to continue.</Notice>
              ) : (
                <CheckoutForm lines={lines} disabled={loading} />
              )}
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

function CartRow({
  line,
  product,
  variant,
  loading,
}: {
  line: CartLine;
  product?: ProductDetail;
  variant?: ProductDetail["variants"][number];
  loading: boolean;
}) {
  const image = product?.images[0];
  return (
    <li className="flex gap-5 border-b border-line py-6">
      <Link to={`/products/${line.slug}`} className="size-24 shrink-0 overflow-hidden bg-stone md:size-28">
        {image && <img src={assetUrl(image.url)} alt="" className="size-full object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex justify-between gap-4">
          <div className="min-w-0">
            <Link to={`/products/${line.slug}`} className="text-lg font-medium tracking-tight hover:underline">
              {product?.name ?? (loading ? "Loading…" : "Unavailable product")}
            </Link>
            {variant && product && product.variants.length > 1 && <p className="text-sm text-muted">{variant.label}</p>}
            {!loading && (!variant || !variant.inStock) && (
              <p className="mt-1 text-sm text-red-800">{variant ? "Sold out" : "No longer available"}</p>
            )}
          </div>
          {variant && (
            <div className="text-right">
              <Price cents={variant.priceCents * line.quantity} />
              {line.quantity > 1 && <p className="text-xs text-muted">{formatAud(variant.priceCents)} each</p>}
            </div>
          )}
        </div>
        <div className="mt-auto flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Qty</span>
            <input
              type="number"
              min={1}
              max={99}
              value={line.quantity}
              onChange={(e) => cart.setQuantity(line.variantId, Number(e.target.value) || 1)}
              className="input h-10 w-20"
            />
          </label>
          <button className="micro text-muted hover:text-ink" onClick={() => cart.remove(line.variantId)}>
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
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={errors.form ?? errors.items} />
      {me.data ? (
        <p className="text-sm">
          Confirmation goes to <strong className="font-medium">{me.data.email}</strong>.
        </p>
      ) : (
        <>
          <Field label="Email" error={errors.email}>
            <input className="input bg-paper" name="email" type="email" autoComplete="email" aria-invalid={!!errors.email} />
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
      <button className="btn btn-dark w-full" disabled={disabled || checkout.isPending || checkout.isSuccess}>
        {checkout.isPending || checkout.isSuccess ? "Going to payment…" : "Checkout"}
      </button>
    </form>
  );
}
