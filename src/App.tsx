import { useHashRoute } from './lib/useHashRoute'
import { Gallery } from './ui/Gallery'
import { ProjectView } from './ui/ProjectView'

/**
 * App shell / router. The home route shows the project gallery; opening a
 * project renders it in its own full-screen view, loading the work on demand.
 */
export default function App() {
  const route = useHashRoute()

  if (route.name === 'project') {
    return <ProjectView id={route.id} />
  }

  return <Gallery />
}
