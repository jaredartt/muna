import { useEffect, useMemo, useRef, useState } from 'react'
import { IconBarcode, IconMinus, IconPlus, IconSearch, IconTrashFilled } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../lib/router'
import { formatDateNice } from '../lib/dates'
import { useProducts, type Product } from '../lib/products'
import { addToPantry, isLow, predictRunOut, remainingPacks, removeFromPantry, setPantry, usePantry, usePantryLog, type PantryLog, type PantryRow } from '../lib/meals'

type Filter = 'all' | 'food' | 'other' | 'low'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'food', label: 'Food' },
  { key: 'other', label: 'Hygiene & home' },
  { key: 'low', label: 'Running low' },
]
const isFood = (p: Product) => p.kcal_100 != null

/** One thing at home: how many packs, how full the open pack is, and when it will probably run out. */
function Item({ householdId, row, product, log }: { householdId: string; row: PantryRow; product: Product; log: PantryLog[] }) {
  const [pct, setPct] = useState(row.pct_left)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setPct(row.pct_left), [row.pct_left, row.packs])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const out = row.packs <= 0
  const low = !out && isLow(row)
  const guess = out ? null : predictRunOut(row, log)

  // the slider is saved a moment after you stop moving it, so one use is remembered once
  function slide(v: number) {
    setPct(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void setPantry(householdId, row.product_id, { pct: v }), 700)
  }

  return (
    <div className={'pt-item' + (out ? ' out' : '')}>
      <div className="pt-top">
        <span className="prod-thumb">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <IconBarcode size={22} />}</span>
        <span className="prod-body">
          <strong>{product.name}</strong>
          <span className="muted small">{[product.brand, product.pack_size].filter(Boolean).join(' · ') || 'No brand'}</span>
        </span>
        <button className="icon-btn" onClick={() => void removeFromPantry(row.product_id)} aria-label={`Remove ${product.name} from the house`}>
          <IconTrashFilled size={18} />
        </button>
      </div>

      <div className="pt-row">
        <div className="pt-stepper" role="group" aria-label="Packs at home">
          <button className="icon-btn" onClick={() => void setPantry(householdId, row.product_id, { packs: row.packs - 1 })} disabled={out} aria-label="One pack less">
            <IconMinus size={18} />
          </button>
          <span className="pt-packs">{out ? 'Out' : `${row.packs} pack${row.packs === 1 ? '' : 's'}`}</span>
          <button className="icon-btn" onClick={() => void setPantry(householdId, row.product_id, { packs: row.packs + 1, pct: out ? 100 : row.pct_left })} aria-label="One pack more">
            <IconPlus size={18} />
          </button>
        </div>
        {out && <span className="ml-chip miss">Muna will list it</span>}
        {low && <span className="ml-chip miss">Running low</span>}
        {!out && !low && <span className="ml-chip ok">Enough</span>}
      </div>

      {!out && (
        <label className="pt-slide">
          <span>
            Open pack: <strong>{pct}% left</strong>
          </span>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => slide(Number(e.target.value))} aria-label={`How much is left of the open ${product.name}`} />
          <span className="pt-quick">
            <button type="button" className="ml-toggle" onClick={() => slide(Math.max(0, pct - 25))}>
              Used 25%
            </button>
            <button type="button" className="ml-toggle" onClick={() => slide(0)}>
              Finished this pack
            </button>
          </span>
        </label>
      )}

      <p className="muted small pt-guess">
        {out
          ? 'None left. It goes on your next shopping list.'
          : guess
            ? `About ${guess.daysLeft < 1 ? 'less than a day' : Math.round(guess.daysLeft) + ' day' + (Math.round(guess.daysLeft) === 1 ? '' : 's')} left (runs out around ${formatDateNice(guess.date)}), from how fast you use it.`
            : 'Move the slider when you use some. After a few times Muna learns when it runs out.'}
      </p>
    </div>
  )
}

/** The pantry: everything at home (food, hygiene, cleaning), how much is left, and what is running low. */
export default function Pantry() {
  const { profile } = useAuth()
  const products = useProducts()
  const pantry = usePantry()
  const log = usePantryLog()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState('')

  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const items = useMemo(() => {
    const t = q.trim().toLowerCase()
    return pantry
      .map((row) => ({ row, product: pmap.get(row.product_id) }))
      .filter((x): x is { row: PantryRow; product: Product } => Boolean(x.product))
      .filter(({ row, product }) => {
        if (filter === 'food' && !isFood(product)) return false
        if (filter === 'other' && isFood(product)) return false
        if (filter === 'low' && !(row.packs <= 0 || isLow(row))) return false
        return !t || `${product.name} ${product.brand ?? ''}`.toLowerCase().includes(t)
      })
      .sort((a, b) => remainingPacks(a.row) - remainingPacks(b.row) || a.product.name.localeCompare(b.product.name))
  }, [pantry, pmap, filter, q])
  const lowCount = pantry.filter((r) => pmap.has(r.product_id) && (r.packs <= 0 || isLow(r))).length

  const found = useMemo(() => {
    const t = adding.trim().toLowerCase()
    if (!t) return []
    const have = new Set(pantry.filter((r) => r.packs > 0).map((r) => r.product_id))
    return products.filter((p) => !have.has(p.id) && `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(t)).slice(0, 8)
  }, [adding, products, pantry])

  if (!profile) return null
  const hid = profile.household_id

  return (
    <div className="page">
      <header className="page-head">
        <h1>Pantry</h1>
      </header>

      <section className="card">
        <h3>Put something in the house</h3>
        <div className="prod-search">
          <IconSearch size={18} />
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Search your products" aria-label="Search your products to add" />
        </div>
        {adding.trim() && found.length === 0 && <p className="muted small">No product matches that, or it is already at home.</p>}
        {found.map((p) => (
          <button
            key={p.id}
            className="ml-row"
            onClick={() => {
              void addToPantry(hid, p.id)
              setAdding('')
            }}
          >
            <span className="ml-row-main">
              <strong>{p.name}</strong>
              <span className="muted small">{[p.brand, p.pack_size].filter(Boolean).join(' · ') || 'Tap to add one pack'}</span>
            </span>
            <IconPlus size={18} />
          </button>
        ))}
        <button className="prod-manual" onClick={() => navigate('/products')}>
          Not in the list? Scan it in Products
        </button>
      </section>

      <section className="card">
        <div className="pt-summary">
          <strong>{pantry.length} thing{pantry.length === 1 ? '' : 's'} tracked</strong>
          <span className={'ml-chip ' + (lowCount ? 'miss' : 'ok')}>{lowCount ? `${lowCount} running low` : 'Nothing running low'}</span>
        </div>
        <div className="ml-slotline">
          {FILTERS.map((f) => (
            <button key={f.key} className={'ml-toggle' + (filter === f.key ? ' on' : '')} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
              {f.label}
            </button>
          ))}
        </div>
        {pantry.length > 4 && (
          <div className="prod-search">
            <IconSearch size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the house" aria-label="Search the house" />
          </div>
        )}
        {pantry.length === 0 && <p className="muted small">Nothing here yet. Add what you have at home above, food, hygiene or cleaning. When something gets low, Muna puts it on your shopping list.</p>}
        {pantry.length > 0 && items.length === 0 && <p className="muted small">Nothing to show for this filter.</p>}
        {items.map(({ row, product }) => (
          <Item key={row.id} householdId={hid} row={row} product={product} log={log} />
        ))}
      </section>
    </div>
  )
}
