import type { Category, Paginated, ProductSummary } from "@novap/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { delay, pad, Star, useReveal } from "../components/editorial";
import { Price, useTitle } from "../components/ui";
import { api, assetUrl } from "../lib/api";
import { useMe } from "../lib/auth";
// Collage art, cut out of the brand's artwork sheet. Decorative, so every use has alt="".
import angel from "../assets/home/angel.webp";
import blossom from "../assets/home/blossom.webp";
import bust from "../assets/home/bust.webp";
import lion from "../assets/home/lion.webp";
import pagoda from "../assets/home/pagoda.webp";
import street from "../assets/home/street.webp";
import torii from "../assets/home/torii.webp";

function productTag(p: ProductSummary) {
  return !p.inStock ? "Sold out" : p.onSale ? "Sale" : "Featured";
}

export function HomePage() {
  useTitle(undefined);
  const me = useMe();
  const featured = useQuery({
    queryKey: ["products", { featured: true }],
    queryFn: () => api.get<Paginated<ProductSummary>>("/api/products", { featured: "true", limit: 6 }),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });
  const products = featured.data?.items ?? [];
  // Empty categories would lead to an empty page.
  const shownCategories = categories.data?.filter((c) => c.productCount > 0).slice(0, 4) ?? [];

  const ref = useReveal(`${products.length}-${shownCategories.length}`);

  return (
    <div ref={ref} className="bg-sand">
      <Hero products={products} />
      {shownCategories.length > 0 && <Collections categories={shownCategories} />}
      <Featured products={products.slice(0, 3)} loading={featured.isPending} />
      <Manifesto />

      <section className="grain relative overflow-hidden bg-crimson text-paper">
        {/* Multiply turns the grey stone into a darker shade of the panel's own red. No .reveal
            here: its translate would isolate the image and the blend would have nothing under it. */}
        <img
          src={angel}
          alt=""
          className="pointer-events-none absolute right-[-30%] bottom-0 h-[80%] w-auto max-w-none mix-blend-multiply grayscale md:right-[4%] md:h-[118%]"
        />
        <div className="shell relative flex flex-col items-start gap-10 py-24 md:flex-row md:items-end md:justify-between md:py-32">
          <div>
            <p data-reveal className="reveal micro text-paper/70">
              Before you order
            </p>
            <h2 className="headline mt-6 max-w-3xl text-6xl md:text-8xl">
              <span data-reveal className="mask" style={delay(80)}>
                <span>Questions,</span>
              </span>
              <span data-reveal className="mask" style={delay(200)}>
                <span>answered.</span>
              </span>
            </h2>
          </div>
          <div data-reveal className="reveal flex flex-wrap items-center gap-6" style={delay(320)}>
            <Link to="/contact" className="btn btn-light group">
              Contact us
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            {!me.data && (
              <Link to="/register" className="micro border-b border-paper/60 pb-2 hover:border-paper">
                Create an account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// Left: headline. Middle: collage. Right: a card that rotates through the featured products.
function Hero({ products }: { products: ProductSummary[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = products.length;
  // The list can shrink after a refetch; never index past its end.
  const at = count ? index % count : 0;
  const current = products[at];
  const step = (by: number) => setIndex((at + by + count) % count);

  return (
    <section
      className="grain relative overflow-hidden border-b border-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Layout-grid hairlines, like crop marks on a proof sheet. */}
      <span aria-hidden data-reveal className="rule-y absolute inset-y-0 left-[39%] hidden w-px bg-ink/15 lg:block" style={delay(200)} />
      <span aria-hidden data-reveal className="rule-y absolute inset-y-0 right-[21%] hidden w-px bg-ink/15 lg:block" style={delay(350)} />
      <span aria-hidden data-reveal className="rule-x absolute inset-x-0 top-[30%] hidden h-px bg-ink/15 lg:block" style={delay(500)} />

      <div className="shell relative grid items-center gap-12 py-14 md:py-20 lg:min-h-[min(calc(100svh-6rem),54rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,4.6fr)_minmax(0,2.4fr)] lg:gap-8">
        <div className="relative z-10">
          <p data-reveal className="reveal micro flex items-center gap-3 text-ink/70">
            <Star className="size-3 text-crimson" />
            The NŌVAP collection — Worldwide
          </p>
          {/* Wider than its column on purpose: the headline runs over the collage. */}
          <h1 className="headline mt-8 text-[clamp(4.75rem,12.5vw,11rem)] whitespace-nowrap">
            <span data-reveal className="mask" style={delay(100)}>
              <span>Made</span>
            </span>
            <span data-reveal className="mask" style={delay(220)}>
              <span>with</span>
            </span>
            <span data-reveal className="mask text-crimson" style={delay(340)}>
              <span className="italic">Intent.</span>
            </span>
          </h1>
          <p data-reveal className="reveal mt-8 max-w-xs font-editorial text-xl leading-snug md:text-2xl" style={delay(520)}>
            Fewer pieces, each one here for a reason. Nothing made just to fill a shelf.
          </p>
          <div data-reveal className="reveal mt-9" style={delay(620)}>
            <Link to="/shop" className="btn btn-dark group">
              Explore collection
              <span aria-hidden className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5">
                ↗
              </span>
            </Link>
          </div>

          {count > 1 && (
            <div data-reveal className="reveal mt-12 flex max-w-sm items-center gap-5" style={delay(720)}>
              <span className="micro tabular-nums">
                {pad(at + 1)} <span className="mx-1.5 text-ink/40">/</span> {pad(count)}
              </span>
              <span className="relative h-px flex-1 bg-ink/20">
                {/* The bar is also the autoplay timer: the next slide starts when its animation
                    ends. Pausing it pauses autoplay, and with reduced motion it never runs. */}
                <span
                  key={at}
                  onAnimationEnd={() => step(1)}
                  className="absolute inset-0 origin-left animate-progress bg-ink"
                  style={{ animationPlayState: paused ? "paused" : "running" }}
                />
              </span>
              <button aria-label="Previous featured piece" onClick={() => step(-1)} className="p-1 text-xl leading-none transition-transform hover:-translate-x-1">
                ←
              </button>
              <button aria-label="Next featured piece" onClick={() => step(1)} className="p-1 text-xl leading-none transition-transform hover:translate-x-1">
                →
              </button>
            </div>
          )}
        </div>

        <div className="relative mx-auto aspect-5/6 w-full max-w-md lg:max-w-none">
          <div data-reveal className="sun absolute top-[3%] left-[4%] aspect-square w-[82%] rounded-full bg-crimson" style={delay(250)} />
          <div aria-hidden className="halftone absolute right-0 bottom-[6%] h-[38%] w-[58%] mask-[linear-gradient(to_top_left,black,transparent_75%)]" />

          {/* Back to front: temple, statue, blossom branch. Each wrapper fades up; the branch
              also drifts, on the img so the two motions don't share one transform. */}
          <div data-reveal className="reveal absolute right-[-7%] bottom-[5%] w-[64%]" style={delay(450)}>
            <img src={pagoda} alt="" className="w-full mask-[linear-gradient(to_bottom,black_70%,transparent)]" />
          </div>
          <div data-reveal className="reveal absolute bottom-0 left-[-6%] w-[80%]" style={delay(600)}>
            {/* Both cut-outs fade out at the bottom, so they rise out of the paper instead of ending on a hard edge. */}
            <img src={bust} alt="" className="w-full mask-[linear-gradient(to_bottom,black_78%,transparent)]" />
          </div>
          <div data-reveal className="reveal absolute top-[-3%] right-[-5%] w-[44%]" style={delay(800)}>
            <img src={blossom} alt="" className="w-full animate-drift" />
          </div>

          <Star className="absolute top-[30%] left-[-4%] size-6 animate-drift text-ink" />
          <Star className="absolute bottom-[14%] left-0 size-3 animate-drift text-crimson [animation-delay:-4s]" />
        </div>

        {current && (
          <Link
            key={current.id}
            to={`/products/${current.slug}`}
            className="group relative z-10 flex animate-slide-in flex-col justify-between gap-10 border border-ink/40 bg-sand/70 p-6 backdrop-blur-sm [animation-delay:120ms] lg:min-h-80"
          >
            <span className="micro w-fit bg-ink px-2.5 py-1.5 text-paper">{productTag(current)}</span>
            <span className="block">
              {current.image && (
                <img
                  src={assetUrl(current.image.url)}
                  alt={current.image.alt || current.name}
                  className="mb-5 aspect-square w-full bg-stone object-cover"
                />
              )}
              <span className="headline block text-4xl lg:text-3xl xl:text-4xl">{current.name}</span>
              {current.subtitle && <span className="mt-3 block text-sm text-ink/70">{current.subtitle}</span>}
              <span className="mt-4 block text-sm">
                <Price cents={current.priceFromCents} from />
              </span>
            </span>
            <span className="micro flex w-fit items-center gap-3 border-b border-ink pb-2">
              Shop now
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}

// Per tile: colours, a fade of the same colour behind the label, and how the art sits on it.
// On the lighter tiles the art is multiplied in, so it takes the tile's colour like a duotone print.
const tiles = [
  { theme: "bg-ink text-paper", fade: "from-ink", src: lion, art: "right-[-3%] bottom-0 h-[82%] opacity-65" },
  { theme: "bg-crimson text-paper", fade: "from-crimson", src: torii, art: "right-[-5%] bottom-[-2%] h-[84%] opacity-90 mix-blend-multiply" },
  { theme: "bg-stone text-ink", fade: "from-stone", src: pagoda, art: "right-[-8%] bottom-[-4%] h-[86%] mix-blend-multiply" },
  { theme: "bg-[#22201e] text-paper", fade: "from-[#22201e]", src: blossom, art: "top-[12%] right-[-8%] w-[85%] opacity-85" },
];
// Full class names, so Tailwind's scanner can see them.
const tileGrid = ["", "", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-2 xl:grid-cols-4"];

function Collections({ categories }: { categories: Category[] }) {
  return (
    <section className="shell grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-10">
      <div className="lg:pt-4">
        <p data-reveal className="reveal micro text-crimson">
          Collections
        </p>
        <h2 className="headline mt-6 text-5xl md:text-6xl">
          <span data-reveal className="mask" style={delay(80)}>
            <span>Shop by</span>
          </span>
          <span data-reveal className="mask" style={delay(180)}>
            <span>Collection</span>
          </span>
        </h2>
        <p data-reveal className="reveal mt-6 max-w-[16rem] leading-relaxed text-ink/70" style={delay(280)}>
          The whole range, sorted so you can find your piece.
        </p>
        <Link data-reveal to="/shop" className="reveal micro group mt-8 inline-flex items-center gap-3 border-b border-ink pb-2" style={delay(360)}>
          View everything
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>

      <div className={`grid gap-4 ${tileGrid[categories.length]}`}>
        {categories.map((c, i) => {
          const tile = tiles[i % tiles.length]!;
          return (
          <Link
            key={c.id}
            data-reveal
            to={`/shop?category=${encodeURIComponent(c.slug)}`}
            style={delay(i * 120)}
            className={`reveal group relative flex h-80 flex-col justify-between overflow-hidden p-6 md:h-104 ${tile.theme}`}
          >
            <img
              src={tile.src}
              alt=""
              className={`pointer-events-none absolute max-w-none transition-transform duration-1000 ease-editorial group-hover:scale-105 ${tile.art}`}
            />
            <span aria-hidden className={`absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t to-transparent ${tile.fade}`} />
            <span className="micro relative flex justify-between opacity-80">
              <span>
                {c.productCount} {c.productCount === 1 ? "piece" : "pieces"}
              </span>
              <span className="tabular-nums">
                {pad(i + 1)} / {pad(categories.length)}
              </span>
            </span>
            <span className="relative">
              <span className="headline block text-4xl md:text-5xl">{c.name}</span>
              <span className="micro mt-4 flex items-center gap-3">
                Shop now
                <span aria-hidden className="transition-transform group-hover:translate-x-1.5">
                  →
                </span>
              </span>
            </span>
          </Link>
          );
        })}
      </div>
    </section>
  );
}

function Featured({ products, loading }: { products: ProductSummary[]; loading: boolean }) {
  return (
    <section className="border-y border-ink/20 bg-paper">
      <div className="shell grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-10">
        <div>
          <Star className="size-4 text-crimson" />
          <h2 className="headline mt-6 text-5xl md:text-6xl">
            <span data-reveal className="mask">
              <span>Featured</span>
            </span>
            <span data-reveal className="mask" style={delay(100)}>
              <span>Pieces</span>
            </span>
          </h2>
          <p data-reveal className="reveal mt-6 max-w-[16rem] leading-relaxed text-ink/70" style={delay(200)}>
            So you dont have to wander far.
          </p>
          <Link data-reveal to="/shop" className="reveal micro group mt-8 inline-flex items-center gap-3 border-b border-ink pb-2" style={delay(280)}>
            Shop all
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((p, i) => (
            <article key={p.id} data-reveal className="reveal group min-w-0" style={delay(i * 120)}>
              <Link to={`/products/${p.slug}`} className="block">
                <div className="relative aspect-square overflow-hidden bg-stone">
                  {p.image ? (
                    <img
                      src={assetUrl(p.image.url)}
                      alt={p.image.alt || p.name}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-1000 ease-editorial group-hover:scale-105"
                    />
                  ) : (
                    <div className="headline grid size-full place-items-center text-9xl text-ink/10 transition-transform duration-1000 ease-editorial group-hover:scale-110">
                      Ō
                    </div>
                  )}
                  <span className="micro absolute top-3 right-3 rounded-full bg-ink px-3 py-1.5 text-[9px] text-paper">{productTag(p)}</span>
                </div>
                <div className="flex items-end justify-between gap-4 pt-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium tracking-tight">{p.name}</h3>
                    <p className="mt-1 text-sm">
                      <Price cents={p.priceFromCents} from />
                    </p>
                  </div>
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center bg-ink text-lg font-light text-paper transition-colors group-hover:bg-crimson">
                    +
                  </span>
                </div>
              </Link>
            </article>
          ))}

          {!loading && products.length === 0 && (
            <p className="text-muted sm:col-span-2">
              Nothing featured right now.{" "}
              <Link to="/shop" className="link">
                Browse everything
              </Link>
              .
            </p>
          )}

          {/* Closing tile: fills the row and leads on to the full catalogue. */}
          <Link
            data-reveal
            to="/shop"
            style={delay(products.length * 120)}
            className="reveal group relative flex min-h-64 flex-col justify-end overflow-hidden bg-ink p-6 text-paper"
          >
            <span aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full bg-crimson transition-transform duration-1000 ease-editorial group-hover:scale-125" />
            <span className="headline relative text-4xl">
              The full
              <br />
              range.
            </span>
            <span className="micro relative mt-5 flex w-fit items-center gap-3 border-b border-paper/60 pb-2">
              Browse all
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

const principles = [
  { title: "Listed in full", body: "Every piece comes with its complete details and every option, before you add it to the cart." },
  { title: "Priced plainly", body: "Every piece shows one clear price up front, before it goes anywhere near your cart." },
  { title: "Shipped worldwide", body: "Wherever you are, we send it, with secure payments handled by Stripe." },
];

function Manifesto() {
  return (
    <section className="grain relative overflow-hidden">
      {/* A guardian lion sits on the edge of the red panel below, the sun coming up behind it. */}
      <div
        aria-hidden
        data-reveal
        className="sun absolute right-[8%] bottom-8 size-44 rounded-full bg-crimson md:right-[12%] md:bottom-12 md:size-64"
        style={delay(200)}
      />
      <div data-reveal className="reveal pointer-events-none absolute right-[14%] bottom-0 h-56 md:right-[17%] md:h-80" style={delay(400)}>
        <img src={lion} alt="" className="h-full w-auto max-w-none" />
      </div>

      <div className="shell relative grid gap-14 pt-24 pb-72 md:pt-32 md:pb-64 lg:grid-cols-2 lg:gap-20">
        <div>
          <p data-reveal className="reveal micro flex items-center gap-3 text-crimson">
            <Star className="size-3" />
            How we work
          </p>
          <h2 className="headline mt-6 text-6xl md:text-7xl xl:text-8xl">
            <span data-reveal className="mask" style={delay(80)}>
              <span>Fewer things,</span>
            </span>
            <span data-reveal className="mask" style={delay(200)}>
              <span>
                done <span className="text-crimson">properly.</span>
              </span>
            </span>
          </h2>

          {/* Pinboard: a taped print over a halftone patch, with a branch laid across its corner. */}
          <div data-reveal className="reveal relative mt-16 h-64 max-w-md md:h-72" style={delay(350)}>
            <div aria-hidden className="halftone absolute top-10 left-[38%] h-52 w-56 mask-[radial-gradient(closest-side,black,transparent)]" />
            <div className="group absolute top-0 left-2 w-64 -rotate-3 transition-transform duration-700 ease-editorial hover:rotate-0 md:w-80">
              <img src={street} alt="" className="w-full drop-shadow-[0_18px_22px_rgb(0_0_0/0.3)]" />
              <span aria-hidden className="absolute -top-3 left-1/2 h-7 w-24 -translate-x-1/2 rotate-2 bg-champagne/80 shadow-sm" />
            </div>
            <img src={blossom} alt="" className="pointer-events-none absolute -top-10 left-48 w-44 animate-drift md:left-64 md:w-52" />
            <Star className="absolute bottom-2 left-[78%] size-5 animate-drift text-ink [animation-delay:-3s]" />
          </div>
        </div>

        <ol>
          {principles.map((p, i) => (
            <li key={p.title} className="group relative grid grid-cols-[4.5rem_1fr] gap-4 py-8 md:grid-cols-[6.5rem_1fr]">
              <span aria-hidden data-reveal className="rule-x absolute inset-x-0 top-0 h-px bg-ink" style={delay(i * 150)} />
              {/* A second, red rule wipes over the black one while the row is hovered. */}
              <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-crimson transition-transform duration-700 ease-editorial group-hover:scale-x-100" />
              <span
                data-reveal
                className="reveal headline text-5xl text-ink/15 tabular-nums transition-colors duration-500 group-hover:text-crimson md:text-7xl"
                style={delay(i * 150 + 100)}
              >
                {pad(i + 1)}
              </span>
              <div data-reveal className="reveal" style={delay(i * 150 + 150)}>
                <h3 className="font-editorial text-2xl transition-transform duration-500 ease-editorial group-hover:translate-x-2 md:text-4xl">{p.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-ink/70">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
