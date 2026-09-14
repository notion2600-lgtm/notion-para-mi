"use client";

import { useEffect, useRef, useState } from "react";

const EMOJI_LIBRARY: { icon: string; keywords: string }[] = [
  { icon: "📄", keywords: "documento pagina nota texto" },
  { icon: "📝", keywords: "nota escribir memo" },
  { icon: "✨", keywords: "brillo magia nuevo" },
  { icon: "💡", keywords: "idea bombilla ocurrencia" },
  { icon: "✅", keywords: "listo hecho check tarea" },
  { icon: "☑️", keywords: "check tarea lista" },
  { icon: "🚀", keywords: "lanzamiento cohete rapido proyecto" },
  { icon: "🎯", keywords: "objetivo meta diana enfoque" },
  { icon: "📌", keywords: "pin fijar importante" },
  { icon: "📍", keywords: "ubicacion mapa lugar" },
  { icon: "🧠", keywords: "cerebro idea pensar mente" },
  { icon: "📚", keywords: "libros lectura biblioteca estudio" },
  { icon: "📖", keywords: "libro leer manual" },
  { icon: "💼", keywords: "trabajo maletin negocio oficina" },
  { icon: "📊", keywords: "grafico datos base de datos reporte" },
  { icon: "📈", keywords: "grafico crecimiento estadistica ventas" },
  { icon: "📉", keywords: "grafico caida estadistica" },
  { icon: "🗓️", keywords: "calendario fecha agenda planificar" },
  { icon: "📅", keywords: "calendario fecha agenda" },
  { icon: "⏰", keywords: "reloj alarma tiempo hora" },
  { icon: "⌛", keywords: "tiempo espera arena" },
  { icon: "❤️", keywords: "corazon amor favorito" },
  { icon: "🔥", keywords: "fuego tendencia popular urgente" },
  { icon: "🌱", keywords: "planta crecimiento naturaleza" },
  { icon: "🌟", keywords: "estrella destacado favorito" },
  { icon: "⭐", keywords: "estrella destacado favorito" },
  { icon: "🧩", keywords: "puzzle pieza rompecabezas" },
  { icon: "🎨", keywords: "arte diseno paleta creatividad" },
  { icon: "🖌️", keywords: "pincel arte diseno" },
  { icon: "🛠️", keywords: "herramientas configuracion ajustes" },
  { icon: "⚙️", keywords: "ajustes configuracion engranaje" },
  { icon: "🔧", keywords: "llave herramienta ajuste" },
  { icon: "🔒", keywords: "candado privado seguro" },
  { icon: "🔑", keywords: "llave acceso clave" },
  { icon: "📁", keywords: "carpeta archivo" },
  { icon: "🗂️", keywords: "carpeta organizar archivo" },
  { icon: "📦", keywords: "caja paquete producto envio" },
  { icon: "🧾", keywords: "recibo factura" },
  { icon: "💰", keywords: "dinero finanzas presupuesto" },
  { icon: "💳", keywords: "tarjeta pago finanzas" },
  { icon: "🧮", keywords: "calculadora numeros matematicas" },
  { icon: "📐", keywords: "regla medida diseno" },
  { icon: "🧭", keywords: "brujula direccion guia" },
  { icon: "🗺️", keywords: "mapa viaje ruta" },
  { icon: "✈️", keywords: "avion viaje vuelo" },
  { icon: "🏠", keywords: "casa hogar" },
  { icon: "🏢", keywords: "edificio oficina empresa" },
  { icon: "🏆", keywords: "trofeo logro premio meta" },
  { icon: "🎓", keywords: "graduacion estudio educacion" },
  { icon: "🧑‍💻", keywords: "programador desarrollador trabajo" },
  { icon: "👥", keywords: "personas equipo grupo" },
  { icon: "🤝", keywords: "acuerdo equipo colaboracion" },
  { icon: "💬", keywords: "chat mensaje conversacion" },
  { icon: "📣", keywords: "anuncio marketing megafono" },
  { icon: "📧", keywords: "correo email mensaje" },
  { icon: "🔔", keywords: "notificacion alerta campana" },
  { icon: "🧵", keywords: "hilo tema conversacion" },
  { icon: "🧱", keywords: "bloque construccion base" },
  { icon: "🗃️", keywords: "archivo base de datos caja" },
  { icon: "🗒️", keywords: "nota bloc apuntes" },
  { icon: "🧑‍🎨", keywords: "diseno arte creativo" },
  { icon: "🍀", keywords: "suerte trebol naturaleza" },
  { icon: "🌈", keywords: "arcoiris colorido" },
  { icon: "☀️", keywords: "sol dia clima" },
  { icon: "🌙", keywords: "luna noche" },
  { icon: "☕", keywords: "cafe descanso bebida" },
  { icon: "🍕", keywords: "comida pizza" },
  { icon: "🎉", keywords: "fiesta celebracion evento" },
  { icon: "🎁", keywords: "regalo sorpresa" },
];

export function isImageIcon(icon?: string | null): icon is string {
  return typeof icon === "string" && /^https?:\/\//i.test(icon);
}

export function IconPicker({
  disabled = false,
  icon,
  onChange,
  size = "lg",
  triggerClassName,
}: {
  disabled?: boolean;
  icon?: string | null;
  onChange: (emoji: string | null) => void;
  size?: "sm" | "lg";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filtered = normalizedQuery
    ? EMOJI_LIBRARY.filter((entry) => entry.keywords.includes(normalizedQuery))
    : EMOJI_LIBRARY;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label="Cambiar icono"
        className={
          triggerClassName ??
          (size === "lg"
            ? "text-5xl leading-none transition-transform hover:scale-105"
            : "grid size-6 place-items-center rounded text-base leading-none hover:bg-zinc-100")
        }
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        type="button"
      >
        {isImageIcon(icon) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="inline-block size-[1em] rounded object-cover align-middle" src={icon} />
        ) : (
          icon || "📄"
        )}
      </button>
      {open && !disabled && (
        <div
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border bg-white p-3 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            className="mb-2 w-full rounded-md border px-2 py-1 text-sm outline-none focus:border-indigo-400"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar emoji…"
            value={query}
          />
          <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
            {filtered.map((entry) => (
              <button
                className="grid size-7 place-items-center rounded-md text-lg hover:bg-zinc-100"
                key={entry.icon}
                onClick={() => {
                  onChange(entry.icon);
                  setOpen(false);
                }}
                type="button"
              >
                {entry.icon}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-8 py-4 text-center text-xs text-zinc-400">Sin resultados</p>
            )}
          </div>
          <form
            className="mt-2 flex items-center gap-1 border-t pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = urlDraft.trim();
              if (!trimmed) return;
              onChange(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
              setUrlDraft("");
              setOpen(false);
            }}
          >
            <input
              className="min-w-0 flex-1 rounded-md border px-2 py-1 text-xs outline-none focus:border-indigo-400"
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="Enlace a una imagen…"
              value={urlDraft}
            />
            <button
              className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
              disabled={!urlDraft.trim()}
              type="submit"
            >
              Usar
            </button>
          </form>
          {icon && (
            <button
              className="mt-2 w-full rounded-md py-1 text-center text-xs font-medium text-zinc-500 hover:bg-zinc-100"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              type="button"
            >
              Quitar icono
            </button>
          )}
        </div>
      )}
    </div>
  );
}
