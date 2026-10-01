import type { ThemePref } from './types'

const KEY = 'muna-theme'
let mediaCleanup: (() => void) | null = null

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function getStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function applyTheme(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
  const set = () => {
    document.documentElement.dataset.theme = resolve(pref)
  }
  set()
  mediaCleanup?.()
  mediaCleanup = null
  if (pref === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', set)
    mediaCleanup = () => mq.removeEventListener('change', set)
  }
}
