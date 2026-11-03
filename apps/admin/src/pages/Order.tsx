import { formatAud, orderUpdateSchema, type AdminOrder, type OrderUpdateInput } from "@novap/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Badge, Field, FormError, PageHeader, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { errorsFrom, validate, type FieldErrors } from "../lib/forms";
import { orderStatus } from "../lib/status";

export function OrderPage() {
  const id = Number(useParams().id);
  const order = useQuery({
    queryKey: ["orders", id],
    queryFn: () => api.get<AdminOrder>(`/api/admin/orders/${id}`),
  });

  return (
    <>
      <Link to="/orders" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Orders
      </Link>
      <QueryState isPending={order.isPending} error={order.error}>
        {order.data && <OrderDetail order={order.data} />}
      </QueryState>
    </>
  );
}

function OrderDetail({ order }: { order: AdminOrder }) {
  const status = orderStatus[order.status];
  const address = order.shippingAddress;

  return (
    <>
      <div className="mt-2">
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              Order #{order.id} <Badge color={status.color}>{status.label}</Badge>
            </span>
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((line, i) => (
                  <tr key={i}>
                    <td>
                      {line.productName} <span className="text-zinc-500">· {line.variantLabel}</span>
                    </td>
                    <td className="font-mono text-xs">{line.sku}</td>
                    <td className="text-right">{formatAud(line.unitPriceCents)}</td>
                    <td className="text-right">{line.quantity}</td>
                    <td className="text-right">{formatAud(line.unitPriceCents * line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto max-w-xs space-y-1 px-3 py-3 text-sm">
              <Row label="Subtotal" value={formatAud(order.subtotalCents)} />
              <Row label="Shipping" value={order.shippingCents ? formatAud(order.shippingCents) : "Free"} />
              <Row label="Total" value={formatAud(order.totalCents)} strong />
              <Row label="Includes GST" value={formatAud(order.gstCents)} />
            </dl>
          </section>
          {(order.status === "paid" || order.status === "fulfilled") && <ShipForm order={order} />}
        </div>

        <aside className="space-y-6">
          <section className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 font-medium">Customer</h2>
            <p>{order.customer?.name ?? "Guest"}</p>
            <p className="text-zinc-600">{order.email}</p>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-medium">Shipping address</h2>
            {address ? (
              <address className="space-y-0.5 not-italic">
                <div>{address.name}</div>
                <div>{address.line1}</div>
                {address.line2 && <div>{address.line2}</div>}
                <div>
                  {address.city} {address.state} {address.postcode}
                </div>
                <div>{address.country}</div>
                {address.phone && <div className="text-zinc-600">{address.phone}</div>}
              </address>
            ) : (
              <p className="text-zinc-500">Not collected yet (added when the order is paid).</p>
            )}
          </section>
          <section className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 font-medium">Timeline</h2>
            <Row label="Placed" value={formatDateTime(order.createdAt)} />
            {order.paidAt && <Row label="Paid" value={formatDateTime(order.paidAt)} />}
            {order.fulfilledAt && <Row label="Shipped" value={formatDateTime(order.fulfilledAt)} />}
          </section>
          {order.stripePaymentIntentId && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 font-medium">Payment</h2>
              <p className="font-mono text-xs break-all">{order.stripePaymentIntentId}</p>
              <p className="mt-2 text-xs text-zinc-500">Refunds are made in the Stripe dashboard; the order updates by itself.</p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-zinc-600"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// Paid orders can be marked shipped; the tracking number can be set or changed on paid and shipped orders.
function ShipForm({ order }: { order: AdminOrder }) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: (input: OrderUpdateInput) => api.patch<AdminOrder>(`/api/admin/orders/${order.id}`, input),
    onSuccess: (updated) => {
      qc.setQueryData(["orders", order.id], updated);
      qc.invalidateQueries({ queryKey: ["orders"] });
      setSaved(true);
    },
    onError: (err) => setErrors(errorsFrom(err)),
  });

  function submit(e: FormEvent<HTMLFormElement>, ship: boolean) {
    e.preventDefault();
    setSaved(false);
    const trackingNumber = String(new FormData(e.currentTarget).get("trackingNumber") ?? "");
    const { data, errors } = validate(orderUpdateSchema, ship ? { status: "fulfilled", trackingNumber } : { trackingNumber });
    setErrors(errors ?? {});
    if (data) update.mutate(data);
  }

  const shipping = order.status === "paid";
  return (
    <form className="card space-y-3 p-4" noValidate onSubmit={(e) => submit(e, shipping)}>
      <h2 className="font-medium">{shipping ? "Ship this order" : "Tracking"}</h2>
      <FormError message={errors.form} />
      <Field label="Tracking number" error={errors.trackingNumber} hint="Optional">
        <input className="input max-w-xs" name="trackingNumber" defaultValue={order.trackingNumber ?? ""} />
      </Field>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={update.isPending}>
          {shipping ? "Mark as shipped" : "Save tracking number"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </form>
  );
}
