import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// The home's product list (table "products"). Kept in memory, cached on the phone, live through realtime.
// A product is filled by scanning its barcode: the nutrition comes from Open Food Facts (a free, open database) and can be corrected by hand.
export type Tri = 'free' | 'contains' | 'unknown'
export type Product = {
  id: string
  household_id: string
  barcode: string | null
  name: string
  brand: string | null
  pack_size: string | null
  unit: 'g' | 'ml'
  kcal_100: number | null
  protein_100: number | null
  carbs_100: number | null
  sugar_100: number | null
  fat_100: number | null
  sat_fat_100: number | null
  fibre_100: number | null
  salt_100: number | null
  gluten: Tri
  lactose: Tri
  image_url: string | null
  source: 'openfoodfacts' | 'manual'
  notes: string | null
  created_at: string
}
export type ProductDraft = Omit<Product, 'id' | 'household_id' | 'created_at'>

const COLS =
  'id, household_id, barcode, name, brand, pack_size, unit, kcal_100, protein_100, carbs_100, sugar_100, fat_100, sat_fat_100, fibre_100, salt_100, gluten, lactose, image_url, source, notes, created_at'
const CACHE_KEY = 'muna.products.v1'

let items: Product[] = []
let ready = false
const subs = new Set<() => void>()
const emit = () => {
  items = [...items]
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
const byName = (a: Product, b: Product) => a.name.localeCompare(b.name)

try {
  const raw = localStorage.getItem(CACHE_KEY)
  if (raw) {
    items = JSON.parse(raw) as Product[]
    ready = true
  }
} catch {
  /* no cache, fine */
}
function writeCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items))
  } catch {
    /* fine */
  }
}
function upsertLocal(p: Product) {
  items = [...items.filter((i) => i.id !== p.id), p].sort(byName)
  writeCache()
  emit()
}

export function useProducts(): Product[] {
  return useSyncExternalStore(subscribe, () => items)
}
export const productsReady = () => ready

/** Starts loading + live updates for this home. Returns a stop function. */
export function startProductSync(householdId: string): () => void {
  let alive = true
  void (async () => {
    const { data } = await supabase.from('products').select(COLS).eq('household_id', householdId).order('name', { ascending: true })
    if (!alive || !data) return
    items = (data as Product[]).sort(byName)
    ready = true
    writeCache()
    emit()
  })()
  const channel = supabase
    .channel('products-' + householdId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `household_id=eq.${householdId}` }, (p) => {
      if (p.eventType === 'DELETE') {
        const id = (p.old as { id?: string }).id
        if (!id) return
        items = items.filter((i) => i.id !== id)
        writeCache()
        emit()
      } else {
        upsertLocal(p.new as Product)
      }
    })
    .subscribe()
  return () => {
    alive = false
    void supabase.removeChannel(channel)
  }
}

export function findByBarcode(code: string): Product | undefined {
  return items.find((i) => i.barcode === code)
}

export async function saveProduct(householdId: string, draft: ProductDraft, id?: string): Promise<string | null> {
  const row = { ...draft, name: draft.name.trim().slice(0, 160), updated_at: new Date().toISOString() }
  const q = id
    ? supabase.from('products').update(row).eq('id', id).select(COLS).single()
    : supabase.from('products').insert({ ...row, household_id: householdId }).select(COLS).single()
  const { data, error } = await q
  if (error || !data) {
    if (error?.code === '23505') return 'This barcode is already in your list.'
    return 'Could not save the product. Check your internet and try again.'
  }
  upsertLocal(data as Product)
  return null
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return false
  items = items.filter((i) => i.id !== id)
  writeCache()
  emit()
  return true
}

export const emptyDraft = (barcode: string | null = null): ProductDraft => ({
  barcode,
  name: '',
  brand: null,
  pack_size: null,
  unit: 'g',
  kcal_100: null,
  protein_100: null,
  carbs_100: null,
  sugar_100: null,
  fat_100: null,
  sat_fat_100: null,
  fibre_100: null,
  salt_100: null,
  gluten: 'unknown',
  lactose: 'unknown',
  image_url: null,
  source: 'manual',
  notes: null,
})

type OffNutriments = Record<string, unknown>
const num = (nu: OffNutriments, key: string): number | null => {
  const v = nu[key]
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
}

/** Looks a barcode up on Open Food Facts. Nothing is saved: the person checks the numbers first. */
export async function lookupBarcode(code: string): Promise<{ draft?: ProductDraft; error?: string }> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 6) return { error: 'A barcode has at least 6 digits.' }
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=code,product_name,product_name_de,brands,quantity,nutriments,allergens_tags,labels_tags,image_front_small_url`
    const r = await fetch(url)
    const j = (await r.json()) as { status?: number; product?: Record<string, unknown> }
    const p = j.product
    if (j.status !== 1 || !p) return { draft: emptyDraft(clean), error: 'Open Food Facts does not know this barcode yet. Fill it in by hand (it takes a minute).' }
    const nu = (p.nutriments ?? {}) as OffNutriments
    const kj = num(nu, 'energy-kj_100g') ?? num(nu, 'energy_100g')
    const kcal = num(nu, 'energy-kcal_100g') ?? (kj != null ? Math.round(kj / 4.184) : null)
    const allergens = ((p.allergens_tags as string[] | undefined) ?? []).join(' ')
    const labels = ((p.labels_tags as string[] | undefined) ?? []).join(' ')
    const noGluten = /(no|without|free)[-_]?gluten|gluten[-_]free|glutenfrei/i.test(labels)
    const hasGluten = /en:(gluten|wheat|rye|barley|spelt|oats)\b/.test(allergens)
    const noLactose = /(no|without|free)[-_]?lactose|lactose[-_]free|laktosefrei/i.test(labels)
    const hasMilk = /en:milk\b/.test(allergens)
    const quantity = typeof p.quantity === 'string' ? p.quantity : null
    const draft: ProductDraft = {
      barcode: clean,
      name: String(p.product_name_de || p.product_name || '').trim(),
      brand: typeof p.brands === 'string' ? p.brands.split(',')[0].trim() || null : null,
      pack_size: quantity,
      unit: quantity && /\d\s*(ml|cl|l)\b/i.test(quantity) ? 'ml' : 'g',
      kcal_100: kcal,
      protein_100: num(nu, 'proteins_100g'),
      carbs_100: num(nu, 'carbohydrates_100g'),
      sugar_100: num(nu, 'sugars_100g'),
      fat_100: num(nu, 'fat_100g'),
      sat_fat_100: num(nu, 'saturated-fat_100g'),
      fibre_100: num(nu, 'fiber_100g'),
      salt_100: num(nu, 'salt_100g'),
      gluten: hasGluten ? 'contains' : noGluten ? 'free' : 'unknown',
      lactose: noLactose ? 'free' : hasMilk ? 'contains' : 'unknown',
      image_url: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : null,
      source: 'openfoodfacts',
      notes: null,
    }
    return { draft }
  } catch {
    return { error: 'Could not reach Open Food Facts. Check your internet and try again.' }
  }
}
