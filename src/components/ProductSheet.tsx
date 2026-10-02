import { useRef, useState } from 'react'
import { IconBarcode, IconTrashFilled, IconX } from '@tabler/icons-react'
import BarcodeScanner from './BarcodeScanner'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { deleteProduct, saveProduct, type Edc, type ProductDraft, type Tri } from '../lib/products'

type Props = {
  householdId: string
  initial: ProductDraft
  id?: string
  note?: string
  onClose: () => void
}

const NUMS: { key: keyof ProductDraft; label: string; max: number }[] = [
  { key: 'kcal_100', label: 'Calories (kcal)', max: 1000 },
  { key: 'protein_100', label: 'Protein (g)', max: 100 },
  { key: 'carbs_100', label: 'Carbs (g)', max: 100 },
  { key: 'fat_100', label: 'Fat (g)', max: 100 },
  { key: 'sugar_100', label: 'of which sugar (g)', max: 100 },
  { key: 'sat_fat_100', label: 'of which saturated fat (g)', max: 100 },
  { key: 'fibre_100', label: 'Fibre (g)', max: 100 },
  { key: 'salt_100', label: 'Salt (g)', max: 100 },
]
const TRI: { value: Tri; label: string }[] = [
  { value: 'unknown', label: 'Not sure' },
  { value: 'free', label: 'Free' },
  { value: 'traces', label: 'May contain traces' },
  { value: 'contains', label: 'Contains' },
]
const EDC: { value: Edc; label: string }[] = [
  { value: 'unknown', label: 'Not checked' },
  { value: 'none', label: 'No known suspects' },
  { value: 'possible', label: 'Possible hormone disruptor' },
]

const toStr = (v: unknown) => (v == null ? '' : String(v))
const toNum = (s: string): number | null | 'bad' => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : 'bad'
}

/** Check and fix the details of one product, then save it to the home's list. */
export default function ProductSheet({ householdId, initial, id, note, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const [name, setName] = useState(initial.name)
  const [brand, setBrand] = useState(initial.brand ?? '')
  const [barcode, setBarcode] = useState(initial.barcode ?? '')
  const [pack, setPack] = useState(initial.pack_size ?? '')
  const [unit, setUnit] = useState<'g' | 'ml'>(initial.unit)
  const [nums, setNums] = useState<Record<string, string>>(() => Object.fromEntries(NUMS.map((n) => [n.key, toStr(initial[n.key])])))
  const [gluten, setGluten] = useState<Tri>(initial.gluten)
  const [lactose, setLactose] = useState<Tri>(initial.lactose)
  const [edc, setEdc] = useState<Edc>(initial.edc)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  async function save() {
    setError('')
    if (!name.trim()) return setError('Give the product a name.')
    const parsed: Record<string, number | null> = {}
    for (const n of NUMS) {
      const v = toNum(nums[n.key] ?? '')
      if (v === 'bad' || (v != null && v > n.max)) return setError(`Check the number for "${n.label}".`)
      parsed[n.key] = v
    }
    const code = barcode.replace(/\D/g, '')
    if (barcode.trim() && (code.length < 6 || code.length > 20)) return setError('A barcode has 6 to 20 digits.')
    const draft: ProductDraft = {
      image_url: initial.image_url,
      source: initial.source,
      barcode: code || null,
      name: name.trim(),
      brand: brand.trim() || null,
      pack_size: pack.trim() || null,
      unit,
      kcal_100: parsed.kcal_100,
      protein_100: parsed.protein_100,
      carbs_100: parsed.carbs_100,
      fat_100: parsed.fat_100,
      sugar_100: parsed.sugar_100,
      sat_fat_100: parsed.sat_fat_100,
      fibre_100: parsed.fibre_100,
      salt_100: parsed.salt_100,
      gluten,
      lactose,
      edc,
      edc_note: initial.edc_note,
      notes: notes.trim() || null,
    }
    setBusy(true)
    const err = await saveProduct(householdId, draft, id)
    setBusy(false)
    if (err) return setError(err)
    onClose()
  }

  async function remove() {
    if (!id) return
    setBusy(true)
    const ok = await deleteProduct(id)
    setBusy(false)
    if (!ok) return setError('Could not delete it. Try again.')
    onClose()
  }

  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={id ? 'Edit product' : 'New product'}>
        <div className="sheet-head">
          <h2>{id ? 'Edit product' : 'New product'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        {note && <p className="prod-note">{note}</p>}
        {initial.source !== 'manual' && !id && (
          <p className="muted small">Found on {({ openfoodfacts: 'Open Food Facts', openbeautyfacts: 'Open Beauty Facts', openproductsfacts: 'Open Products Facts', openpetfoodfacts: 'Open Pet Food Facts', upcitemdb: 'UPCitemdb' } as Record<string, string>)[initial.source] ?? 'a barcode database'}. Please check the numbers against the pack before you save.</p>
        )}

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Skyr natur" maxLength={160} />
        </label>
        <div className="prod-grid">
          <label className="field">
            <span>Brand</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={120} />
          </label>
          <label className="field">
            <span>Pack size</span>
            <input value={pack} onChange={(e) => setPack(e.target.value)} placeholder="500 g" maxLength={60} />
          </label>
          <label className="field">
            <span>Barcode</span>
            <div className="prod-type">
              <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} maxLength={20} />
              <button type="button" className="btn soft" onClick={() => setScanning(true)} aria-label="Scan the barcode with the camera">
                <IconBarcode size={20} />
              </button>
            </div>
          </label>
          <label className="field">
            <span>Numbers are per 100</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'ml')}>
              <option value="g">grams (g)</option>
              <option value="ml">millilitres (ml)</option>
            </select>
          </label>
        </div>

        <h3 className="prod-h">Nutrition per 100 {unit}</h3>
        <div className="prod-grid">
          {NUMS.map((n) => (
            <label key={n.key} className="field">
              <span>{n.label}</span>
              <input inputMode="decimal" value={nums[n.key] ?? ''} onChange={(e) => setNums({ ...nums, [n.key]: e.target.value })} />
            </label>
          ))}
        </div>

        <div className="prod-grid">
          <label className="field">
            <span>Gluten</span>
            <select value={gluten} onChange={(e) => setGluten(e.target.value as Tri)}>
              {TRI.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Lactose</span>
            <select value={lactose} onChange={(e) => setLactose(e.target.value as Tri)}>
              {TRI.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Hormone disruptors (for the thyroid)</span>
          <select value={edc} onChange={(e) => setEdc(e.target.value as Edc)}>
            {EDC.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        {initial.edc_note && <p className="muted small">{initial.edc_note}</p>}
        <label className="field">
          <span>Notes (optional)</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="e.g. the blue pack, not the red one" />
        </label>

        {error && <p className="prod-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          {id && (
            <button className="btn danger" onClick={() => void remove()} disabled={busy} aria-label="Delete product">
              <IconTrashFilled size={18} />
            </button>
          )}
          <button className="btn primary grow" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </div>
      {scanning && (
        <div onClick={(e) => e.stopPropagation()}>
          <BarcodeScanner
            onClose={() => setScanning(false)}
            onDetect={(c) => {
              setScanning(false)
              setBarcode(c)
            }}
          />
        </div>
      )}
    </div>
  )
}
