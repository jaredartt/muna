// Muna's service worker: it only shows push notifications (reminders) and opens the app when you tap one. It does not cache anything.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch (e) {
    d = { title: 'Muna', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Muna', {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: 'apple-touch-icon.png',
      badge: 'apple-touch-icon.png',
      data: { url: d.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if ('focus' in c) {
          await c.focus()
          if ('navigate' in c) {
            try {
              await c.navigate(url)
            } catch (e) {
              /* fine */
            }
          }
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
