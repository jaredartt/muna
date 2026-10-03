import { useSyncExternalStore } from 'react'

// Tiny hash router (#/calendar). Hash routes work on GitHub Pages with no server config.
export type Route = '/' | '/calendar' | '/chat' | '/profile' | '/updates' | '/products' | '/meals' | '/pantry' | '/uni' | '/hobbies' | '/weather' | '/gym'
const ROUTES: Route[] = ['/', '/calendar', '/chat', '/profile', '/updates', '/products', '/meals', '/pantry', '/uni', '/hobbies', '/weather', '/gym']

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

// Where each screen sits in the app, so moving between them can slide the right way (later = from the right, earlier = from the left).
const RANK: Record<Route, number> = { '/': 0, '/uni': 0.5, '/hobbies': 0.6, '/weather': 0.7, '/gym': 0.8, '/calendar': 1, '/meals': 2, '/pantry': 3, '/products': 3.5, '/chat': 4, '/profile': 5, '/updates': 5.5 }

/** Which way a screen change slides: 'fwd' (new screen comes from the right) or 'back' (from the left). */
export const slideDir = (from: Route, to: Route): 'fwd' | 'back' => (RANK[to] >= RANK[from] ? 'fwd' : 'back')

/** `to` may carry a flag, e.g. '/products?house' (add what you scan to the pantry too). The slide itself is drawn by <Screens> in App.tsx. */
export function navigate(to: Route | `${Route}?${string}`) {
  window.location.hash = to
}
