import { useMemo, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { AppIcon, allIconNames, iconSearchName, useTablerLib } from '../lib/icons'
import { useCustomIcons } from '../lib/customIcons'
import { phosphorAvailable, usePhosphor } from '../lib/phosphor'

type Props = {
  value: string
  onChange: (name: string) => void
  /** Icons shown before the person searches. */
  suggestions: string[]
  colorClass?: string
}

const MAX_RESULTS = 120

/** Icon grid with ONE search bar over everything: your own uploaded icons, Phosphor filled icons (incl. food) and all of Tabler's icons, ranked together. */
export default function IconPicker({ value, onChange, suggestions, colorClass = '' }: Props) {
  const [q, setQ] = useState('')
  const raw = q.trim().toLowerCase()
  const query = raw.replace(/\s+/g, '-')
  const lib = useTablerLib(query.length > 0)
  const ph = usePhosphor(phosphorAvailable)
  const mine = useCustomIcons()
  const all = useMemo(() => (lib ? allIconNames(lib) : []), [lib]) // filled and outline icons, mixed together

  // ONE list for every source (my uploads, Phosphor Fill, Tabler), ranked together:
  // exact name, then names that start with the word, then other name matches, then search words (tags).
  const results = useMemo(() => {
    if (!query) return []
    const buckets: string[][][] = [[], [], [], [], []] // [score][source]
    const add = (score: number, source: number, key: string) => {
      ;(buckets[score][source] ??= []).push(key)
    }
    const score = (name: string, tags: string): number => {
      if (name === query) return 0
      if (name.startsWith(query)) return 1
      if (name.includes('-' + query) || name.includes(query)) return 2
      if (tags && tags.includes(raw)) return 3
      return -1
    }
    for (const i of mine) {
      const sc = score(i.name.toLowerCase().replace(/\s+/g, '-'), i.tags.toLowerCase())
      if (sc >= 0) add(sc, 0, 'custom:' + i.id)
    }
    if (ph) {
      for (const [name, [tags]] of Object.entries(ph.icons)) {
        const sc = score(name, tags)
        if (sc >= 0) add(sc, 1, 'ph:' + name)
      }
    }
    for (const n of all) {
      const sc = score(iconSearchName(n), '')
      if (sc >= 0) add(sc, 2, n)
    }
    // inside each rank, take turns between the sources so all of them show up near the top
    const out: string[] = []
    for (const group of buckets) {
      const lists = group.filter(Boolean)
      for (let k = 0; lists.some((l) => k < l.length); k++) for (const l of lists) if (k < l.length) out.push(l[k])
      if (out.length >= MAX_RESULTS) break
    }
    return out.slice(0, MAX_RESULTS)
  }, [query, raw, all, ph, mine])

  const mineKeys = useMemo(() => mine.map((i) => 'custom:' + i.id), [mine])
  const shown = query ? results : [...suggestions, ...mineKeys]
  const current = value && !shown.includes(value) && !query ? [value] : []

  return (
    <div className="icon-picker">
      <div className="search-box">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search icons (try heart, car, pizza…)"
          aria-label="Search icons"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {q && (
          <button type="button" className="icon-btn" onClick={() => setQ('')} aria-label="Clear search">
            <IconX size={18} />
          </button>
        )}
      </div>
      <div className="icon-grid" role="listbox" aria-label="Icons">
        {[...current, ...shown].map((k) => (
          <button
            type="button"
            key={k}
            role="option"
            aria-selected={value === k}
            className={`icon-choice ${colorClass}` + (value === k ? ' selected' : '')}
            onClick={() => onChange(k)}
            aria-label={iconSearchName(k)}
            title={iconSearchName(k)}
          >
            <AppIcon name={k} size={22} />
          </button>
        ))}
      </div>
      {query && !lib && <p className="muted small">Loading all icons…</p>}
      {query && lib && results.length === 0 && <p className="muted small">No icon called “{q}”. Try another word.</p>}
      {!query && <p className="muted small">Type to search all icons, including food and your own.</p>}
    </div>
  )
}
