import {
  IMAGE_TYPES,
  IMAGES_PER_PRODUCT_MAX,
  imageUploadSchema,
  type AdminProductDetail,
  type AdminProductImage,
  type ImageUpdateInput,
} from "@novap/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { api, assetUrl } from "../lib/api";
import { errorMessage, validate } from "../lib/forms";
import { FormError } from "./ui";

export function ImagesEditor({ product }: { product: AdminProductDetail }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string>();
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });
  const images = product.images;
  const full = images.length >= IMAGES_PER_PRODUCT_MAX;

  // One request per file: the API takes a single image per upload.
  // Sequential, so a failure stops the rest and the error names the file.
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const { data, errors } = validate(imageUploadSchema, { file, alt: product.name });
        if (!data) throw new Error(`${file.name}: ${Object.values(errors)[0]}`);
        const body = new FormData();
        body.set("file", data.file);
        body.set("alt", data.alt);
        try {
          await api.post<AdminProductImage>(`/api/admin/products/${product.id}/images`, body);
        } catch (err) {
          throw new Error(`${file.name}: ${errorMessage(err)}`);
        }
      }
    },
    onMutate: () => setError(undefined),
    onSettled: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: ImageUpdateInput & { id: number }) =>
      api.patch<AdminProductImage>(`/api/admin/images/${id}`, input),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/images/${id}`),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  // Moving swaps the two images, then renumbers all of them 0..n-1, so equal sort orders
  // (e.g. two uploads that both got 0) can't make the move a no-op.
  const reorder = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const next = [...images];
      [next[from], next[to]] = [next[to]!, next[from]!];
      const changed = next.map((img, i) => ({ img, i })).filter(({ img, i }) => img.sortOrder !== i);
      await Promise.all(changed.map(({ img, i }) => api.patch(`/api/admin/images/${img.id}`, { sortOrder: i })));
    },
    onSettled: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ""; // so picking the same file again still fires onChange
    if (files.length) upload.mutate(files.slice(0, IMAGES_PER_PRODUCT_MAX - images.length));
  }

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <h2 className="font-medium">
          Images <span className="text-sm font-normal text-zinc-500">({images.length}/{IMAGES_PER_PRODUCT_MAX})</span>
        </h2>
        <label className={`btn ${full || upload.isPending ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
          {upload.isPending ? "Uploading…" : "Upload images"}
          <input type="file" accept={IMAGE_TYPES.join(",")} multiple className="sr-only" onChange={onFiles} disabled={full} />
        </label>
      </header>
      <div className="space-y-4 p-5">
        <FormError message={error} />
        {!images.length && <p className="text-sm text-zinc-500">No images. JPEG, PNG, WebP or AVIF, up to 5 MB each.</p>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="space-y-2">
              <div className="relative">
                <img src={assetUrl(img.url)} alt={img.alt} className="aspect-square w-full rounded-md bg-zinc-100 object-cover" />
                {i === 0 && <span className="absolute top-2 left-2 rounded bg-zinc-900/80 px-1.5 text-xs text-white">Main</span>}
              </div>
              {/* Saves when the field loses focus, and only if the text changed. */}
              <input
                className="input text-xs"
                aria-label="Alt text"
                placeholder="Alt text"
                defaultValue={img.alt}
                maxLength={200}
                onBlur={(e) => {
                  const alt = e.target.value.trim();
                  if (alt !== img.alt) update.mutate({ id: img.id, alt });
                }}
              />
              {/* Shared images show for every variant; a variant's own images show first when it's picked in the shop. */}
              {product.variants.length > 1 && (
                <select
                  className="input text-xs"
                  aria-label="Shown for"
                  value={img.variantId ?? ""}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: img.id, variantId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">All variants</option>
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                      {v.active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-1">
                <button
                  className="btn px-2"
                  aria-label="Move left"
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => reorder.mutate({ from: i, to: i - 1 })}
                >
                  ←
                </button>
                <button
                  className="btn px-2"
                  aria-label="Move right"
                  disabled={i === images.length - 1 || reorder.isPending}
                  onClick={() => reorder.mutate({ from: i, to: i + 1 })}
                >
                  →
                </button>
                <button
                  className="btn btn-danger ml-auto px-2"
                  disabled={remove.isPending}
                  onClick={() => confirm("Delete this image?") && remove.mutate(img.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
