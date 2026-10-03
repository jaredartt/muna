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

/** `to` may carry a flag, e.g. '/products?house' (add what you scan to the pantry too). */
export function navigate(to: Route | `${Route}?${string}`) {
  const target = to.split('?')[0] as Route
  const from = current()
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }
  // Browsers that can do it slide/fade between screens (no effect on the others, and none when you asked your phone for less motion)
  if (!doc.startViewTransition || target === from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.hash = to
    return
  }
  document.documentElement.dataset.nav = RANK[target] >= RANK[from] ? 'fwd' : 'back'
  doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        let done = false
        const finish = () => {
          if (done) return
          done = true
          window.removeEventListener('hashchange', onHash)
          resolve()
        }
        const onHash = () => requestAnimationFrame(finish) // React has drawn the new screen by now
        window.addEventListener('hashchange', onHash)
        window.setTimeout(finish, 400)
        window.location.hash = to
      }),
  )
}
