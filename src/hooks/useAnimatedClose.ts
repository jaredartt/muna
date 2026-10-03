import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lets a sheet slide away before it is removed: `close()` turns on `leaving` (the sheet slides down, the dim fades out) and calls `onClose` once that is done.
 * Opening is animated by the `sheet-anim` class on the backdrop.
 */
export function useAnimatedClose(onClose: () => void) {
  const [leaving, setLeaving] = useState(false)
  const latest = useRef(onClose)
  latest.current = onClose
  const timer = useRef(0)
  const close = useCallback(() => {
    if (timer.current) return // already on its way out
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return latest.current()
    setLeaving(true)
    timer.current = window.setTimeout(() => latest.current(), 220)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { leaving, close }
}
