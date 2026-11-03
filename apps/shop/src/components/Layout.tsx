import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useMe } from "../lib/auth";
import { useCartCount } from "../lib/cart";

const nav = [
  { to: "/shop", label: "Shop" },
  { to: "/contact", label: "Contact" },
];

export function Brand({ className = "" }: { className?: string }) {
  return <span className={`font-semibold tracking-[-0.09em] ${className}`}>NŌVAP</span>;
}

export function Layout() {
  const me = useMe();
  const count = useCartCount();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // New page: close the mobile menu and start at the top.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `micro py-3 border-b ${isActive ? "border-ink" : "border-transparent hover:border-ink"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="micro flex h-8 items-center justify-center bg-ink px-4 text-center text-[9px] text-neutral-300">
        Prices in AUD, GST included · <span className="ml-1 text-champagne">Australia-wide shipping</span>
      </div>

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-paper/95 backdrop-blur">
        <div className="shell grid h-18 grid-cols-[1fr_auto] items-center gap-6 md:h-20 md:grid-cols-[1fr_auto_1fr]">
          <Link to="/" aria-label="NŌVAP home">
            <Brand className="text-3xl md:text-4xl" />
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLink}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-5">
            <NavLink to={me.data ? "/account" : "/login"} className={(state) => `${navLink(state)} hidden sm:block`}>
              {me.data ? "Account" : "Log in"}
            </NavLink>
            <NavLink to="/cart" className={navLink} aria-label={`Cart, ${count} items`}>
              Cart
              <span className="ml-2 inline-grid size-5 place-items-center rounded-full bg-ink text-[9px] text-white">{count}</span>
            </NavLink>
            <button
              className="micro md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" className="shell flex flex-col pb-6 md:hidden" aria-label="Mobile">
            {[...nav, { to: me.data ? "/account" : "/login", label: me.data ? "Account" : "Log in" }].map((item) => (
              <NavLink key={item.to} to={item.to} className="border-b border-line py-4 text-lg">
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#101010] pt-20 pb-8 text-neutral-200">
        <div className="shell">
          <div className="grid gap-12 pb-16 md:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <Brand className="text-6xl" />
              <p className="micro mt-4 text-neutral-400">Considered objects, made to last.</p>
            </div>
            <FooterCol
              title="Shop"
              links={[
                { to: "/shop", label: "All products" },
                { to: "/shop?inStock=true", label: "In stock" },
                { to: "/cart", label: "Cart" },
              ]}
            />
            <FooterCol
              title="Help"
              links={[
                { to: "/contact", label: "Contact us" },
                { to: me.data ? "/account" : "/login", label: "Your account" },
              ]}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-4 border-t border-neutral-700 pt-6 text-[10px] tracking-widest text-neutral-400">
            <span>© {new Date().getFullYear()} NŌVAP</span>
            <span>Secure payments by Stripe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h2 className="micro mb-6 text-neutral-400">{title}</h2>
      <ul className="space-y-4 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="hover:text-champagne">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
