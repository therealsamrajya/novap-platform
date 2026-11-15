import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useMe } from "../lib/auth";
import { useCartCount } from "../lib/cart";

const nav = [
  { to: "/shop", label: "Shop" },
  { to: "/contact", label: "Contact" },
];

// The wordmark, in the editorial serif. With `sun`, the Ō sits on a small red disc: the same
// sun the landing page hero is built around.
export function Brand({ className = "", sun = false }: { className?: string; sun?: boolean }) {
  return (
    <span className={`isolate font-editorial font-semibold tracking-[-0.04em] ${className}`}>
      N
      <span className="relative">
        {sun && (
          <span
            aria-hidden
            className="absolute top-[56%] left-1/2 -z-10 size-[0.92em] -translate-1/2 rounded-full bg-crimson transition-transform duration-700 ease-editorial group-hover:scale-125"
          />
        )}
        Ō
      </span>
      VAP
    </span>
  );
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

  // Links get a hairline that draws in from the left; it stays drawn on the current page.
  const navLink = ({ isActive }: { isActive: boolean }) =>
    `micro relative py-3 after:absolute after:inset-x-0 after:bottom-1.5 after:h-px after:origin-left after:bg-ink after:transition-transform after:duration-500 after:ease-editorial hover:after:scale-x-100 ${
      isActive ? "after:scale-x-100" : "after:scale-x-0"
    }`;

  // The masthead is printed on the same sand paper as the hero band under it, so it reads as
  // the top of the sheet, not a bar laid over it. The landing page, catalogue and product
  // pages open on grained paper, so there the masthead gets the same grain.
  const home = location.pathname === "/" || location.pathname === "/shop" || location.pathname.startsWith("/products/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className={`sticky top-0 z-40 bg-sand/90 backdrop-blur-md ${home ? "grain" : ""}`}>
        {/* Magazine masthead: contents on the left, wordmark in the middle, account on the right. */}
        <div className="shell grid h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 md:h-24">
          <div className="flex items-center">
            <nav className="hidden items-center gap-9 md:flex" aria-label="Main">
              {nav.map((item, i) => (
                <NavLink key={item.to} to={item.to} className={navLink}>
                  <span aria-hidden className="mr-2 text-crimson tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              className="micro py-3 md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
          <Link to="/" aria-label="NŌVAP home" className="group animate-slide-in px-2">
            <Brand sun className="text-4xl md:text-5xl" />
          </Link>
          <div className="flex items-center justify-end gap-7">
            <NavLink to={me.data ? "/account" : "/login"} className={(state) => `${navLink(state)} hidden sm:block`}>
              {me.data ? "Account" : "Log in"}
            </NavLink>
            <NavLink to="/cart" className={navLink} aria-label={`Cart, ${count} items`}>
              Cart
              <span className="ml-2 inline-grid size-5 place-items-center rounded-full bg-ink text-[9px] text-paper">{count}</span>
            </NavLink>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" className="shell flex flex-col pb-6 md:hidden" aria-label="Mobile">
            {[...nav, { to: me.data ? "/account" : "/login", label: me.data ? "Account" : "Log in" }].map((item) => (
              <NavLink key={item.to} to={item.to} className="border-b border-ink/20 py-4 font-editorial text-2xl">
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
        {/* Same faint hairline as the hero's layout grid, so the masthead is one more cell of it. */}
        <div aria-hidden className="h-px bg-ink/15" />
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
