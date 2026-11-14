import { useEffect, useRef, type CSSProperties } from "react";

// Shared pieces of the editorial look (landing page and catalogue). The classes they drive
// (.reveal, .mask, .rule-x, .sun ...) live in index.css.

// Stagger for the reveal classes in index.css: they read --d as their transition delay.
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export const pad = (n: number) => String(n).padStart(2, "0");

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
