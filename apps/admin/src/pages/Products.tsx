import { formatAud, type AdminProductSummary, type Paginated } from "@novap/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { SearchBox } from "../components/SearchBox";
import { Badge, PageHeader, Pagination, QueryState } from "../components/ui";
import { api, assetUrl } from "../lib/api";
import { useCategories } from "../lib/categories";
import { useListParams } from "../lib/list-params";

const LIMIT = 20;

export function ProductsPage() {
  const { page, q, categoryId, active, set } = useListParams(["q", "categoryId", "active"] as const);
  const categories = useCategories();
  const products = useQuery({
    queryKey: ["products", { page, q, categoryId, active }],
    queryFn: () =>
      api.get<Paginated<AdminProductSummary>>("/api/admin/products", { page, limit: LIMIT, q, categoryId, active }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <Link to="/products/new" className="btn btn-primary">
            New product
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={active} onChange={(e) => set({ active: e.target.value })}>
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <SearchBox value={q} onSearch={(q) => set({ q })} placeholder="Name or slug" />
      </div>
      <div className="card overflow-x-auto">
        <QueryState isPending={products.isPending} error={products.error} isEmpty={products.data?.items.length === 0} empty="No products found.">
          <table className="table">
            <thead>
              <tr>
                <th className="w-14" />
                <th>Product</th>
                <th>Category</th>
                <th>Shop</th>
                <th className="text-right">Variants</th>
                <th className="text-right">Stock</th>
                <th className="text-right">From</th>
              </tr>
            </thead>
            <tbody>
              {products.data?.items.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td>
                    {p.image ? (
                      <img src={assetUrl(p.image.url)} alt="" className="size-10 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="size-10 rounded bg-zinc-100" />
                    )}
                  </td>
                  <td>
                    <Link to={`/products/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                    {p.featured && <span className="ml-2 text-xs text-amber-700">★ featured</span>}
                    <div className="font-mono text-xs text-zinc-500">{p.slug}</div>
                  </td>
                  <td className="text-zinc-600">{p.category?.name ?? "—"}</td>
                  <td>
                    {p.visible ? (
                      <Badge color="green">Visible</Badge>
                    ) : (
                      // Hidden either because it's switched off or because no variant can be sold.
                      <Badge color="gray">{p.active ? "Hidden: no active variant" : "Inactive"}</Badge>
                    )}
                  </td>
                  <td className="text-right">{p.variantCount}</td>
                  <td className={`text-right ${p.totalStock === 0 ? "text-red-700" : ""}`}>{p.totalStock}</td>
                  <td className="text-right">{p.priceFromCents === null ? "—" : formatAud(p.priceFromCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.data && <Pagination page={page} limit={LIMIT} total={products.data.total} onPage={(page) => set({ page })} />}
        </QueryState>
      </div>
    </>
  );
}
