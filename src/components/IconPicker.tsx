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

/** Icon grid with one search bar over: your own uploaded icons, Phosphor filled icons (food, etc.) and all of Tabler's icons, mixed together. */
export default function IconPicker({ value, onChange, suggestions, colorClass = '' }: Props) {
  const [q, setQ] = useState('')
  const raw = q.trim().toLowerCase()
  const query = raw.replace(/\s+/g, '-')
  const lib = useTablerLib(query.length > 0)
  const ph = usePhosphor(phosphorAvailable)
  const mine = useCustomIcons()
  const all = useMemo(() => (lib ? allIconNames(lib) : []), [lib]) // filled and outline icons, mixed together

  const results = useMemo(() => {
    if (!query) return []
    // my own icons first (name or tags)
    const own = mine.filter((i) => i.name.toLowerCase().includes(raw) || i.tags.toLowerCase().includes(raw)).map((i) => 'custom:' + i.id)

    const rank = (names: string[]) => {
      const starts: string[] = []
      const contains: string[] = []
      for (const n of names) {
        const k = iconSearchName(n)
        if (k.startsWith(query)) starts.push(n)
        else if (k.includes(query)) contains.push(n)
      }
      return [...starts, ...contains]
    }
    const tabler = rank(all)

    let phosphor: string[] = []
    if (ph) {
      const starts: string[] = []
      const contains: string[] = []
      const byTag: string[] = []
      for (const [name, [tags]] of Object.entries(ph.icons)) {
        if (name.startsWith(query)) starts.push('ph:' + name)
        else if (name.includes(query)) contains.push('ph:' + name)
        else if (tags.includes(raw)) byTag.push('ph:' + name)
      }
      phosphor = [...starts, ...contains, ...byTag]
    }

    // mix the two libraries so both show up near the top
    const mixed: string[] = []
    for (let i = 0; i < Math.max(tabler.length, phosphor.length); i++) {
      if (i < phosphor.length) mixed.push(phosphor[i])
      if (i < tabler.length) mixed.push(tabler[i])
    }
    return [...own, ...mixed].slice(0, MAX_RESULTS)
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
