import { useEffect, useState, useCallback } from 'react'

export type Route =
  | { name: 'dashboard' }
  | { name: 'applications' }
  | { name: 'application'; id: number }
  | { name: 'analyzer'; prefapp?: number }
  | { name: 'profile' }
  | { name: 'documents' }
  | { name: 'settings' }

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, query] = h.split('?')
  const q = new URLSearchParams(query ?? '')
  const seg = path.split('/')
  switch (seg[0]) {
    case 'applications':
      return seg[1] && /^\d+$/.test(seg[1]) ? { name: 'application', id: Number(seg[1]) } : { name: 'applications' }
    case 'analyzer':
      return { name: 'analyzer', prefapp: q.get('app') && /^\d+$/.test(q.get('app')!) ? Number(q.get('app')) : undefined }
    case 'profile':
      return { name: 'profile' }
    case 'documents':
      return { name: 'documents' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'dashboard' }
  }
}

export function useRoute(): [Route, (r: string) => void, Route | undefined] {
  const [route, setRoute] = useState<Route>(() => parseHash())
  useEffect(() => {
    const fn = () => setRoute(parseHash())
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  const navigate = useCallback((r: string) => {
    window.location.hash = r.startsWith('#') ? r : `#/${r.replace(/^\//, '')}`
  }, [])
  return [route, navigate, undefined]
}

export function navigate(r: string) {
  window.location.hash = r.startsWith('#') ? r : `#/${r.replace(/^\//, '')}`
}
