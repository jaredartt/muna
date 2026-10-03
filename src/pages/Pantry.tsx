import { useEffect, useMemo, useRef, useState } from 'react'
import { IconBarcode, IconChevronDown, IconMinus, IconPlus, IconSearch, IconTrashFilled } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/Confirm'
import { navigate } from '../lib/router'
import ShoppingSuggestion from '../components/ShoppingSuggestion'
import { formatDateNice, todayStr } from '../lib/dates'
import { matchesProduct, setNickname, useProducts, type Product } from '../lib/products'
import { addToPantry, isLow, predictRunOut, remainingPacks, removeFromPantry, setBoughtAt, setPantry, usePantry, usePantryLog, type PantryLog, type PantryRow } from '../lib/meals'

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
  const [open, setOpen] = useState(false) // the details under the name (when it was bought)
  const { confirm } = useConfirm()
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setPct(row.pct_left), [row.pct_left, row.packs])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const out = row.packs <= 0
  const again = product.rebuy !== false // false = one-time purchase: Muna never lists it again
  const low = again && !out && isLow(row)
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
        <button type="button" className="prod-body pt-name" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${product.name}: ${open ? 'hide' : 'show'} details`}>
          <strong>
            {product.name} <IconChevronDown size={16} className={'pt-chev' + (open ? ' open' : '')} />
          </strong>
          <span className="muted small">{[product.nickname ? `“${product.nickname}”` : '', product.brand, product.pack_size, again ? '' : 'One-time purchase'].filter(Boolean).join(' · ') || 'No brand'}</span>
        </button>
        <button className="icon-btn" onClick={async () => {
            if (await confirm({ message: <>Remove <strong>{product.name}</strong> from the house?</>, confirmLabel: 'Remove' })) void removeFromPantry(row.product_id)
          }} aria-label={`Remove ${product.name} from the house`}>
          <IconTrashFilled size={18} />
        </button>
      </div>

      {open && (
        <div className="pt-details">
          <label className="pt-bought">
            <span>
              <strong>Nickname</strong>
              <span className="muted small"> Your own name for it, so searching for it in English works too.</span>
            </span>
            <input key={product.nickname ?? ''} defaultValue={product.nickname ?? ''} maxLength={80} placeholder={`e.g. what you call ${product.name}`} onBlur={(e) => e.target.value.trim() !== (product.nickname ?? '') && void setNickname(product.id, e.target.value)} aria-label={`Nickname for ${product.name}`} />
          </label>
          <label className="pt-bought">
            <span>
              <strong>Bought on</strong>
              <span className="muted small"> Muna uses this to work out how fast you use it.</span>
            </span>
            <input type="date" value={row.bought_at ?? ''} max={todayStr()} onChange={(e) => void setBoughtAt(row.product_id, e.target.value || null)} aria-label={`The day you bought ${product.name}`} />
          </label>
          {row.bought_at && (
            <button type="button" className="prod-manual" onClick={() => void setBoughtAt(row.product_id, null)}>
              I do not remember
            </button>
          )}
        </div>
      )}

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
        {out && again && <span className="ml-chip miss">Muna will list it</span>}
        {out && !again && <span className="ml-chip ok">Finished</span>}
        {low && <span className="ml-chip miss">Running low</span>}
        {!out && !low && <span className="ml-chip ok">Enough</span>}
      </div>

      {!out && (
        <label className="pt-slide">
          <span>
            Open pack: <strong>{pct}% left</strong>
          </span>
          <input type="range" min={0} max={100} step={5} value={pct} style={{ '--p': pct / 100 } as React.CSSProperties} onChange={(e) => slide(Number(e.target.value))} aria-label={`How much is left of the open ${product.name}`} />
        </label>
      )}

      <p className="muted small pt-guess">
        {out
          ? again
            ? 'None left. It goes on your next shopping list.'
            : 'None left. It was a one-time purchase, so Muna will not list it again. You can take it out of the house.'
          : guess
            ? `About ${guess.daysLeft < 1 ? 'less than a day' : Math.round(guess.daysLeft) + ' day' + (Math.round(guess.daysLeft) === 1 ? '' : 's')} left (runs out around ${formatDateNice(guess.date)}), ${guess.basis === 'bought' ? 'counted from the day you bought it' : 'from how fast you use it'}.`
            : 'Tap the name and say when you bought it, or move the slider when you use some. Muna learns when it runs out.'}
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
        if (filter === 'low' && !(product.rebuy !== false && (row.packs <= 0 || isLow(row)))) return false
        return matchesProduct(product, t)
      })
      .sort((a, b) => remainingPacks(a.row) - remainingPacks(b.row) || a.product.name.localeCompare(b.product.name))
  }, [pantry, pmap, filter, q])
  const lowCount = pantry.filter((r) => pmap.get(r.product_id)?.rebuy !== false && pmap.has(r.product_id) && (r.packs <= 0 || isLow(r))).length

  const found = useMemo(() => {
    const t = adding.trim().toLowerCase()
    if (!t) return []
    const have = new Set(pantry.filter((r) => r.packs > 0).map((r) => r.product_id))
    return products.filter((p) => !have.has(p.id) && matchesProduct(p, t)).slice(0, 8)
  }, [adding, products, pantry])

  if (!profile) return null
  const hid = profile.household_id

  return (
    <div className="page">
      <header className="page-head">
        <h1>Pantry</h1>
      </header>

      <ShoppingSuggestion />

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
              <span className="muted small">{[p.nickname ? `“${p.nickname}”` : '', p.brand, p.pack_size].filter(Boolean).join(' · ') || 'Tap to add one pack'}</span>
            </span>
            <IconPlus size={18} />
          </button>
        ))}
        <button className="prod-manual" onClick={() => navigate('/products?house')}>
          Not in the list? Scan it or add a new product
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
