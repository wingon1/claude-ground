import { projects } from '../projects/registry'

/**
 * The home screen: a grid of project cards. Cards are just links to
 * #/p/<id> — clicking one navigates to the viewer, which is where the
 * actual work gets loaded and run. Nothing heavy happens here.
 */
export function Gallery() {
  // Cards explicitly disabled (enabled === false) are hidden from the grid.
  const visible = projects.filter((p) => p.enabled !== false)

  return (
    <div className="min-h-full w-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            🛠️ claude-ground
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-400">
            A playground of things I've built. Pick a card to open it — each
            project only loads and runs when you click in.
          </p>
        </header>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <li key={p.id}>
              <a
                href={`#/p/${p.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/25 hover:bg-white/10 hover:shadow-2xl hover:shadow-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-6xl">
                  <span className="transition-transform duration-300 group-hover:scale-110">
                    {p.emoji}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-semibold text-white">{p.title}</h2>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
                    {p.description}
                  </p>
                  {p.tags && p.tags.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {p.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-300"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-400">
                    Open
                    <span className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>

        <footer className="mt-16 text-sm text-slate-600">
          {visible.length} project{visible.length === 1 ? '' : 's'} · add more
          in <code className="text-slate-400">src/projects/registry.ts</code>
        </footer>
      </div>
    </div>
  )
}
