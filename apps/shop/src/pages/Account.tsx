import { formatAud, type AccountOrder, type AccountOrderSummary, type OrderStatus, type Paginated, type User } from "@novap/shared";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { FormError, Notice, Pagination, QueryState, useTitle } from "../components/ui";
import { api, ApiRequestError } from "../lib/api";
import { useLogout, useMe } from "../lib/auth";
import { formatDate } from "../lib/format";
import { errorMessage } from "../lib/forms";
import { useListParams } from "../lib/list-params";
import { NotFoundPage } from "./NotFound";

const LIMIT = 10;

// Customer wording; pending orders (unpaid checkouts) still show so an abandoned payment isn't a mystery.
const statusLabel: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Preparing",
  fulfilled: "Shipped",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function AccountPage() {
  useTitle("Your account");
  const me = useMe().data!; // RequireAuth guarantees a user
  const logout = useLogout();
  const navigate = useNavigate();
  const { page, set } = useListParams([] as const);
  const orders = useQuery({
    queryKey: ["account", "orders", page],
    queryFn: () => api.get<Paginated<AccountOrderSummary>>("/api/account/orders", { page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="shell py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="micro text-muted">Account</p>
          <h1 className="display mt-4 text-5xl md:text-6xl">Hello, {me.name.split(" ")[0]}.</h1>
          <p className="mt-3 text-sm text-muted">{me.email}</p>
        </div>
        <button className="btn btn-outline" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/") })}>
          Log out
        </button>
      </div>

      {!me.emailVerified && <VerifyBanner user={me} />}

      <h2 className="micro mt-12 mb-6 text-muted">Orders</h2>
      <QueryState isPending={orders.isPending} error={orders.error}>
        {orders.data?.items.length ? (
          <>
            <ul className="border-t border-line">
              {orders.data.items.map((o) => (
                <li key={o.id}>
                  <Link to={`/account/orders/${o.id}`} className="grid grid-cols-2 gap-2 border-b border-line py-5 text-sm hover:bg-sand md:grid-cols-[1fr_1fr_1fr_auto] md:items-center md:px-3">
                    <span className="font-medium">Order #{o.id}</span>
                    <span className="text-right text-muted md:text-left">{formatDate(o.createdAt)}</span>
                    <span>{statusLabel[o.status]}</span>
                    <span className="text-right">
                      {formatAud(o.totalCents)} <span className="ml-2" aria-hidden>→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} limit={LIMIT} total={orders.data.total} onPage={(page) => set({ page })} />
          </>
        ) : (
          <p className="bg-sand p-8 text-sm text-muted">
            No orders yet. <Link to="/shop" className="link text-ink">Browse the shop</Link>.
          </p>
        )}
      </QueryState>
    </div>
  );
}

function VerifyBanner({ user }: { user: User }) {
  const resend = useMutation({ mutationFn: () => api.post<void>("/api/auth/verify-email/resend") });
  return (
    <div className="mt-8">
      <Notice>
        <p>
          Please confirm <strong className="font-medium">{user.email}</strong> with the link we emailed you. Orders you placed as a
          guest with this email show here once it's confirmed.
        </p>
        {resend.isSuccess ? (
          <p className="mt-3 font-medium">A new link is on its way.</p>
        ) : (
          <button className="link mt-3 text-ink" disabled={resend.isPending} onClick={() => resend.mutate()}>
            Send the link again
          </button>
        )}
        {resend.isError && (
          <div className="mt-3">
            <FormError message={errorMessage(resend.error)} />
          </div>
        )}
      </Notice>
    </div>
  );
}

export function AccountOrderPage() {
  const id = Number(useParams().id);
  useTitle(`Order #${id}`);
  const order = useQuery({
    queryKey: ["account", "order", id],
    queryFn: () => api.get<AccountOrder>(`/api/account/orders/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });

  // Someone else's order is a 404 too, on purpose (the API doesn't confirm it exists).
  if (!(Number.isInteger(id) && id > 0) || (order.error instanceof ApiRequestError && order.error.status === 404)) {
    return <NotFoundPage what="order" />;
  }

  const o = order.data;
  const address = o?.shippingAddress;
  return (
    <div className="shell py-12 md:py-16">
      <Link to="/account" className="micro text-muted hover:text-ink">
        ← Your account
      </Link>
      <QueryState isPending={order.isPending} error={order.error}>
        {o && (
          <div className="mt-6">
            <h1 className="display text-5xl md:text-6xl">Order #{o.id}</h1>
            <p className="mt-3 text-sm text-muted">
              Placed {formatDate(o.createdAt)} · {statusLabel[o.status]}
              {o.fulfilledAt && ` on ${formatDate(o.fulfilledAt)}`}
            </p>

            <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <ul className="border-t border-line">
                  {o.items.map((line, i) => (
                    <li key={i} className="flex justify-between gap-4 border-b border-line py-4 text-sm">
                      <span>
                        {line.productName} <span className="text-muted">· {line.variantLabel}</span>
                        {line.quantity > 1 && <span className="text-muted"> × {line.quantity}</span>}
                      </span>
                      <span>{formatAud(line.unitPriceCents * line.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
                  <Row label="Subtotal" value={formatAud(o.subtotalCents)} />
                  <Row label="Shipping" value={o.shippingCents ? formatAud(o.shippingCents) : "Free"} />
                  <Row label="Total" value={formatAud(o.totalCents)} strong />
                  <Row label="Includes GST" value={formatAud(o.gstCents)} />
                </dl>
              </div>

              <aside className="space-y-6 bg-sand p-8 text-sm">
                {o.trackingNumber && (
                  <div>
                    <h2 className="label">Tracking number</h2>
                    <p className="font-mono">{o.trackingNumber}</p>
                  </div>
                )}
                <div>
                  <h2 className="label">Shipping to</h2>
                  {address ? (
                    <address className="leading-relaxed not-italic">
                      {address.name}
                      <br />
                      {address.line1}
                      {address.line2 && (
                        <>
                          <br />
                          {address.line2}
                        </>
                      )}
                      <br />
                      {address.city} {address.state} {address.postcode}
                    </address>
                  ) : (
                    <p className="text-muted">Added once the payment goes through.</p>
                  )}
                </div>
                <p className="text-muted">
                  Something wrong? <Link to="/contact" className="link text-ink">Contact us</Link> with your order number.
                </p>
              </aside>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-2 font-semibold" : "text-neutral-700"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
