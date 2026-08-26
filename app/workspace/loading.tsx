export default function WorkspaceLoading() {
  return (
    <main aria-label="Cargando workspace" className="flex h-screen bg-white" id="main-content">
      <aside className="hidden w-72 shrink-0 border-r bg-zinc-50 p-4 sm:block">
        <div className="h-9 animate-pulse rounded-lg bg-zinc-200" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="h-7 animate-pulse rounded-md bg-zinc-200" key={index} />
          ))}
        </div>
      </aside>
      <div className="flex-1 px-5 pt-24 sm:px-12">
        <div className="mx-auto max-w-[900px]">
          <div className="size-12 animate-pulse rounded-xl bg-zinc-100" />
          <div className="mt-6 h-12 w-2/3 animate-pulse rounded-lg bg-zinc-100" />
          <div className="mt-10 space-y-3">
            <div className="h-5 animate-pulse rounded bg-zinc-100" />
            <div className="h-5 w-5/6 animate-pulse rounded bg-zinc-100" />
            <div className="h-5 w-3/5 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
