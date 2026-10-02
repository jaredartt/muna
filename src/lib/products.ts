import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// The home's product list (table "products"). Kept in memory, cached on the phone, live through realtime.
// A product is filled by scanning its barcode: the nutrition comes from Open Food Facts (a free, open database) and can be corrected by hand.
export type Tri = 'free' | 'contains' | 'traces' | 'unknown'
// Hormone disruptors (endocrine disruptors): 'possible' = an ingredient on the suspect list was found, 'none' = none of them in the ingredient list, 'unknown' = not checked.
export type Edc = 'none' | 'possible' | 'unknown'
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
  source: 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts' | 'openpetfoodfacts' | 'upcitemdb' | 'manual'
  edc: Edc
  edc_note: string | null
  notes: string | null
  /** true = buy it again when it runs out (Muna lists it); false = a one-time purchase, never listed as "running low". */
  rebuy: boolean
  created_at: string
}
export type ProductDraft = Omit<Product, 'id' | 'household_id' | 'created_at'>

const COLS =
  'id, household_id, barcode, name, brand, pack_size, unit, kcal_100, protein_100, carbs_100, sugar_100, fat_100, sat_fat_100, fibre_100, salt_100, gluten, lactose, image_url, source, notes, edc, edc_note, rebuy, created_at'
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
/** The list right now, for code that is not a React component. */
export const allProducts = () => items

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

/** Finds a product by barcode, whichever way the barcode is written (UPC-A with 12 digits, EAN-13 with 13). */
export function findByBarcode(code: string): Product | undefined {
  const v = barcodeVariants(code.replace(/\D/g, ''))
  return items.find((i) => i.barcode != null && v.includes(i.barcode))
}

/**
 * Teaches Muna a barcode: saves it on a product you already have, for good. It is shared with everyone in the home,
 * so the next scan (yours or Lidia's) finds the product straight away.
 */
export async function learnBarcode(productId: string, code: string): Promise<string | null> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 6 || clean.length > 20) return 'A barcode has 6 to 20 digits.'
  const other = findByBarcode(clean)
  if (other && other.id !== productId) return `This barcode already belongs to "${other.name}".`
  const { data, error } = await supabase.from('products').update({ barcode: clean, updated_at: new Date().toISOString() }).eq('id', productId).select(COLS).single()
  if (error || !data) {
    if (error?.code === '23505') return 'This barcode is already in your list.'
    return 'Could not save the barcode. Check your internet and try again.'
  }
  upsertLocal(data as Product)
  return null
}

// Words that say nothing about which product it is (shop brand, pack sizes, "bio"), left out when comparing names.
const NAME_NOISE = new Set(['rewe', 'bio', 'beste', 'wahl', 'the', 'and', 'und', 'mit', 'ohne', 'von', 'der', 'die', 'das', 'stück', 'stueck', 'piece', 'pack', 'class', 'klasse', 'natur', 'frisch', 'fresh'])
const nameWords = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^\d/.test(w) && !NAME_NOISE.has(w))

/**
 * Your products that have no barcode yet, the most likely match first (by name and brand). Used when a scan finds nothing,
 * so you can say "this is my X" instead of typing a new product. `hint` is what the online databases called it, if they knew.
 */
export function unbarcoded(hint = ''): { product: Product; likely: boolean }[] {
  const want = nameWords(hint)
  return items
    .filter((p) => !p.barcode)
    .map((p) => {
      const words = nameWords(`${p.name} ${p.brand ?? ''}`)
      const hits = want.length ? words.filter((w) => want.some((x) => x === w || (x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x))))).length : 0
      return { product: p, hits }
    })
    .sort((a, b) => b.hits - a.hits || a.product.name.localeCompare(b.product.name))
    .map(({ product, hits }) => ({ product, likely: hits > 0 }))
}

export async function saveProduct(householdId: string, draft: ProductDraft, id?: string): Promise<{ error: string | null; product: Product | null }> {
  const row = { ...draft, name: draft.name.trim().slice(0, 160), updated_at: new Date().toISOString() }
  const q = id
    ? supabase.from('products').update(row).eq('id', id).select(COLS).single()
    : supabase.from('products').insert({ ...row, household_id: householdId }).select(COLS).single()
  const { data, error } = await q
  if (error || !data) {
    if (error?.code === '23505') return { error: 'This barcode is already in your list.', product: null }
    return { error: 'Could not save the product. Check your internet and try again.', product: null }
  }
  upsertLocal(data as Product)
  return { error: null, product: data as Product }
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
  edc: 'unknown',
  edc_note: null,
  rebuy: true,
})

type OffNutriments = Record<string, unknown>
const num = (nu: OffNutriments, key: string): number | null => {
  const v = nu[key]
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
}

const GLUTEN_RE = /\b(weizen\w*|wheat|gerste\w*|barley|roggen\w*|rye|dinkel\w*|spelt|hafer\w*|oats?|malz\w*|malt|kamut|triticale|couscous|seitan)\b/i
const MILK_RE = /\b(milch(?!s[aä]ure)\w*|milk|molke\w*|whey|laktose|lactose|sahne|cream|butter\w*|käse|cheese|joghurt|yogh?urt|quark|casein|kasein)\b/i
const LACTOSE_FREE_NAME = /(laktose|lactose)[ -]?(frei|free)|ohne laktose|lactose[ -]free|\bLF\b/i

// Ingredients that scientists and the EU list as suspected hormone (endocrine) disruptors. Not proof of harm, and never a full list.
const EDC_LIST: [RegExp, string][] = [
  [/paraben/i, 'parabens'],
  [/triclosan/i, 'triclosan'],
  [/triclocarban/i, 'triclocarban'],
  [/benzophenone|oxybenzone/i, 'oxybenzone / benzophenone'],
  [/ethylhexyl methoxycinnamate|octinoxate/i, 'octinoxate'],
  [/homosalate/i, 'homosalate'],
  [/4-?methylbenzylidene camphor|\b4-?mbc\b/i, '4-MBC'],
  [/butylated hydroxyanisole|\bbha\b|\be ?320\b/i, 'BHA (E320)'],
  [/butylated hydroxytoluene|\bbht\b|\be ?321\b/i, 'BHT (E321)'],
  [/cyclotetrasiloxane/i, 'siloxane D4'],
  [/phthalate/i, 'phthalates'],
  [/bisphenol/i, 'bisphenols'],
  [/perfluor|polyperfluor|\bptfe\b/i, 'PFAS'],
  [/resorcinol/i, 'resorcinol'],
  [/butylphenyl methylpropional|lilial/i, 'lilial'],
]
const FRAGRANCE_RE = /\b(parfum|fragrance|perfume)\b/i

/** Checks an ingredient list against the suspect list above. Perfume ("parfum") is a secret mix, so it counts as possible too. */
export function edcCheck(text: string, additives: string[] = []): { edc: Edc; note: string | null } {
  const hay = `${text} ${additives.join(' ')}`.replace(/en:/g, '')
  if (!text.trim() && additives.length === 0) return { edc: 'unknown', note: null }
  const found = EDC_LIST.filter(([re]) => re.test(hay)).map(([, label]) => label)
  const fragrance = FRAGRANCE_RE.test(text)
  if (found.length || fragrance) {
    const parts: string[] = []
    if (found.length) parts.push(`Contains ${found.join(', ')}.`)
    if (fragrance) parts.push('Fragrance (parfum) is a secret mix and can hide phthalates.')
    return { edc: 'possible', note: parts.join(' ') }
  }
  return { edc: 'none', note: 'No suspected hormone disruptor in the ingredient list. Packaging and residues cannot be checked from a barcode.' }
}

type OffProduct = Record<string, unknown>
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

type OffSource = 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts' | 'openpetfoodfacts'
// The Open ... Facts family shares one API and one barcode list format. Food first, then cosmetics, other products, pet food.
const OFF_SITES: { source: OffSource; host: string; label: string }[] = [
  { source: 'openfoodfacts', host: 'world.openfoodfacts.org', label: 'Open Food Facts' },
  { source: 'openbeautyfacts', host: 'world.openbeautyfacts.org', label: 'Open Beauty Facts' },
  { source: 'openproductsfacts', host: 'world.openproductsfacts.org', label: 'Open Products Facts' },
  { source: 'openpetfoodfacts', host: 'world.openpetfoodfacts.org', label: 'Open Pet Food Facts' },
]
const OFF_FIELDS = 'code,product_name,product_name_de,generic_name,brands,quantity,nutriments,allergens_tags,traces_tags,labels_tags,additives_tags,ingredients_text,ingredients_text_de,image_front_small_url'

/** The same barcode is written in different lengths: UPC-A (12 digits) is EAN-13 with a leading 0, and some packs print the 13 digits without it. */
function barcodeVariants(clean: string): string[] {
  const v = [clean]
  if (clean.length === 12) v.push('0' + clean)
  if (clean.length === 13 && clean.startsWith('0')) v.push(clean.slice(1))
  if (clean.length === 8) v.push('00000' + clean) // EAN-8 stored padded by some databases
  return v
}

async function offFetch(host: string, code: string): Promise<OffProduct | null> {
  try {
    const r = await fetch(`https://${host}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const j = (await r.json()) as { status?: number; product?: OffProduct }
    return j.status === 1 && j.product ? j.product : null
  } catch {
    return null
  }
}

/** Name, brand and size only (no nutrition): UPCitemdb, a free general product database. Limited to about 100 lookups a day. */
async function upcItemDb(code: string): Promise<{ title: string; brand: string; size: string; image: string } | null> {
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const j = (await r.json()) as { items?: { title?: string; brand?: string; size?: string; images?: string[] }[] }
    const it = j.items?.[0]
    if (!it?.title) return null
    return { title: it.title.slice(0, 160), brand: (it.brand ?? '').slice(0, 120), size: (it.size ?? '').slice(0, 60), image: it.images?.[0] && it.images[0].length <= 500 ? it.images[0] : '' }
  } catch {
    return null
  }
}

/**
 * Looks a barcode up in several free databases at the same time (Open Food Facts, Open Beauty Facts, Open Products Facts,
 * Open Pet Food Facts) under each way of writing the barcode, and uses the first one that knows a name. If none does, UPCitemdb
 * can still give the name and brand. Nothing is saved: the person checks the numbers first.
 */
export type LookupResult = { draft?: ProductDraft; error?: string }
export async function lookupBarcode(code: string): Promise<LookupResult> {
  const clean = code.replace(/\D/g, '')
  if (clean.length < 6) return { error: 'A barcode has at least 6 digits.' }
  try {
    const variants = barcodeVariants(clean)
    const jobs = OFF_SITES.flatMap((site) => variants.map((v) => ({ site, v, run: offFetch(site.host, v) })))
    const found = await Promise.all(jobs.map(async (j) => ({ ...j, p: await j.run })))
    const hits = found.filter((f) => f.p)
    const best = hits.find((f) => ((str(f.p!.product_name_de) || str(f.p!.product_name)).trim())) ?? hits[0]
    if (!best) {
      const u = (await Promise.all(variants.map(upcItemDb))).find(Boolean)
      if (u) {
        const draft = emptyDraft(clean)
        draft.name = u.title
        draft.brand = u.brand || null
        draft.pack_size = u.size || null
        draft.image_url = u.image || null
        draft.source = 'upcitemdb'
        return { draft, error: 'Found the name and brand on UPCitemdb, but it has no nutrition numbers. Please fill them in from the pack.' }
      }
      return { draft: emptyDraft(clean), error: 'None of the free barcode databases (Open Food Facts, Open Beauty Facts, Open Products Facts, Open Pet Food Facts, UPCitemdb) knows this barcode yet. Fill it in by hand; it takes a minute.' }
    }
    const p = best.p as OffProduct
    const source = best.site.source
    const nu = (p.nutriments ?? {}) as OffNutriments
    const kj = num(nu, 'energy-kj_100g') ?? num(nu, 'energy_100g')
    const kcal = num(nu, 'energy-kcal_100g') ?? (kj != null ? Math.round(kj / 4.184) : null)
    const allergens = arr(p.allergens_tags).join(' ')
    const traces = arr(p.traces_tags).join(' ')
    const labels = arr(p.labels_tags).join(' ')
    const name = (str(p.product_name_de) || str(p.product_name)).trim()
    const ingredients = str(p.ingredients_text_de) || str(p.ingredients_text)
    const hasIngredients = ingredients.trim().length > 3

    // Gluten: a "gluten-free" label wins, then the allergen tag, then the ingredient list.
    const noGluten = /(no|without|free)[-_]?gluten|gluten[-_]free|glutenfrei/i.test(labels)
    const glutenAllergen = /en:(gluten|wheat|rye|barley|spelt|oats)\b/.test(allergens)
    const glutenTrace = /en:(gluten|wheat|rye|barley|spelt|oats)\b/.test(traces)
    const gluten: Tri = noGluten ? 'free' : glutenAllergen || (hasIngredients && GLUTEN_RE.test(ingredients)) ? 'contains' : glutenTrace ? 'traces' : hasIngredients ? 'free' : 'unknown'

    // Lactose: "laktosefrei" in the name or labels wins (the milk allergen tag stays on lactose-free milk products).
    const noLactose = /(no|without|free)[-_]?lactose|lactose[-_]free|laktosefrei/i.test(labels) || LACTOSE_FREE_NAME.test(`${name} ${str(p.generic_name)}`)
    const milkAllergen = /en:milk\b/.test(allergens)
    const milkTrace = /en:milk\b/.test(traces)
    const lactose: Tri = noLactose ? 'free' : milkAllergen || (hasIngredients && MILK_RE.test(ingredients)) ? 'contains' : milkTrace ? 'traces' : hasIngredients ? 'free' : 'unknown'

    const e = edcCheck(ingredients, arr(p.additives_tags))
    const quantity = typeof p.quantity === 'string' ? p.quantity : null
    const draft: ProductDraft = {
      barcode: clean,
      name,
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
      gluten,
      lactose,
      image_url: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : null,
      source,
      notes: null,
      edc: e.edc,
      edc_note: e.note,
      rebuy: true,
    }
    return { draft }
  } catch {
    return { error: 'Could not reach the barcode databases. Check your internet and try again.' }
  }
}
