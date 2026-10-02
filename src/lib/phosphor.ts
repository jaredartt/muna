import { useEffect, useState } from 'react'
import type { SvgNode } from './svgIcons'

// Phosphor "Fill" icons (MIT licence, https://phosphoricons.com). They live in the repo as one JSON file
// (src/data/phosphor-fill.json, made by tools/import_phosphor.py), so they cost nothing in Supabase.
// The file is loaded only when an icon from it is needed. If the file is not there yet, the app simply works without it.
export type PhosphorData = { viewBox: string; icons: Record<string, [tags: string, nodes: SvgNode[]]> }

const loaders = import.meta.glob('../data/phosphor-fill.json')
let promise: Promise<PhosphorData | null> | null = null
let cache: PhosphorData | null = null

export function loadPhosphor(): Promise<PhosphorData | null> {
  if (!promise) {
    const load = Object.values(loaders)[0]
    promise = load
      ? load().then((m) => {
          const mod = m as { default?: PhosphorData } & PhosphorData
          cache = (mod.default ?? mod) as PhosphorData
          return cache
        })
      : Promise.resolve(null)
    promise = promise.catch(() => null)
  }
  return promise
}

export const phosphorAvailable = Object.keys(loaders).length > 0

export function usePhosphor(enabled: boolean): PhosphorData | null {
  const [data, setData] = useState<PhosphorData | null>(cache)
  useEffect(() => {
    if (!enabled || cache) {
      if (cache && !data) setData(cache)
      return
    }
    let alive = true
    void loadPhosphor().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [enabled, data])
  return data
}
