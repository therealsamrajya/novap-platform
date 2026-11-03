import { formatAud } from "@novap/shared";
import { useEffect, type ReactNode } from "react";

export function useTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} — NŌVAP` : "NŌVAP";
  }, [title]);
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-red-700">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">
      {message}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="border-l-2 border-champagne bg-sand px-5 py-4 text-sm leading-relaxed text-neutral-700">{children}</div>;
}

// Sale price with the original struck through, when compareAt is higher.
export function Price({ cents, compareAt, from }: { cents: number; compareAt?: number | null; from?: boolean }) {
  const onSale = compareAt != null && compareAt > cents;
  return (
    <span className="inline-flex items-baseline gap-2">
      {from && <span className="text-muted">From</span>}
      <span className={onSale ? "text-red-800" : ""}>{formatAud(cents)}</span>
      {onSale && <s className="text-sm text-muted">{formatAud(compareAt)}</s>}
    </span>
  );
}

export function QueryState({
  isPending,
  error,
  children,
}: {
  isPending: boolean;
  error: Error | null;
  children: ReactNode;
}) {
  if (isPending) return <p className="py-16 text-sm text-muted">Loading…</p>;
  if (error) return <p className="py-16 text-sm text-red-700">{error.message}</p>;
  return children;
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-14 flex items-center justify-center gap-3">
      <button className="btn btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="micro px-3 text-muted">
        {page} / {pages}
      </span>
      <button className="btn btn-outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

// Big page heading on a sand band, like the reference site's inner pages.
export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="bg-sand py-16 md:py-24">
      <div className="shell">
        <p className="micro text-muted">{eyebrow}</p>
        <h1 className="display mt-6 max-w-5xl text-5xl md:text-7xl lg:text-8xl">{title}</h1>
        {children && <div className="mt-6 max-w-xl leading-relaxed text-muted">{children}</div>}
      </div>
    </section>
  );
}
