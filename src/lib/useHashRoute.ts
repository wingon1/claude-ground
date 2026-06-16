import { useEffect, useState } from 'react'

/**
 * Minimal hash-based router. Hash routing needs no server config, so it works
 * directly on GitHub Pages (deep links like #/p/cozy-cove survive refreshes).
 *
 *   '#/'              → { name: 'home' }
 *   '#/p/<id>'        → { name: 'project', id: '<id>' }
 */
export type Route =
  | { name: 'home' }
  | { name: 'project'; id: string }

function parse(hash: string): Route {
  const clean = hash.replace(/^#/, '')
  const match = clean.match(/^\/p\/([^/]+)/)
  if (match) return { name: 'project', id: decodeURIComponent(match[1]) }
  return { name: 'home' }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      // Always start a freshly opened project scrolled to the top.
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

export function navigate(to: string) {
  window.location.hash = to
}
