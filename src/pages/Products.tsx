import { useMemo, useState } from 'react'
import { IconBarcode, IconChevronLeft, IconSearch } from '@tabler/icons-react'
import { navigate } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import BarcodeScanner from '../components/BarcodeScanner'
import ProductSheet from '../components/ProductSheet'
import { emptyDraft, findByBarcode, lookupBarcode, useProducts, type Edc, type Product, type ProductDraft, type Tri } from '../lib/products'

type Open = { initial: ProductDraft; id?: string; note?: string }

const triLabel = (v: Tri, word: string) =>
  v === 'free' ? `${word}-free` : v === 'contains' ? `Contains ${word.toLowerCase()}` : v === 'traces' ? `May contain ${word.toLowerCase()}` : `${word}: not checked`
const edcLabel = (v: Edc) => (v === 'possible' ? 'Possible hormone disruptor' : v === 'none' ? 'No known disruptors' : 'Hormones: not checked')
const val = (v: number | null) => (v == null ? '–' : String(v))

function macroLine(p: Product) {
  return `${val(p.kcal_100)} kcal · P ${val(p.protein_100)} · C ${val(p.carbs_100)} · F ${val(p.fat_100)} per 100 ${p.unit}`
}

/** The home's product list. Add one by scanning its barcode (nutrition comes from Open Food Facts) or by typing the barcode. */
export default function Products() {
  const { profile } = useAuth()
  const products = useProducts()
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<Open | null>(null)
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? products.filter((p) => `${p.name} ${p.brand ?? ''} ${p.barcode ?? ''}`.toLowerCase().includes(t)) : products
  }, [products, q])

  if (!profile) return null

  async function add(raw: string) {
    const clean = raw.replace(/\D/g, '')
    setMsg('')
    if (clean.length < 6) return setMsg('A barcode has at least 6 digits.')
    const have = findByBarcode(clean)
    if (have) {
      setMsg('You already have this one. Here it is.')
      return setOpen({ initial: have, id: have.id })
    }
    setBusy(true)
    const r = await lookupBarcode(clean)
    setBusy(false)
    if (r.draft) {
      setCode('')
      setOpen({ initial: r.draft, note: r.error })
    } else setMsg(r.error ?? 'Something went wrong.')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="updates-title">
          <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Back to Profile">
            <IconChevronLeft size={24} />
          </button>
          <h1>Products</h1>
        </div>
      </header>

      <section className="card">
        <h3>Add a product</h3>
        <p className="muted small">Scan the barcode on the pack. Muna looks up the calories, protein, carbs and fat for you, and you check them before saving.</p>
        <button className="btn primary" onClick={() => setScanning(true)}>
          <IconBarcode size={20} /> Scan a barcode
        </button>
        <form
          className="prod-type"
          onSubmit={(e) => {
            e.preventDefault()
            void add(code)
          }}
        >
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type the barcode number" maxLength={20} aria-label="Barcode number" />
          <button className="btn soft" type="submit" disabled={busy || !code.trim()}>
            {busy ? 'Looking…' : 'Find'}
          </button>
        </form>
        <button className="prod-manual" onClick={() => setOpen({ initial: emptyDraft() })}>
          No barcode? Add it by hand
        </button>
        {msg && <p className="prod-note" role="status">{msg}</p>}
      </section>

      <section className="card">
        <div className="prod-search">
          <IconSearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${products.length} product${products.length === 1 ? '' : 's'}`} aria-label="Search products" />
        </div>
        {products.length === 0 && <p className="muted small">Nothing here yet. Scan your first product above.</p>}
        {products.length > 0 && shown.length === 0 && <p className="muted small">No product matches that.</p>}
        {shown.map((p) => (
          <button key={p.id} className="prod-row" onClick={() => setOpen({ initial: p, id: p.id })}>
            <span className="prod-thumb">{p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <IconBarcode size={22} />}</span>
            <span className="prod-body">
              <strong>{p.name}</strong>
              <span className="muted small">{[p.brand, p.pack_size].filter(Boolean).join(' · ') || 'No brand'}</span>
              <span className="prod-macros">{macroLine(p)}</span>
              <span className="prod-badges">
                <span className={'prod-badge ' + p.gluten}>{triLabel(p.gluten, 'Gluten')}</span>
                <span className={'prod-badge ' + p.lactose}>{triLabel(p.lactose, 'Lactose')}</span>
                <span className={'prod-badge edc-' + p.edc}>{edcLabel(p.edc)}</span>
              </span>
            </span>
          </button>
        ))}
      </section>

      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetect={(c) => {
            setScanning(false)
            void add(c)
          }}
        />
      )}
      {open && <ProductSheet householdId={profile.household_id} initial={open.initial} id={open.id} note={open.note} onClose={() => setOpen(null)} />}
    </div>
  )
}
