import {
  productCreateSchema,
  productUpdateSchema,
  type AdminProductDetail,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@novap/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ImagesEditor } from "../components/ImagesEditor";
import { Badge, Field, FormError, PageHeader, QueryState } from "../components/ui";
import { VariantsEditor } from "../components/VariantsEditor";
import { api } from "../lib/api";
import { useCategories } from "../lib/categories";
import { errorMessage, errorsFrom, validate, type FieldErrors } from "../lib/forms";

// /products/new and /products/:id share this page. Variants and images need a product id,
// so they appear once the product is saved.
export function ProductPage() {
  const { id } = useParams();
  const productId = id ? Number(id) : null;
  const product = useQuery({
    queryKey: ["products", productId],
    queryFn: () => api.get<AdminProductDetail>(`/api/admin/products/${productId}`),
    enabled: productId !== null,
  });

  return (
    <>
      <Link to="/products" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Products
      </Link>
      {productId === null ? (
        <div className="mt-2">
          <PageHeader title="New product" />
          <ProductForm />
        </div>
      ) : (
        <QueryState isPending={product.isPending} error={product.error}>
          {product.data && (
            <div className="mt-2 space-y-6">
              <PageHeader
                title={
                  <span className="flex items-center gap-3">
                    {product.data.name}
                    {product.data.visible ? <Badge color="green">Visible in shop</Badge> : <Badge color="gray">Hidden</Badge>}
                  </span>
                }
              />
              <ProductForm key={product.data.updatedAt} product={product.data} />
              <VariantsEditor product={product.data} />
              <ImagesEditor product={product.data} />
            </div>
          )}
        </QueryState>
      )}
    </>
  );
}

function readForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const slug = String(data.get("slug") ?? "").trim();
  const categoryId = String(data.get("categoryId") ?? "");
  return {
    name: data.get("name"),
    // Blank on create = generate from the name; blank on edit = keep the current slug.
    ...(slug && { slug }),
    subtitle: data.get("subtitle"),
    description: data.get("description"),
    categoryId: categoryId ? Number(categoryId) : null,
    active: data.get("active") === "on",
    featured: data.get("featured") === "on",
  };
}

function ProductForm({ product }: { product?: AdminProductDetail }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const categories = useCategories();
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = useMutation({
    mutationFn: (input: ProductCreateInput | ProductUpdateInput) =>
      product
        ? api.patch<AdminProductDetail>(`/api/admin/products/${product.id}`, input)
        : api.post<AdminProductDetail>("/api/admin/products", input),
    onSuccess: (saved) => {
      qc.setQueryData(["products", saved.id], saved);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] }); // product counts
      if (!product) navigate(`/products/${saved.id}`, { replace: true });
    },
    onError: (err) => setErrors(errorsFrom(err)),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/products/${product!.id}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["products", product!.id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      navigate("/products", { replace: true });
    },
    onError: (err) => setErrors({ form: errorMessage(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = readForm(e.currentTarget);
    const { data, errors } = product ? validate(productUpdateSchema, values) : validate(productCreateSchema, values);
    setErrors(errors ?? {});
    if (data) save.mutate(data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-5">
      <FormError message={errors.form} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <input className="input" name="name" defaultValue={product?.name} aria-invalid={!!errors.name} />
        </Field>
        <Field
          label="Slug"
          error={errors.slug}
          hint={product ? "Used in the shop URL. Changing it breaks old links." : "Leave blank to make one from the name"}
        >
          <input className="input font-mono" name="slug" defaultValue={product?.slug} aria-invalid={!!errors.slug} />
        </Field>
        <Field label="Subtitle" error={errors.subtitle} hint="Optional">
          <input className="input" name="subtitle" defaultValue={product?.subtitle ?? ""} aria-invalid={!!errors.subtitle} />
        </Field>
        <Field label="Category" error={errors.categoryId}>
          <select className="input" name="categoryId" defaultValue={product?.category?.id ?? ""}>
            <option value="">No category</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description" error={errors.description}>
        <textarea className="input min-h-32" name="description" defaultValue={product?.description} />
      </Field>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
          Active <span className="text-zinc-500">(shown in the shop once it has an active variant)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} />
          Featured on the home page
        </label>
      </div>
      <div className="flex items-center gap-3 border-t border-zinc-100 pt-4">
        <button className="btn btn-primary" disabled={save.isPending}>
          {product ? "Save product" : "Create product"}
        </button>
        {product && (
          <button
            type="button"
            className="btn btn-danger ml-auto"
            disabled={remove.isPending}
            onClick={() =>
              confirm(`Delete "${product.name}" with all its variants and images? Past orders keep their copy of the details.`) &&
              remove.mutate()
            }
          >
            Delete product
          </button>
        )}
      </div>
    </form>
  );
}
