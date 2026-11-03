import { formatAud, type CheckoutSessionStatus } from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Notice, PageHero, QueryState, useTitle } from "../components/ui";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";
import { cart } from "../lib/cart";

const POLL_MS = 2000;
const POLL_MAX = 10;

export function CheckoutSuccessPage() {
  useTitle("Thank you");
  const sessionId = useSearchParams()[0].get("session_id") ?? "";
  const me = useMe();

  const session = useQuery({
    queryKey: ["checkout", sessionId],
    queryFn: () => api.get<CheckoutSessionStatus>(`/api/checkout/sessions/${encodeURIComponent(sessionId)}`),
    enabled: !!sessionId,
    // The order turns paid when Stripe's webhook arrives, usually a second or two after
    // the redirect. Poll a little while it's pending, then stop and show a note instead.
    refetchInterval: (q) => (q.state.data?.status === "pending" && q.state.dataUpdateCount < POLL_MAX ? POLL_MS : false),
  });

  // Stripe only sends buyers here after payment, so the cart's job is done.
  const found = session.isSuccess;
  useEffect(() => {
    if (found) cart.clear();
  }, [found]);

  if (!sessionId) {
    return (
      <PageHero eyebrow="Checkout" title="Nothing to show">
        <Link to="/shop" className="link">
          Back to the shop
        </Link>
      </PageHero>
    );
  }

  const order = session.data;
  return (
    <>
      <PageHero eyebrow="Order confirmed" title={<>Thank you.</>}>
        {order && <>Order #{order.orderId}. A confirmation email is on its way.</>}
      </PageHero>
      <div className="shell max-w-3xl py-12 md:py-16">
        <QueryState isPending={session.isPending} error={session.error}>
          {order && (
            <div className="space-y-8">
              {order.status === "pending" && (
                <Notice>
                  We're still waiting for the payment confirmation from Stripe. This usually takes a few seconds; you'll get an
                  email as soon as it arrives.
                </Notice>
              )}
              <ul className="border-t border-line">
                {order.items.map((line, i) => (
                  <li key={i} className="flex justify-between gap-4 border-b border-line py-4 text-sm">
                    <span>
                      {line.productName} <span className="text-muted">· {line.variantLabel}</span>
                      {line.quantity > 1 && <span className="text-muted"> × {line.quantity}</span>}
                    </span>
                    <span>{formatAud(line.unitPriceCents * line.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="ml-auto max-w-xs space-y-2 text-sm">
                <Row label="Subtotal" value={formatAud(order.subtotalCents)} />
                <Row label="Shipping" value={order.shippingCents ? formatAud(order.shippingCents) : "Free"} />
                <Row label="Total" value={formatAud(order.totalCents)} strong />
                <Row label="Includes GST" value={formatAud(order.gstCents)} muted />
              </dl>
              <div className="flex flex-wrap gap-3">
                <Link to="/shop" className="btn btn-dark">
                  Keep shopping
                </Link>
                {me.data && (
                  <Link to="/account" className="btn btn-outline">
                    Your orders
                  </Link>
                )}
              </div>
            </div>
          )}
        </QueryState>
      </div>
    </>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-2 font-semibold" : ""} ${muted ? "text-muted" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
