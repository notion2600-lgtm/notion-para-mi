"use client";

import { Check, Copy, Globe2, Lock, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePageShare } from "@/hooks/use-page-share";

export function ShareButton({ pageId, title }: { pageId: string; title: string }) {
  const { isLoading, publish, share, unpublish } = usePageShare(pageId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl =
    share?.public_slug && typeof window !== "undefined"
      ? `${window.location.origin}/p/${share.public_slug}`
      : "";

  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Enlace público copiado");
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)} size="sm" variant="ghost">
        <Share2 className="size-4" />
        <span className="hidden sm:inline">Compartir</span>
      </Button>
      {open && (
        <section className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${share?.is_public ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"}`}>
              {share?.is_public ? <Globe2 className="size-4" /> : <Lock className="size-4" />}
            </span>
            <div>
              <h2 className="text-sm font-semibold">Publicar en la web</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Cualquier persona con el enlace podrá leer esta página y sus subpáginas, sin iniciar sesión.
              </p>
            </div>
          </div>
          {share?.is_public ? (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  aria-label="Enlace público"
                  className="h-9 min-w-0 flex-1 rounded-md border bg-zinc-50 px-2 text-xs"
                  readOnly
                  value={publicUrl}
                />
                <Button onClick={() => void copyLink()} size="sm" variant="outline">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copiar
                </Button>
              </div>
              <button
                className="text-xs font-medium text-red-600 hover:underline"
                onClick={() => void unpublish()}
                type="button"
              >
                Dejar de publicar
              </button>
            </div>
          ) : (
            <Button
              className="mt-4 w-full"
              disabled={isLoading}
              onClick={() => void publish(title)}
              size="sm"
            >
              <Globe2 className="size-3.5" /> Publicar página
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
