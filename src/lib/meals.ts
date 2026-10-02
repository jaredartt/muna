import { supabase } from './supabase'
import { liveTable } from './liveTable'
import { addDays, todayStr } from './dates'
import type { Member, Task, TaskDraft } from './types'
import type { Product } from './products'

// ---------- Types ----------
export type Slot = 'breakfast' | 'lunch' | 'merienda' | 'dinner'
export const SLOTS: { key: Slot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'merienda', label: 'Merienda' },
  { key: 'dinner', label: 'Dinner' },
]
/** One line of a recipe. amounts is grams (or ml) per person, keyed by the person's user id. */
export type Ingredient = { product_id: string | null; name: string; unit: 'g' | 'ml'; amounts: Record<string, number> }
export type Recipe = {
  id: string
  household_id: string
  code: string | null
  name: string
  slots: Slot[]
  ingredients: Ingredient[]
  method: string
  storage: string
}
export type RecipeDraft = Omit<Recipe, 'id' | 'household_id'>
export type PlanRow = { id: string; household_id: string; plan_date: string; slot: Slot; recipe_id: string }
export type PantryRow = { id: string; household_id: string; product_id: string; packs: number; pct_left: number; updated_at: string }
export type Macros = { kcal: number; protein: number; carbs: number; fat: number }

// ---------- Live stores ----------
const byCode = (a: Recipe, b: Recipe) => (a.code ?? 'zz').localeCompare(b.code ?? 'zz', undefined, { numeric: true }) || a.name.localeCompare(b.name)
const recipeStore = liveTable<Recipe>('recipes', 'muna.recipes.v1', byCode)
const planStore = liveTable<PlanRow>('meal_plan', 'muna.mealplan.v1', (a, b) => a.plan_date.localeCompare(b.plan_date))
const pantryStore = liveTable<PantryRow>('pantry', 'muna.pantry.v1', (a, b) => a.product_id.localeCompare(b.product_id))
export const useRecipes = recipeStore.use
export const usePlan = planStore.use
export const usePantry = pantryStore.use
export const recipesReady = recipeStore.isReady

export function startMealSync(householdId: string): () => void {
  const stops = [recipeStore.start(householdId), planStore.start(householdId), pantryStore.start(householdId)]
  return () => stops.forEach((s) => s())
}

// ---------- Maths ----------
export const first = (name: string) => name.trim().split(/\s+/)[0] || 'Someone'
const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export function productMap(products: Product[]): Map<string, Product> {
  return new Map(products.map((p) => [p.id, p]))
}

/** Calories and macros of one portion of a recipe for one person. complete = false when an ingredient has no product or no numbers. */
export function recipeMacros(r: Recipe, userId: string, products: Map<string, Product>): Macros & { complete: boolean } {
  const t = { ...ZERO }
  let complete = true
  for (const ing of r.ingredients) {
    const g = ing.amounts[userId] ?? 0
    const p = ing.product_id ? products.get(ing.product_id) : undefined
    if (!p || p.kcal_100 == null) {
      if (g > 0) complete = false
      continue
    }
    const f = g / 100
    t.kcal += (p.kcal_100 ?? 0) * f
    t.protein += (p.protein_100 ?? 0) * f
    t.carbs += (p.carbs_100 ?? 0) * f
    t.fat += (p.fat_100 ?? 0) * f
  }
  return { ...t, complete }
}

export const round = (n: number) => Math.round(n)

// ---------- What is at home ----------
export const inStock = (pantry: PantryRow[], productId: string) => pantry.some((p) => p.product_id === productId && p.packs > 0)

/** Ingredients that are not at home (only lines that point to a product can be checked). */
export function missingIngredients(r: Recipe, pantry: PantryRow[]): Ingredient[] {
  return r.ingredients.filter((i) => i.product_id && !inStock(pantry, i.product_id))
}

/** Adds (or takes away) a pack of a product at home. Ticking a "buy" line in a task calls this. */
export async function buyProduct(householdId: string, productId: string, delta = 1): Promise<void> {
  const cur = pantryStore.all().find((p) => p.product_id === productId)
  const packs = Math.max(0, (cur?.packs ?? 0) + delta)
  const pct = !cur || (cur.packs === 0 && delta > 0) ? 100 : cur.pct_left
  const { data } = await supabase
    .from('pantry')
    .upsert({ household_id: householdId, product_id: productId, packs, pct_left: pct, updated_at: new Date().toISOString() }, { onConflict: 'household_id,product_id' })
    .select('*')
    .single()
  if (data) pantryStore.upsert(data as PantryRow)
}

// ---------- Recipes ----------
export async function saveRecipe(householdId: string, draft: RecipeDraft, id?: string): Promise<string | null> {
  const row = { ...draft, name: draft.name.trim().slice(0, 160), updated_at: new Date().toISOString() }
  const q = id
    ? supabase.from('recipes').update(row).eq('id', id).select('*').single()
    : supabase.from('recipes').insert({ ...row, household_id: householdId }).select('*').single()
  const { data, error } = await q
  if (error || !data) return error?.code === '23505' ? 'A recipe with this code already exists.' : 'Could not save the recipe. Check your internet and try again.'
  recipeStore.upsert(data as Recipe)
  return null
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) return false
  recipeStore.remove(id)
  return true
}

// ---------- The plan per day ----------
export async function setMeal(householdId: string, date: string, slot: Slot, recipeId: string | null): Promise<void> {
  const cur = planStore.all().find((p) => p.plan_date === date && p.slot === slot)
  if (!recipeId) {
    if (!cur) return
    planStore.remove(cur.id)
    await supabase.from('meal_plan').delete().eq('id', cur.id)
    return
  }
  const { data } = await supabase
    .from('meal_plan')
    .upsert({ household_id: householdId, plan_date: date, slot, recipe_id: recipeId }, { onConflict: 'household_id,plan_date,slot' })
    .select('*')
    .single()
  if (data) planStore.upsert(data as PlanRow)
}

/** The Sunday on or before a date: the plan's week starts on cooking day. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 0 = Sunday
  return addDays(date, -day)
}

/** Fills the empty slots of the week (Sunday to Saturday) from Week A or Week B of the nutrition plan. */
export async function fillWeek(householdId: string, anyDayOfWeek: string, week: 'A' | 'B'): Promise<number> {
  const { WEEK_PLANS } = await import('../data/starter')
  const recipes = recipeStore.all()
  const start = weekStart(anyDayOfWeek)
  const rows: { household_id: string; plan_date: string; slot: Slot; recipe_id: string }[] = []
  WEEK_PLANS[week].forEach((day, i) => {
    const date = addDays(start, i)
    for (const slot of ['breakfast', 'lunch', 'merienda', 'dinner'] as Slot[]) {
      const code = day[slot]
      const r = code ? recipes.find((x) => x.code === code) : undefined
      if (!r) continue
      if (planStore.all().some((p) => p.plan_date === date && p.slot === slot)) continue // never overwrite a choice you made
      rows.push({ household_id: householdId, plan_date: date, slot, recipe_id: r.id })
    }
  })
  if (rows.length === 0) return 0
  const { data } = await supabase.from('meal_plan').upsert(rows, { onConflict: 'household_id,plan_date,slot' }).select('*')
  for (const r of (data ?? []) as PlanRow[]) planStore.upsert(r)
  return rows.length
}

// ---------- Starter pack: the 67 Rewe products and 20 recipes of the nutrition plan ----------
export async function loadStarter(householdId: string, members: Member[], existing: Product[]): Promise<string | null> {
  const { STARTER_PRODUCTS, STARTER_RECIPES } = await import('../data/starter')
  const idByKey = new Map<string, string>()
  const have = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]))
  const fresh = STARTER_PRODUCTS.filter((p) => {
    const hit = have.get(p.name.toLowerCase())
    if (hit) idByKey.set(p.key, hit)
    return !hit
  })
  if (fresh.length) {
    const rows = fresh.map((p) => ({
      household_id: householdId,
      name: p.name.slice(0, 160),
      pack_size: p.pack || null,
      unit: p.unit,
      kcal_100: p.kcal,
      protein_100: p.p,
      carbs_100: p.c,
      fat_100: p.f,
      sat_fat_100: p.sat,
      fibre_100: p.fib,
      salt_100: p.salt,
      gluten: p.gluten,
      lactose: p.lactose,
      source: 'manual',
      notes: p.note,
    }))
    const { data, error } = await supabase.from('products').insert(rows).select('id, name')
    if (error || !data) return 'Could not load the products. Check your internet and try again.'
    const byName = new Map((data as { id: string; name: string }[]).map((r) => [r.name.toLowerCase(), r.id]))
    for (const p of fresh) {
      const id = byName.get(p.name.slice(0, 160).toLowerCase())
      if (id) idByKey.set(p.key, id)
    }
  }
  const jared = members.find((m) => /jared/i.test(m.display_name)) ?? members[0]
  const other = members.find((m) => m.id !== jared?.id)
  const recRows = STARTER_RECIPES.map((r) => ({
    household_id: householdId,
    code: r.code,
    name: r.name,
    slots: r.slots,
    method: r.method,
    storage: r.storage,
    ingredients: r.ingredients.map((i) => ({
      product_id: idByKey.get(i.key) ?? null,
      name: i.name,
      unit: i.unit,
      amounts: { ...(jared ? { [jared.id]: i.j } : {}), ...(other ? { [other.id]: i.l } : {}) },
    })),
  }))
  const { error } = await supabase.from('recipes').upsert(recRows, { onConflict: 'household_id,code', ignoreDuplicates: true })
  return error ? 'Could not load the recipes. Check your internet and try again.' : null
}

// ---------- One shopping trip for everything the plan needs ----------
export const SHOPPING_TITLE = 'Grocery shopping'
type Need = { product_id: string; name: string; unit: string; grams: number; first: string }

/** The earliest day before `needed` that is not busy; when everything is busy, the quietest one. load(date) = how many things are on that day. */
export function pickShoppingDay(today: string, needed: string, load: (d: string) => number): string {
  const last = needed > today ? addDays(needed, -1) : today
  let best = today
  let bestLoad = Infinity
  for (let d = today; d <= last; d = addDays(d, 1)) {
    const l = load(d)
    if (l <= 2) return d
    if (l < bestLoad) {
      best = d
      bestLoad = l
    }
  }
  return best
}

type SyncArgs = {
  householdId: string
  tasks: Task[]
  addTask: (d: TaskDraft) => Promise<string | null>
  updateTask: (id: string, patch: Partial<Task>) => Promise<string | null>
  load: (date: string) => number
}
let syncing = false

/**
 * Looks at the meals planned for the next 7 days, finds what is not at home, and puts it all in ONE "Grocery shopping" task
 * on the first day that is not busy, with a to-do line per product. Returns a short message for the screen.
 */
export async function syncShopping(a: SyncArgs): Promise<string> {
  if (syncing) return ''
  syncing = true
  try {
    const today = todayStr()
    const horizon = addDays(today, 7)
    const recipes = recipeStore.all()
    const pantry = pantryStore.all()
    const need = new Map<string, Need>()
    for (const row of planStore.all()) {
      if (row.plan_date < today || row.plan_date > horizon) continue
      const r = recipes.find((x) => x.id === row.recipe_id)
      if (!r) continue
      for (const ing of r.ingredients) {
        if (!ing.product_id || inStock(pantry, ing.product_id)) continue
        const grams = Object.values(ing.amounts).reduce((s, n) => s + n, 0)
        const cur = need.get(ing.product_id)
        if (cur) {
          cur.grams += grams
          if (row.plan_date < cur.first) cur.first = row.plan_date
        } else need.set(ing.product_id, { product_id: ing.product_id, name: ing.name, unit: ing.unit, grams, first: row.plan_date })
      }
    }
    const existing = a.tasks.find((t) => t.title === SHOPPING_TITLE && !t.completed && !t.repeat && t.due_date && t.due_date >= today)
    const oldItems = existing?.checklist ?? []
    const wanted = [...need.values()].map((n) => ({ id: 'p:' + n.product_id, text: `${n.name} · ${Math.round(n.grams / 5) * 5 || 5} ${n.unit}`, done: false, product_id: n.product_id }))
    if (wanted.length === 0) {
      if (existing && oldItems.some((i) => !i.done)) {
        await a.updateTask(existing.id, { checklist: oldItems.filter((i) => i.done) })
        return 'Everything you need is at home, so I cleared the shopping list.'
      }
      return need.size === 0 && planStore.all().some((p) => p.plan_date >= today && p.plan_date <= horizon) ? 'Everything for the next 7 days is at home.' : ''
    }
    const firstNeeded = [...need.values()].map((n) => n.first).sort()[0]
    if (existing) {
      const keep = oldItems.filter((i) => i.done || !i.product_id) // bought lines and your own lines stay
      const have = new Set(keep.map((i) => i.id))
      const merged = [...keep, ...wanted.filter((w) => !have.has(w.id))]
      const patch: Partial<Task> = {}
      if (JSON.stringify(merged) !== JSON.stringify(oldItems)) patch.checklist = merged
      if (existing.due_date && firstNeeded <= existing.due_date) {
        const day = pickShoppingDay(today, firstNeeded, a.load)
        if (day !== existing.due_date) patch.due_date = day
      }
      if (Object.keys(patch).length) await a.updateTask(existing.id, patch)
      return `Updated your shopping task: ${wanted.length} thing${wanted.length === 1 ? '' : 's'} to buy.`
    }
    const day = pickShoppingDay(today, firstNeeded, a.load)
    await a.addTask({
      title: SHOPPING_TITLE,
      notes: 'Made by Muna from your meal plan. Tick a line when you have bought it and it goes into the pantry.',
      due_date: day,
      icon: 'shopping',
      color: 'peach',
      checklist: wanted,
      sync_google: true,
    })
    return `Added a shopping task on ${day} with ${wanted.length} thing${wanted.length === 1 ? '' : 's'} to buy.`
  } finally {
    syncing = false
  }
}
