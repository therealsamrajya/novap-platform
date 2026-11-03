import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type AdminCategory,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from "@novap/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Field, FormError, PageHeader, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { errorMessage, errorsFrom, validate, type FieldErrors } from "../lib/forms";

// Same key as useCategories (lib/categories.ts).
const categoriesKey = ["categories"];

// Form values are strings; sortOrder needs a number for the schema. Blank slug = let the API generate it.
function readForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const slug = String(data.get("slug") ?? "").trim();
  const sortOrder = String(data.get("sortOrder") ?? "").trim();
  return {
    name: data.get("name"),
    ...(slug && { slug }),
    ...(sortOrder && { sortOrder: Number(sortOrder) }),
  };
}

export function CategoriesPage() {
  const categories = useQuery({
    queryKey: categoriesKey,
    queryFn: () => api.get<AdminCategory[]>("/api/admin/categories"),
  });
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <>
      <PageHeader title="Categories" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <QueryState isPending={categories.isPending} error={categories.error} isEmpty={categories.data?.length === 0}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th className="text-right">Order</th>
                  <th className="text-right">Products</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.data?.map((c) =>
                  editing === c.id ? (
                    <EditRow key={c.id} category={c} onDone={() => setEditing(null)} />
                  ) : (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="font-mono text-xs text-zinc-600">{c.slug}</td>
                      <td className="text-right">{c.sortOrder}</td>
                      <td className="text-right">{c.productCount}</td>
                      <td className="text-right">
                        <button className="btn" onClick={() => setEditing(c.id)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </QueryState>
        </div>
        <CreateForm />
      </div>
    </>
  );
}

function CreateForm() {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useMutation({
    mutationFn: (input: CategoryCreateInput) => api.post<AdminCategory>("/api/admin/categories", input),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const { data, errors } = validate(categoryCreateSchema, readForm(form));
    setErrors(errors ?? {});
    if (!data) return;
    create.mutate(data, {
      onSuccess: () => {
        form.reset();
        qc.invalidateQueries({ queryKey: categoriesKey });
      },
      onError: (err) => setErrors(errorsFrom(err)),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card h-fit space-y-3 p-4">
      <h2 className="font-medium">New category</h2>
      <FormError message={errors.form} />
      <Field label="Name" error={errors.name}>
        <input className="input" name="name" aria-invalid={!!errors.name} />
      </Field>
      <Field label="Slug" error={errors.slug} hint="Leave blank to make one from the name">
        <input className="input" name="slug" aria-invalid={!!errors.slug} />
      </Field>
      <Field label="Sort order" error={errors.sortOrder} hint="Lower comes first">
        <input className="input" name="sortOrder" type="number" defaultValue={0} aria-invalid={!!errors.sortOrder} />
      </Field>
      <button className="btn btn-primary" disabled={create.isPending}>
        Add category
      </button>
    </form>
  );
}

function EditRow({ category, onDone }: { category: AdminCategory; onDone: () => void }) {
  const qc = useQueryClient();
  const [errors, setErrors] = useState<FieldErrors>({});
  const done = () => {
    qc.invalidateQueries({ queryKey: categoriesKey });
    onDone();
  };
  const update = useMutation({
    mutationFn: (input: CategoryUpdateInput) => api.patch<AdminCategory>(`/api/admin/categories/${category.id}`, input),
    onSuccess: done,
    onError: (err) => setErrors(errorsFrom(err)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/categories/${category.id}`),
    onSuccess: () => {
      // Products in it now have no category, so product lists are stale too.
      qc.invalidateQueries({ queryKey: ["products"] });
      done();
    },
    onError: (err) => setErrors({ form: errorMessage(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data, errors } = validate(categoryUpdateSchema, readForm(e.currentTarget));
    setErrors(errors ?? {});
    if (data) update.mutate(data);
  }

  function onDelete() {
    const note = category.productCount ? ` Its ${category.productCount} product(s) will be kept without a category.` : "";
    if (confirm(`Delete "${category.name}"?${note}`)) remove.mutate();
  }

  // A form can't wrap table cells, so the inputs point at it with the `form` attribute.
  const formId = `category-${category.id}`;
  return (
    <tr className="bg-zinc-50">
      <td>
        <form id={formId} onSubmit={onSubmit} noValidate />
        <input form={formId} className="input" name="name" defaultValue={category.name} aria-invalid={!!errors.name} />
        {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name}</p>}
      </td>
      <td>
        <input form={formId} className="input font-mono" name="slug" defaultValue={category.slug} aria-invalid={!!errors.slug} />
        {errors.slug && <p className="mt-1 text-xs text-red-700">{errors.slug}</p>}
        <p className="mt-1 text-xs text-amber-700">Changing the slug changes shop URLs.</p>
      </td>
      <td>
        <input form={formId} className="input w-20 text-right" name="sortOrder" type="number" defaultValue={category.sortOrder} />
      </td>
      <td className="text-right">{category.productCount}</td>
      <td className="space-y-2 text-right whitespace-nowrap">
        <FormError message={errors.form} />
        <div className="flex justify-end gap-2">
          <button form={formId} className="btn btn-primary" disabled={update.isPending}>
            Save
          </button>
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={remove.isPending}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
