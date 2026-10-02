import { useSyncExternalStore } from 'react'

// Tiny hash router (#/calendar). Hash routes work on GitHub Pages with no server config.
export type Route = '/' | '/calendar' | '/chat' | '/profile' | '/updates' | '/products'
const ROUTES: Route[] = ['/', '/calendar', '/chat', '/profile', '/updates', '/products']

function current(): Route {
  const h = window.location.hash.replace(/^#/, '') || '/'
  return (ROUTES.includes(h as Route) ? h : '/') as Route
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => '/' as Route)
}

export function navigate(to: Route) {
  window.location.hash = to
}
