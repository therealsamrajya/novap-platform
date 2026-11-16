import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router";
import angel from "../assets/home/angel.webp";

// Shared pieces of the editorial look (landing page and catalogue). The classes they drive
// (.reveal, .mask, .rule-x, .sun ...) live in index.css.

// Stagger for the reveal classes in index.css: they read --d as their transition delay.
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export const pad = (n: number) => String(n).padStart(2, "0");

// Underlined, serif-set form fields, like the catalogue's search box.
// Focus is ink and an error is crimson, so the two states never look alike. On focus the rule
// also thickens to 2px (a shadow, so nothing shifts): a colour change alone is too faint to
// find the field by keyboard.
export const lineField =
  "w-full rounded-none border-b border-ink/30 bg-transparent font-editorial text-xl outline-none transition-colors placeholder:text-ink/35 placeholder:italic focus:border-ink focus:shadow-[0_1px_0_0_var(--color-ink)] aria-invalid:border-crimson aria-invalid:focus:shadow-[0_1px_0_0_var(--color-crimson)]";

// Adds .is-in to every [data-reveal] element under the returned ref once it scrolls into view.
// Done with classList (not React state) so a section of 30 animated nodes costs no re-renders.
// Only put data-reveal on elements with a static className: React rewrites the whole class
// attribute when className changes, which would drop .is-in.
export function useReveal(rerunKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    root.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // rerunKey changes when API data arrives, so the new cards get observed too.
  }, [rerunKey]);
  return ref;
}

export function Star({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0l1.8 10.2L24 12l-10.2 1.8L12 24l-1.8-10.2L0 12l10.2-1.8z" />
    </svg>
  );
}

// Closing red band of the catalogue and product pages. Multiply turns the grey stone of the
// statue into a darker shade of the panel's own red.
export function AskBand() {
  return (
    <section className="relative overflow-hidden bg-crimson text-paper">
      <img
        src={angel}
        alt=""
        className="pointer-events-none absolute right-[-20%] bottom-0 h-[110%] w-auto max-w-none mix-blend-multiply grayscale md:right-[6%]"
      />
      <div className="shell relative flex flex-wrap items-end justify-between gap-8 py-14 md:py-16">
        <div>
          <p className="micro opacity-80">Need a hand choosing?</p>
          <p className="headline mt-4 text-5xl md:text-6xl">
            Ask <span className="italic">us.</span>
          </p>
        </div>
        <Link to="/contact" className="btn btn-light group">
          Contact us
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
