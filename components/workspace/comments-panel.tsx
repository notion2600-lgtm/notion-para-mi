"use client";

import { Check, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useComments } from "@/hooks/use-comments";
import type { WorkspaceMember } from "@/lib/types";

function formatCommentDate(iso: string) {
  return new Date(iso).toLocaleString("es", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function CommentsPanel({
  members,
  onClose,
  pageId,
  userId,
  userLabel,
}: {
  members: WorkspaceMember[];
  onClose: () => void;
  pageId: string;
  userId: string;
  userLabel: string;
}) {
  const { addComment, comments, deleteComment, setResolved } = useComments(
    pageId,
    { id: userId, label: userLabel },
    members,
  );
  const [draft, setDraft] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const visible = comments.filter((comment) => showResolved || !comment.resolved);

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await addComment(userId, body);
  }

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-40 flex w-[min(380px,calc(100vw-24px))] flex-col border-l bg-white shadow-2xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <MessageSquare className="size-4" /> Comentarios
        </span>
        <div className="flex items-center gap-1">
          <button
            className={`rounded-md px-2 py-1 text-xs font-medium ${
              showResolved ? "bg-zinc-100 text-zinc-700" : "text-zinc-400 hover:bg-zinc-100"
            }`}
            onClick={() => setShowResolved((current) => !current)}
            type="button"
          >
            Resueltos
          </button>
          <button
            aria-label="Cerrar comentarios"
            className="grid size-8 place-items-center rounded-md hover:bg-zinc-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {visible.length === 0 && (
          <p className="mt-10 text-center text-sm text-zinc-400">
            {showResolved ? "No hay comentarios." : "No hay comentarios abiertos."}
          </p>
        )}
        <div className="space-y-3">
          {visible.map((comment) => (
            <div
              className={`rounded-lg border p-3 ${comment.resolved ? "bg-zinc-50 opacity-70" : "bg-white"}`}
              key={comment.id}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {comment.author_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-xs font-medium text-zinc-800">
                    {comment.author_name}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-400">
                    {formatCommentDate(comment.created_at)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    aria-label={comment.resolved ? "Reabrir comentario" : "Marcar como resuelto"}
                    className="grid size-6 place-items-center rounded hover:bg-zinc-100"
                    onClick={() => void setResolved(comment.id, !comment.resolved)}
                    type="button"
                  >
                    {comment.resolved ? (
                      <RotateCcw className="size-3.5 text-zinc-500" />
                    ) : (
                      <Check className="size-3.5 text-zinc-500" />
                    )}
                  </button>
                  {comment.user_id === userId && (
                    <button
                      aria-label="Eliminar comentario"
                      className="grid size-6 place-items-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      onClick={() => void deleteComment(comment.id)}
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{comment.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t p-3">
        <textarea
          className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Escribe un comentario…"
          rows={2}
          value={draft}
        />
        <div className="mt-2 flex justify-end">
          <Button disabled={!draft.trim()} onClick={() => void submit()} size="sm">
            Comentar
          </Button>
        </div>
      </div>
    </aside>
  );
}
