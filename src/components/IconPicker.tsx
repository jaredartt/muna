import { useMemo, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { AppIcon, filledIconNames, iconSearchName, useTablerLib } from '../lib/icons'

type Props = {
  value: string
  onChange: (name: string) => void
  /** Icons shown before the person searches. */
  suggestions: string[]
  colorClass?: string
}

const MAX_RESULTS = 72

/** Icon grid with a search bar over all of Tabler's filled icons (https://tabler.io/icons). */
export default function IconPicker({ value, onChange, suggestions, colorClass = '' }: Props) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase().replace(/\s+/g, '-')
  const lib = useTablerLib(query.length > 0)
  const all = useMemo(() => (lib ? filledIconNames(lib) : []), [lib])

  const results = useMemo(() => {
    if (!query || !all.length) return []
    const starts: string[] = []
    const contains: string[] = []
    for (const n of all) {
      const k = iconSearchName(n)
      if (k.startsWith(query)) starts.push(n)
      else if (k.includes(query)) contains.push(n)
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS)
  }, [query, all])

  const shown = query ? results : suggestions
  const current = value && !suggestions.includes(value) && !query ? [value] : []

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
      {query && lib && results.length === 0 && <p className="muted small">No filled icon called “{q}”. Try another word.</p>}
      {!query && <p className="muted small">Type to search all {lib ? all.length : 'of Tabler’s'} filled icons.</p>}
    </div>
  )
}
