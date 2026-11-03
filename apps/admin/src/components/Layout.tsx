import type { Paginated, AdminContactMessage } from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router";
import { api } from "../lib/api";
import { useLogout, useMe } from "../lib/auth";

const nav = [
  { to: "/orders", label: "Orders" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/inbox", label: "Inbox" },
];

export function Layout() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  // `total` of the new-message list is the unread count; one row is enough to get it.
  const unread = useQuery({
    queryKey: ["contact", "unread"],
    queryFn: () => api.get<Paginated<AdminContactMessage>>("/api/admin/contact", { status: "new", limit: 1 }),
    select: (d) => d.total,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="px-5 py-5 text-lg font-semibold tracking-wide">
          NŌVAP <span className="text-xs font-normal text-zinc-500">admin</span>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`
              }
            >
              {item.label}
              {item.to === "/inbox" && !!unread.data && (
                <span className="rounded-full bg-sky-600 px-1.5 text-xs text-white">{unread.data}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-zinc-200 px-5 py-4 text-sm">
          <div className="truncate font-medium">{me.data?.name}</div>
          <div className="truncate text-xs text-zinc-500">{me.data?.email}</div>
          <button
            className="mt-3 text-xs text-zinc-600 underline hover:text-zinc-900"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/login") })}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
