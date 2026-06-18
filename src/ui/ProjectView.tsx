import { lazy, Suspense, type ComponentType } from 'react'
import { findProject, projects } from '../projects/registry'

/**
 * Lazy components are created once, at module load — not during render — so a
 * project's code is fetched on demand while keeping component identity stable
 * across renders.
 */
const lazyComponents: Record<string, ComponentType> = Object.fromEntries(
  projects
    .filter((p) => p.kind === 'react')
    .map((p) => [p.id, lazy(p.load)]),
)

/** Centered spinner shown while a lazy project chunk is downloading. */
function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />
      <p className="text-sm">Loading {label}…</p>
    </div>
  )
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300">
      <p className="text-lg font-semibold text-white">Project not found</p>
      <p className="text-sm text-slate-400">
        No project with id <code className="text-slate-200">{id}</code>.
      </p>
      <a href="#/" className="text-sm font-semibold text-sky-400 hover:underline">
        ← Back to gallery
      </a>
    </div>
  )
}

/**
 * Opens a single project. React projects are wrapped in React.lazy so their
 * code is fetched on demand; iframe projects point at a self-contained static
 * page. Either way, the work only starts running once this view is shown.
 */
export function ProjectView({ id }: { id: string }) {
  const project = findProject(id)
  const LazyComponent = lazyComponents[id]

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none bg-slate-950">
      {/* Floating "back to gallery" control, above whatever the project renders */}
      <a
        href="#/"
        className="absolute left-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        ← Gallery
      </a>

      {/* External works: a fallback to open in a new tab in case the host
          blocks being embedded in an iframe. */}
      {project?.kind === 'external' && (
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          새 탭에서 열기 ↗
        </a>
      )}

      {!project ? (
        <NotFound id={id} />
      ) : project.kind === 'iframe' ? (
        <iframe
          key={project.id}
          src={`${import.meta.env.BASE_URL}${project.path}`}
          title={project.title}
          className="h-full w-full border-0"
          // Sandbox keeps embedded works isolated while still letting them run.
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        />
      ) : project.kind === 'external' ? (
        <iframe
          key={project.id}
          src={project.url}
          title={project.title}
          className="h-full w-full border-0"
          // Sandbox keeps embedded works isolated while still letting them run.
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups"
          allow="fullscreen; gamepad; accelerometer; gyroscope"
        />
      ) : (
        <Suspense fallback={<Loading label={project.title} />}>
          {LazyComponent && <LazyComponent />}
        </Suspense>
      )}
    </div>
  )
}
