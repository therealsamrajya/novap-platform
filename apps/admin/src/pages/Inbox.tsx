import { contactStatusValues, type AdminContactMessage, type ContactStatus, type Paginated } from "@novap/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { SearchBox } from "../components/SearchBox";
import { Badge, FormError, PageHeader, Pagination, QueryState } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { errorMessage } from "../lib/forms";
import { useListParams } from "../lib/list-params";
import { contactStatus } from "../lib/status";

const LIMIT = 20;

export function InboxPage() {
  const { page, status, q, set } = useListParams(["status", "q"] as const);
  const [openId, setOpenId] = useState<number | null>(null);
  const messages = useQuery({
    queryKey: ["contact", { page, status, q }],
    queryFn: () => api.get<Paginated<AdminContactMessage>>("/api/admin/contact", { page, limit: LIMIT, status, q }),
    placeholderData: keepPreviousData,
  });
  const open = messages.data?.items.find((m) => m.id === openId);

  return (
    <>
      <PageHeader title="Inbox" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={status} onChange={(e) => set({ status: e.target.value })}>
          {/* Without a status the API leaves archived messages out. */}
          <option value="">Inbox (new and read)</option>
          {contactStatusValues.map((s) => (
            <option key={s} value={s}>
              {contactStatus[s].label}
            </option>
          ))}
        </select>
        <SearchBox value={q} onSearch={(q) => set({ q })} placeholder="Name, email or subject" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-2">
          <QueryState isPending={messages.isPending} error={messages.error} isEmpty={messages.data?.items.length === 0} empty="No messages.">
            <ul className="divide-y divide-zinc-100">
              {messages.data?.items.map((m) => (
                <li key={m.id}>
                  <button
                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 ${m.id === openId ? "bg-zinc-100" : ""}`}
                    onClick={() => setOpenId(m.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate ${m.status === "new" ? "font-semibold" : ""}`}>{m.name}</span>
                      <span className="shrink-0 text-xs text-zinc-500">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <div className="truncate text-zinc-600">{m.subject}</div>
                  </button>
                </li>
              ))}
            </ul>
            {messages.data && <Pagination page={page} limit={LIMIT} total={messages.data.total} onPage={(page) => set({ page })} />}
          </QueryState>
        </div>
        <div className="lg:col-span-3">
          {open ? (
            <MessageView key={open.id} message={open} onDeleted={() => setOpenId(null)} />
          ) : (
            <p className="text-sm text-zinc-500">Select a message to read it.</p>
          )}
        </div>
      </div>
    </>
  );
}

function MessageView({ message, onDeleted }: { message: AdminContactMessage; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string>();
  const refresh = () => qc.invalidateQueries({ queryKey: ["contact"] });

  const setStatus = useMutation({
    mutationFn: (status: ContactStatus) => api.patch(`/api/admin/contact/${message.id}`, { status }),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/admin/contact/${message.id}`),
    onSuccess: () => {
      onDeleted();
      refresh();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  // Opening a message doesn't mark it read on the API side (GET has no side effects), so do it here.
  // Only once per opening, so "Mark unread" sticks.
  const { mutate } = setStatus;
  const autoRead = useRef(message.status === "new");
  useEffect(() => {
    if (!autoRead.current) return;
    autoRead.current = false;
    mutate("read");
  }, [mutate]);

  const reply = `mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;
  return (
    <article className="card space-y-4 p-5">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{message.subject}</h2>
          <Badge color={contactStatus[message.status].color}>{contactStatus[message.status].label}</Badge>
        </div>
        <p className="text-sm text-zinc-600">
          {message.name} &lt;{message.email}&gt; · {formatDateTime(message.createdAt)}
        </p>
      </header>
      <FormError message={error} />
      {/* Plain text: React escapes it, and whitespace-pre-wrap keeps the sender's line breaks. */}
      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
        <a className="btn btn-primary" href={reply}>
          Reply by email
        </a>
        {message.status === "archived" ? (
          <button className="btn" onClick={() => setStatus.mutate("read")} disabled={setStatus.isPending}>
            Move to inbox
          </button>
        ) : (
          <button className="btn" onClick={() => setStatus.mutate("archived")} disabled={setStatus.isPending}>
            Archive
          </button>
        )}
        {message.status === "read" && (
          <button className="btn" onClick={() => setStatus.mutate("new")} disabled={setStatus.isPending}>
            Mark unread
          </button>
        )}
        <button
          className="btn btn-danger ml-auto"
          disabled={remove.isPending}
          onClick={() => confirm("Delete this message permanently?") && remove.mutate()}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
