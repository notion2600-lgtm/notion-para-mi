export default function PublicPageLoading() {
  return (
    <main aria-label="Cargando página pública" className="min-h-screen bg-white px-5 pt-24" id="main-content">
      <div className="mx-auto max-w-[900px]">
        <div className="size-12 animate-pulse rounded-xl bg-zinc-100" />
        <div className="mt-6 h-12 w-2/3 animate-pulse rounded-lg bg-zinc-100" />
        <div className="mt-10 space-y-3">
          <div className="h-5 animate-pulse rounded bg-zinc-100" />
          <div className="h-5 w-5/6 animate-pulse rounded bg-zinc-100" />
          <div className="h-5 w-3/5 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
    </main>
  );
}
