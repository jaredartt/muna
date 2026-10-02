import { useEffect, type RefObject } from 'react'

/**
 * Keeps the page behind an open sheet from scrolling (iPhone lets a swipe "leak" through when the sheet reaches its top or bottom).
 * It only steps in when nothing inside the sheet can scroll in the swipe direction. It does not touch the page's own overflow,
 * which on iPhone could leave the whole app stuck unable to scroll after the sheet closed.
 */
export function useSheetScrollGuard(backdrop: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = backdrop.current
    if (!el) return
    let startY = 0
    const start = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0
    }
    const move = (e: TouchEvent) => {
      const dy = (e.touches[0]?.clientY ?? 0) - startY // finger moving down (dy > 0) scrolls content towards its top
      let node = e.target as HTMLElement | null
      while (node && node !== el) {
        const scrollable = node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)
        if (scrollable) {
          const atTop = node.scrollTop <= 0
          const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1
          if ((dy > 0 && !atTop) || (dy < 0 && !atBottom)) return // something in the sheet can still scroll this way
        }
        node = node.parentElement
      }
      if (e.cancelable) e.preventDefault()
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
    }
  }, [backdrop])
}
