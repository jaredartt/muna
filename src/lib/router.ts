import { useSyncExternalStore } from 'react'

// Tiny hash router (#/calendar). Hash routes work on GitHub Pages with no server config.
export type Route = '/' | '/calendar' | '/chat' | '/profile' | '/updates' | '/products' | '/meals' | '/pantry' | '/uni' | '/hobbies'
const ROUTES: Route[] = ['/', '/calendar', '/chat', '/profile', '/updates', '/products', '/meals', '/pantry', '/uni', '/hobbies']

function current(): Route {
  const h = window.location.hash.replace(/^#/, '').split('?')[0] || '/'
  return (ROUTES.includes(h as Route) ? h : '/') as Route
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => '/' as Route)
}

/** `to` may carry a flag, e.g. '/products?house' (add what you scan to the pantry too). */
export function navigate(to: Route | `${Route}?${string}`) {
  window.location.hash = to
}
