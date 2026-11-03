import { formatAud, orderStatusSchema, type AdminOrderSummary, type Paginated } from "@novap/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { SearchBox } from "../components/SearchBox";
import { Badge, PageHeader, Pagination, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useListParams } from "../lib/list-params";
import { orderStatus } from "../lib/status";

const LIMIT = 20;

export function OrdersPage() {
  const { page, status, q, set } = useListParams(["status", "q"] as const);
  const orders = useQuery({
    queryKey: ["orders", { page, status, q }],
    queryFn: () => api.get<Paginated<AdminOrderSummary>>("/api/admin/orders", { page, limit: LIMIT, status, q }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Orders" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={status} onChange={(e) => set({ status: e.target.value })}>
          {/* The API leaves pending (unpaid checkouts) out when no status is given. */}
          <option value="">All except awaiting payment</option>
          {orderStatusSchema.options.map((s) => (
            <option key={s} value={s}>
              {orderStatus[s].label}
            </option>
          ))}
        </select>
        <SearchBox value={q} onSearch={(q) => set({ q })} placeholder="Email or order number" />
      </div>
      <div className="card overflow-x-auto">
        <QueryState isPending={orders.isPending} error={orders.error} isEmpty={orders.data?.items.length === 0} empty="No orders found.">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="text-right">Items</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.data?.items.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td>
                    <Link to={`/orders/${o.id}`} className="font-medium underline-offset-2 hover:underline">
                      #{o.id}
                    </Link>
                  </td>
                  <td className="text-zinc-600">{formatDateTime(o.createdAt)}</td>
                  <td>
                    {o.email}
                    {o.userId === null && <span className="ml-1.5 text-xs text-zinc-500">guest</span>}
                  </td>
                  <td>
                    <Badge color={orderStatus[o.status].color}>{orderStatus[o.status].label}</Badge>
                  </td>
                  <td className="text-right">{o.itemCount}</td>
                  <td className="text-right font-medium">{formatAud(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.data && <Pagination page={page} limit={LIMIT} total={orders.data.total} onPage={(page) => set({ page })} />}
        </QueryState>
      </div>
    </>
  );
}
