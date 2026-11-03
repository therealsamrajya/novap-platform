import {
  formatAud,
  variantCreateSchema,
  variantUpdateSchema,
  type AdminProductDetail,
  type AdminVariant,
  type VariantCreateInput,
  type VariantUpdateInput,
} from "@novap/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { errorMessage, errorsFrom, validate, type FieldErrors } from "../lib/forms";
import { centsToDollars, dollarsToCents } from "../lib/money";
import { Badge, Field, FormError } from "./ui";

// "size: small" per line <-> { size: "small" }. Blank = no attributes.
const attributesToText = (a: Record<string, string> | null) =>
  a ? Object.entries(a).map(([k, v]) => `${k}: ${v}`).join("\n") : "";

// undefined = a line isn't "name: value".
function parseAttributes(text: string): Record<string, string> | null | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const out: Record<string, string> = {};
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i < 1) return undefined;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

// Turns the form's strings into the schema's numbers and nulls. Problems the schema can't
// see (a price like "12.345") come back as errors next to the field.
function readForm(form: HTMLFormElement): { values: Record<string, unknown>; errors: FieldErrors } {
  const data = new FormData(form);
  const text = (k: string) => String(data.get(k) ?? "").trim();
  const errors: FieldErrors = {};

  const priceCents = dollarsToCents(text("price"));
  if (priceCents === null) errors.priceCents = "Enter a price like 54.95";
  const compareAtCents = text("compareAt") ? dollarsToCents(text("compareAt")) : null;
  if (text("compareAt") && compareAtCents === null) errors.compareAtCents = "Enter a price like 64.95, or leave blank";
  const attributes = parseAttributes(text("attributes"));
  if (attributes === undefined) errors.attributes = "One “name: value” per line";

  return {
    values: {
      sku: text("sku"),
      label: text("label"),
      priceCents,
      compareAtCents,
      stock: text("stock") === "" ? undefined : Number(text("stock")),
      attributes,
      active: data.get("active") === "on",
      sortOrder: text("sortOrder") === "" ? undefined : Number(text("sortOrder")),
    },
    errors,
  };
}

export function VariantsEditor({ product }: { product: AdminProductDetail }) {
  const [editing, setEditing] = useState<number | "new" | null>(product.variants.length ? null : "new");

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <h2 className="font-medium">Variants</h2>
        {editing !== "new" && (
          <button className="btn" onClick={() => setEditing("new")}>
            Add variant
          </button>
        )}
      </header>
      {!product.variants.length && editing !== "new" && (
        <p className="px-5 py-4 text-sm text-zinc-500">No variants yet. The product needs one to be sold.</p>
      )}
      <ul className="divide-y divide-zinc-100">
        {product.variants.map((v) =>
          editing === v.id ? (
            <li key={v.id} className="bg-zinc-50 p-5">
              <VariantForm productId={product.id} variant={v} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={v.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
              <div className="min-w-40 flex-1">
                <span className="font-medium">{v.label}</span>
                <span className="ml-2 font-mono text-xs text-zinc-500">{v.sku}</span>
              </div>
              <div className="w-28 text-right">
                {formatAud(v.priceCents)}
                {v.compareAtCents !== null && v.compareAtCents > v.priceCents && (
                  <div className="text-xs text-zinc-500 line-through">{formatAud(v.compareAtCents)}</div>
                )}
              </div>
              <div className={`w-24 text-right ${v.stock === 0 ? "text-red-700" : ""}`}>{v.stock} in stock</div>
              <div className="w-20">{v.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}</div>
              <button className="btn" onClick={() => setEditing(v.id)}>
                Edit
              </button>
            </li>
          ),
        )}
        {editing === "new" && (
          <li className="bg-zinc-50 p-5">
            <VariantForm productId={product.id} onDone={() => setEditing(null)} />
          </li>
        )}
      </ul>
    </section>
  );
}

function VariantForm({ productId, variant, onDone }: { productId: number; variant?: AdminVariant; onDone: () => void }) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    onDone();
  };

  const save = useMutation({
    mutationFn: (input: VariantCreateInput | VariantUpdateInput) =>
      variant
        ? api.patch<AdminVariant>(`/api/admin/variants/${variant.id}`, input)
        : api.post<AdminVariant>(`/api/admin/products/${productId}/variants`, input),
    onSuccess: refresh,
    onError: (err) => setErrors(errorsFrom(err)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/variants/${variant!.id}`),
    onSuccess: refresh,
    onError: (err) => setErrors({ form: errorMessage(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { values, errors: inputErrors } = readForm(e.currentTarget);
    const result = variant ? validate(variantUpdateSchema, values) : validate(variantCreateSchema, values);
    // Our own messages win over the schema's ("expected number, received null").
    setErrors({ ...result.errors, ...inputErrors });
    if (result.data && !Object.keys(inputErrors).length) save.mutate(result.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={errors.form} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Label" error={errors.label} hint="Shown to buyers, e.g. Small">
          <input className="input" name="label" defaultValue={variant?.label} aria-invalid={!!errors.label} />
        </Field>
        <Field label="SKU" error={errors.sku}>
          <input className="input font-mono" name="sku" defaultValue={variant?.sku} aria-invalid={!!errors.sku} />
        </Field>
        <Field label="Price (AUD, incl. GST)" error={errors.priceCents}>
          <input
            className="input"
            name="price"
            inputMode="decimal"
            defaultValue={variant ? centsToDollars(variant.priceCents) : ""}
            aria-invalid={!!errors.priceCents}
          />
        </Field>
        <Field label="Compare-at price" error={errors.compareAtCents} hint="Optional. Shows as a sale when higher">
          <input
            className="input"
            name="compareAt"
            inputMode="decimal"
            defaultValue={variant?.compareAtCents != null ? centsToDollars(variant.compareAtCents) : ""}
            aria-invalid={!!errors.compareAtCents}
          />
        </Field>
        <Field label="Stock" error={errors.stock} hint={variant ? "Sets the new count" : undefined}>
          <input className="input" name="stock" type="number" min={0} defaultValue={variant?.stock ?? 0} aria-invalid={!!errors.stock} />
        </Field>
        <Field label="Sort order" error={errors.sortOrder} hint="Lower comes first">
          <input className="input" name="sortOrder" type="number" defaultValue={variant?.sortOrder ?? 0} aria-invalid={!!errors.sortOrder} />
        </Field>
        <Field label="Attributes" error={errors.attributes} hint="Optional. One “name: value” per line" className="sm:col-span-2">
          <textarea
            className="input font-mono"
            name="attributes"
            rows={2}
            defaultValue={attributesToText(variant?.attributes ?? null)}
            aria-invalid={!!errors.attributes}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={variant?.active ?? true} />
        Active (can be bought)
      </label>
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={save.isPending}>
          {variant ? "Save variant" : "Add variant"}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        {variant && (
          <button
            type="button"
            className="btn btn-danger ml-auto"
            disabled={remove.isPending}
            onClick={() =>
              confirm(`Delete variant "${variant.label}"? To stop selling it but keep it, untick Active instead.`) &&
              remove.mutate()
            }
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
