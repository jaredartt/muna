import { useMemo, useRef, useState } from 'react'
import { IconCheck, IconSearch, IconX } from '@tabler/icons-react'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { learnBarcode, matchesProduct, unbarcoded, useProducts, type LookupResult, type Product } from '../lib/products'

type Props = {
  code: string
  /** What the online databases said (null while it is still loading). */
  lookup: LookupResult | null
  /** The barcode was saved on one of your products. */
  onLearned: (p: Product) => void
  /** "No, it is a new product": go on to the form. */
  onNew: () => void
  onClose: () => void
}

const FIRST = 8

/**
 * Shown when a scan finds nothing in your list: "Is this one of your products?" Pick yours and the barcode is saved on it for
 * good (shared with everyone in the home), so the next scan finds it. Only products without a barcode are offered.
 */
export default function ProductPicker({ code, lookup, onLearned, onNew, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const products = useProducts() // re-renders when the list changes (the barcode just taught disappears from it)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const [picked, setPicked] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const foundName = lookup?.draft?.name?.trim() ?? ''
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const rows = unbarcoded(foundName).filter(({ product: p }) => !t || matchesProduct(p, t))
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, foundName, products])
  const shown = q.trim() || all ? list : list.slice(0, FIRST)

  async function save() {
    if (!picked) return
    setBusy(true)
    setError('')
    const err = await learnBarcode(picked.id, code)
    setBusy(false)
    if (err) return setError(err)
    onLearned(picked)
  }

  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Is this one of your products?">
        <div className="sheet-head">
          <h2>Is this one of your products?</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        <p className="muted small">
          Barcode <strong>{code}</strong> is not in your list yet.{' '}
          {lookup === null ? 'Checking the online databases…' : foundName ? `Online it is called "${foundName}".` : 'The online databases do not know it.'} Pick your product and Muna remembers this barcode for good, for you and Lidia.
        </p>

        <div className="prod-search">
          <IconSearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list.length} product${list.length === 1 ? '' : 's'} without a barcode`} aria-label="Search your products" />
        </div>
        <div>
          {shown.length === 0 && <p className="muted small">{q.trim() ? 'No product matches that.' : 'All your products already have a barcode.'}</p>}
          {shown.map(({ product: p, likely }) => (
            <button key={p.id} className={'ml-row' + (picked?.id === p.id ? ' on' : '')} onClick={() => setPicked(p)} aria-pressed={picked?.id === p.id}>
              <span className="ml-row-main">
                <strong>{p.name}</strong>
                <span className="muted small">{[likely ? 'Looks like a match' : '', p.brand, p.pack_size].filter(Boolean).join(' · ') || 'No brand'}</span>
              </span>
              {picked?.id === p.id && <IconCheck size={20} />}
            </button>
          ))}
          {!q.trim() && !all && list.length > FIRST && (
            <button className="prod-manual" onClick={() => setAll(true)}>
              Show all {list.length}
            </button>
          )}
        </div>

        {error && <p className="prod-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button className="btn primary grow" onClick={() => void save()} disabled={!picked || busy}>
            {busy ? 'Saving…' : picked ? `Yes, save it on ${picked.name.length > 28 ? picked.name.slice(0, 27) + '…' : picked.name}` : 'Pick your product above'}
          </button>
        </div>
        <button className="btn ghost" onClick={onNew} disabled={lookup === null || busy}>
          {lookup === null ? 'Checking online…' : 'No, it is a new product'}
        </button>
      </div>
    </div>
  )
}
