import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Press and hold an item (touch: about a third of a second; mouse: just press and drag) and drag it to a new place, in one list or between columns.
 * Give each list/column a ref (`column(i)`), every item `item(id)` (a data-rid, the press handler, and `data-drop` = where it will land),
 * and read the new order in `onChange`. The item follows the pointer; the page scrolls by itself near the top and bottom of the screen.
 */
export function useReorder(opts: { columns: string[][]; onChange: (next: string[][]) => void; enabled?: boolean }) {
  const cols = useRef<(HTMLElement | null)[]>([])
  const live = useRef(opts)
  live.current = opts
  const [marker, setMarker] = useState<{ col: number; index: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const act = useRef<{
    id: string
    el: HTMLElement
    pid: number
    touch: boolean
    x0: number
    y0: number
    x: number
    y: number
    sy0: number
    began: boolean
    timer: number
    raf: number
    mk: { col: number; index: number } | null
  } | null>(null)

  // the window listeners must be the very same functions when they are added and removed
  const fns = useRef({ move: (_e: PointerEvent) => {}, up: (_e: PointerEvent) => {}, cancel: (_e: PointerEvent) => {} })
  const stable = useRef({ move: (e: PointerEvent) => fns.current.move(e), up: (e: PointerEvent) => fns.current.up(e), cancel: (e: PointerEvent) => fns.current.cancel(e) }).current

  const itemsOf = (c: number) => Array.from(cols.current[c]?.querySelectorAll<HTMLElement>(':scope > [data-rid]') ?? [])

  const place = useCallback((a: NonNullable<typeof act.current>) => {
    const dy = a.y - a.y0 + (window.scrollY - a.sy0)
    a.el.style.transform = `translate(${a.x - a.x0}px, ${dy}px)`
    // which column is the pointer over, and between which items
    let col = 0
    let bestD = Infinity
    cols.current.forEach((c, i) => {
      if (!c) return
      const r = c.getBoundingClientRect()
      const d = a.x < r.left ? r.left - a.x : a.x > r.right ? a.x - r.right : 0
      if (d < bestD) {
        bestD = d
        col = i
      }
    })
    const others = itemsOf(col).filter((e) => e !== a.el)
    const index = others.filter((e) => {
      const r = e.getBoundingClientRect()
      return r.top + r.height / 2 < a.y
    }).length
    if (!a.mk || a.mk.col !== col || a.mk.index !== index) {
      a.mk = { col, index }
      setMarker({ col, index })
    }
  }, [])

  const stop = useCallback(() => {
    const a = act.current
    if (!a) return
    window.clearTimeout(a.timer)
    cancelAnimationFrame(a.raf)
    a.el.style.transform = ''
    a.el.classList.remove('reorder-lifted')
    act.current = null
    setMarker(null)
    setDragId(null)
    window.removeEventListener('pointermove', stable.move)
    window.removeEventListener('pointerup', stable.up)
    window.removeEventListener('pointercancel', stable.cancel)
  }, [stable])

  const begin = useCallback(
    (a: NonNullable<typeof act.current>) => {
      a.began = true
      a.sy0 = window.scrollY
      a.el.classList.add('reorder-lifted')
      setDragId(a.id)
      navigator.vibrate?.(8)
      place(a)
      const tick = () => {
        if (act.current !== a) return
        let dy = 0
        if (a.y > window.innerHeight - 110) dy = Math.min(16, (a.y - (window.innerHeight - 110)) / 5 + 3)
        else if (a.y < 110) dy = -Math.min(16, (110 - a.y) / 5 + 3)
        if (dy) {
          window.scrollBy(0, dy)
          place(a)
        }
        a.raf = requestAnimationFrame(tick)
      }
      a.raf = requestAnimationFrame(tick)
    },
    [place],
  )

  function onMove(e: PointerEvent) {
    const a = act.current
    if (!a || e.pointerId !== a.pid) return
    a.x = e.clientX
    a.y = e.clientY
    if (a.began) return place(a)
    const dist = Math.hypot(a.x - a.x0, a.y - a.y0)
    if (a.touch && dist > 10) stop() // the finger is scrolling
    else if (!a.touch && dist > 5) begin(a)
  }
  function onUp(e: PointerEvent) {
    const a = act.current
    if (!a || e.pointerId !== a.pid) return
    if (a.began && a.mk) {
      const { columns, onChange } = live.current
      const next = columns.map((c) => c.filter((x) => x !== a.id))
      const target = next[a.mk.col]
      if (target) {
        target.splice(Math.min(a.mk.index, target.length), 0, a.id)
        if (next.some((c, i) => c.join('|') !== columns[i].join('|'))) onChange(next)
      }
      // the click that follows letting go must not open or tick whatever is under the finger
      const swallow = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 400)
    }
    stop()
  }
  function onCancel(e: PointerEvent) {
    const a = act.current
    if (a && e.pointerId === a.pid) stop()
  }

  fns.current = { move: onMove, up: onUp, cancel: onCancel }

  // while an item is held the page must not scroll under the finger (iPhone needs a non-passive listener)
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (act.current?.began) e.preventDefault()
    }
    window.addEventListener('touchmove', block, { passive: false })
    return () => window.removeEventListener('touchmove', block)
  }, [])
  useEffect(() => stop, [stop])

  const item = (id: string) => {
    const col = marker ? opts.columns[marker.col] : null
    let drop: 'before' | 'after' | undefined
    if (marker && col && dragId !== id) {
      const others = col.filter((x) => x !== dragId)
      if (others[marker.index] === id) drop = 'before'
      else if (marker.index >= others.length && others[others.length - 1] === id) drop = 'after'
    }
    return {
      'data-rid': id,
      'data-drop': drop,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (opts.enabled === false || act.current) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        if ((e.target as HTMLElement).closest('input, textarea, select, [data-nodrag]')) return
        const touch = e.pointerType !== 'mouse'
        const a = { id, el: e.currentTarget as HTMLElement, pid: e.pointerId, touch, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, sy0: window.scrollY, began: false, timer: 0, raf: 0, mk: null as { col: number; index: number } | null }
        act.current = a
        if (touch) a.timer = window.setTimeout(() => act.current === a && begin(a), 380)
        window.addEventListener('pointermove', stable.move)
        window.addEventListener('pointerup', stable.up)
        window.addEventListener('pointercancel', stable.cancel)
      },
    }
  }
  const column = (i: number) => (el: HTMLElement | null) => {
    cols.current[i] = el
  }
  return { item, column, dragging: dragId }
}
