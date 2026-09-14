"use client";

import { FileImage, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconPicker } from "@/components/workspace/icon-picker";

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #fda4af, #fecdd3)",
  "linear-gradient(135deg, #93c5fd, #c4b5fd)",
  "linear-gradient(135deg, #6ee7b7, #a7f3d0)",
  "linear-gradient(135deg, #fcd34d, #fdba74)",
  "linear-gradient(135deg, #a5b4fc, #67e8f9)",
  "linear-gradient(135deg, #f9a8d4, #d8b4fe)",
  "linear-gradient(135deg, #fca5a5, #fdba74)",
  "linear-gradient(135deg, #94a3b8, #475569)",
];

function gradientFromCoverPath(coverPath: string | null | undefined): string | null {
  if (!coverPath?.startsWith("gradient:")) return null;
  const index = Number(coverPath.slice("gradient:".length));
  return COVER_GRADIENTS[index] ?? COVER_GRADIENTS[0];
}

export function PageHero({
  contentClassName = "mx-auto w-full max-w-[900px] px-5 sm:px-12",
  coverPath,
  icon,
  onUpdate,
  onUploadFile,
  properties,
  readOnly = false,
  resolveFileUrl,
  title,
  titleAriaLabel,
  titleClassName = "w-full border-none bg-transparent text-3xl font-bold tracking-[-0.035em] text-zinc-900 outline-none placeholder:text-zinc-300 sm:text-[40px] sm:leading-[1.2]",
  titlePlaceholder = "Sin título",
}: {
  contentClassName?: string;
  coverPath?: string | null;
  icon?: string | null;
  onUpdate: (changes: {
    cover_url?: string | null;
    icon?: string | null;
    properties?: Record<string, unknown>;
    title?: string;
  }) => unknown;
  onUploadFile: (file: File) => Promise<string>;
  properties?: Record<string, unknown> | null;
  readOnly?: boolean;
  resolveFileUrl: (path: string) => Promise<string>;
  title: string;
  titleAriaLabel: string;
  titleClassName?: string;
  titlePlaceholder?: string;
}) {
  const [titleValue, setTitleValue] = useState(title);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState(50);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [coverUrlDraft, setCoverUrlDraft] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const coverMenuRef = useRef<HTMLDivElement>(null);
  const gradient = gradientFromCoverPath(coverPath);

  useEffect(() => setTitleValue(title), [title]);

  useEffect(() => {
    let active = true;
    const storedPosition = properties?._cover_position;
    setCoverPosition(typeof storedPosition === "number" ? storedPosition : 50);
    if (!coverPath || gradient) {
      setCoverUrl(null);
      return;
    }
    if (/^https?:\/\//i.test(coverPath)) {
      setCoverUrl(coverPath);
      return;
    }
    void resolveFileUrl(coverPath)
      .then((url) => {
        if (active) setCoverUrl(url);
      })
      .catch(() => {
        if (active) setCoverUrl(null);
      });
    return () => {
      active = false;
    };
  }, [coverPath, gradient, properties?._cover_position, resolveFileUrl]);

  useEffect(() => {
    if (!coverMenuOpen) return;
    function onOutside(event: MouseEvent) {
      if (coverMenuRef.current && !coverMenuRef.current.contains(event.target as Node)) {
        setCoverMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [coverMenuOpen]);

  function saveTitle() {
    const nextTitle = titleValue.trim() || titlePlaceholder;
    setTitleValue(nextTitle);
    if (nextTitle !== title) void onUpdate({ title: nextTitle });
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setCoverUploading(true);
    try {
      const path = await onUploadFile(file);
      await onUpdate({ cover_url: path });
    } catch {
      // El hook de archivos ya notifica el error al usuario.
    } finally {
      setCoverUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  function saveCoverPosition(value = coverPosition) {
    void onUpdate({ properties: { ...(properties ?? {}), _cover_position: value } });
  }

  const hasCover = Boolean(coverUrl || gradient);

  return (
    <>
      {hasCover && (
        <div className="group relative h-56 w-full overflow-hidden bg-zinc-100">
          {gradient ? (
            <div className="h-full w-full" style={{ backgroundImage: gradient }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Portada"
              className="h-full w-full object-cover"
              src={coverUrl ?? undefined}
              style={{ objectPosition: `center ${coverPosition}%` }}
            />
          )}
          {!readOnly && (
            <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded-lg bg-white/95 p-2 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {!gradient && (
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                  Posición
                  <input
                    aria-label="Posición vertical de la portada"
                    className="w-28 accent-indigo-600"
                    max="100"
                    min="0"
                    onChange={(event) => setCoverPosition(Number(event.target.value))}
                    onMouseUp={() => saveCoverPosition()}
                    onTouchEnd={() => saveCoverPosition()}
                    type="range"
                    value={coverPosition}
                  />
                </label>
              )}
              <button
                aria-label="Cambiar portada"
                className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                onClick={() => setCoverMenuOpen((open) => !open)}
                type="button"
              >
                Cambiar
              </button>
              <button
                aria-label="Quitar portada"
                className="grid size-7 place-items-center rounded-md hover:bg-zinc-100"
                onClick={() => void onUpdate({ cover_url: null })}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className={`${contentClassName} ${hasCover ? "pt-8 sm:pt-10" : "pt-12 sm:pt-16"}`}>
        <div className="relative mb-4 w-fit">
          <IconPicker
            disabled={readOnly}
            icon={icon}
            onChange={(next) => void onUpdate({ icon: next })}
            triggerClassName="text-5xl leading-none transition-transform hover:scale-105"
          />
        </div>

        <div className="relative w-fit">
          {!hasCover && !readOnly && (
            <button
              className="mb-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              disabled={coverUploading}
              onClick={() => setCoverMenuOpen((open) => !open)}
              type="button"
            >
              {coverUploading ? <FileImage className="size-3.5 animate-pulse" /> : <ImagePlus className="size-3.5" />}
              {coverUploading ? "Subiendo portada…" : "Añadir portada"}
            </button>
          )}
          {coverMenuOpen && (
            <div
              className="absolute left-0 top-full z-30 w-72 rounded-xl border bg-white p-3 shadow-xl"
              ref={coverMenuRef}
            >
              <button
                className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                onClick={() => {
                  setCoverMenuOpen(false);
                  coverInput.current?.click();
                }}
                type="button"
              >
                <ImagePlus className="size-4" /> Subir imagen
              </button>
              <form
                className="mb-3 flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = coverUrlDraft.trim();
                  if (!trimmed) return;
                  void onUpdate({ cover_url: /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}` });
                  setCoverUrlDraft("");
                  setCoverMenuOpen(false);
                }}
              >
                <input
                  className="min-w-0 flex-1 rounded-md border px-2 py-1 text-xs outline-none focus:border-indigo-400"
                  onChange={(event) => setCoverUrlDraft(event.target.value)}
                  placeholder="Enlace a una imagen…"
                  value={coverUrlDraft}
                />
                <button
                  className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                  disabled={!coverUrlDraft.trim()}
                  type="submit"
                >
                  Usar
                </button>
              </form>
              <p className="mb-1.5 text-xs font-medium text-zinc-500">Degradados</p>
              <div className="grid grid-cols-4 gap-2">
                {COVER_GRADIENTS.map((preset, index) => (
                  <button
                    aria-label={`Degradado ${index + 1}`}
                    className="h-10 rounded-md ring-1 ring-inset ring-black/5 transition-transform hover:scale-105"
                    key={preset}
                    onClick={() => {
                      void onUpdate({ cover_url: `gradient:${index}` });
                      setCoverMenuOpen(false);
                    }}
                    style={{ backgroundImage: preset }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          accept="image/*"
          className="hidden"
          onChange={(event) => void uploadCover(event.target.files?.[0])}
          ref={coverInput}
          type="file"
        />

        <input
          aria-label={titleAriaLabel}
          className={titleClassName}
          onBlur={saveTitle}
          onChange={(event) => setTitleValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder={titlePlaceholder}
          readOnly={readOnly}
          value={titleValue}
        />
      </div>
    </>
  );
}
