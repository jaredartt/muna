import { useMemo, useRef, useState } from 'react'
import { IconPlus, IconSearch, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { deleteRecipe, first, inStock, missingIngredients, recipeMacros, round, saveRecipe, SLOTS, type Ingredient, type PantryRow, type Recipe, type Slot } from '../lib/meals'
import { todayStr } from '../lib/dates'
import type { Product } from '../lib/products'
import type { Member } from '../lib/types'

type Props = {
  householdId: string
  recipe: Recipe | null // null = a new recipe
  members: Member[] // the person using the app comes first
  productList: Product[]
  products: Map<string, Product>
  pantry: PantryRow[]
  defaultDate: string
  onPlan: (recipeId: string, date: string, slot: Slot) => void
  onClose: () => void
}

type Row = { product_id: string | null; name: string; unit: 'g' | 'ml'; amounts: Record<string, string> }

const toRows = (r: Recipe | null): Row[] =>
  (r?.ingredients ?? []).map((i) => ({ product_id: i.product_id, name: i.name, unit: i.unit, amounts: Object.fromEntries(Object.entries(i.amounts).map(([k, v]) => [k, String(v)])) }))
const num = (s: string | undefined) => {
  const n = Number((s ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}
const toIngredients = (rows: Row[]): Ingredient[] =>
  rows.map((r) => ({ product_id: r.product_id, name: r.name, unit: r.unit, amounts: Object.fromEntries(Object.entries(r.amounts).map(([k, v]) => [k, num(v)])) }))

/** One recipe: look at it (grams for each person, calories and macros, what is missing) or edit it. */
export default function RecipeSheet({ householdId, recipe, members, productList, products, pantry, defaultDate, onPlan, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const [editing, setEditing] = useState(!recipe)
  const [name, setName] = useState(recipe?.name ?? '')
  const [slots, setSlots] = useState<Slot[]>(recipe?.slots ?? [])
  const [rows, setRows] = useState<Row[]>(() => toRows(recipe))
  const [method, setMethod] = useState(recipe?.method ?? '')
  const [storage, setStorage] = useState(recipe?.storage ?? '')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [planDate, setPlanDate] = useState(defaultDate || todayStr())
  const [planSlot, setPlanSlot] = useState<Slot>(recipe?.slots[0] ?? 'dinner')

  // what the sheet is showing right now (the saved recipe, or the one being edited)
  const live: Recipe = useMemo(
    () => ({ id: recipe?.id ?? '', household_id: householdId, code: recipe?.code ?? null, name, slots, ingredients: editing ? toIngredients(rows) : (recipe?.ingredients ?? []), method, storage }),
    [recipe, householdId, name, slots, rows, method, storage, editing],
  )
  const macros = members.map((m) => ({ m, x: recipeMacros(live, m.id, products) }))
  const incomplete = macros.some((x) => !x.x.complete)
  const missing = missingIngredients(live, pantry)

  const found = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return productList.filter((p) => `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(t)).slice(0, 8)
  }, [q, productList])

  function addProduct(p: Product) {
    setRows((r) => [...r, { product_id: p.id, name: p.name, unit: p.unit, amounts: {} }])
    setQ('')
  }
  function setAmount(i: number, userId: string, v: string) {
    setRows((r) => r.map((x, j) => (j === i ? { ...x, amounts: { ...x.amounts, [userId]: v } } : x)))
  }
  /** Fills the other people's grams from the first person's, by the ratio of their daily calories (about 79% for Lidia). */
  function fillOthers() {
    const me = members[0]
    if (!me) return
    setRows((rs) =>
      rs.map((x) => {
        const base = num(x.amounts[me.id])
        if (!base) return x
        const amounts = { ...x.amounts }
        for (const m of members.slice(1)) {
          if (num(amounts[m.id])) continue
          const ratio = m.targets?.kcal && me.targets?.kcal ? m.targets.kcal / me.targets.kcal : 1
          const v = base * ratio
          const step = v < 20 ? 1 : 5
          amounts[m.id] = String(Math.max(1, Math.round(v / step) * step))
        }
        return { ...x, amounts }
      }),
    )
  }

  async function save() {
    setError('')
    if (!name.trim()) return setError('Give the recipe a name.')
    if (rows.length === 0) return setError('Add at least one ingredient.')
    setBusy(true)
    const err = await saveRecipe(householdId, { code: recipe?.code ?? null, name, slots, ingredients: toIngredients(rows), method: method.trim(), storage: storage.trim() }, recipe?.id)
    setBusy(false)
    if (err) return setError(err)
    onClose()
  }
  async function remove() {
    if (!recipe) return
    if (!confirmDel) return setConfirmDel(true)
    setBusy(true)
    const ok = await deleteRecipe(recipe.id)
    setBusy(false)
    if (ok) onClose()
    else setError('Could not delete. Check your internet and try again.')
  }

  const toggleSlot = (s: Slot) => setSlots((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const macroBlock = (
    <div className="ml-macros">
      {macros.map(({ m, x }) => (
        <div key={m.id} className="ml-macro">
          <strong>{first(m.display_name)}</strong>
          <span className="ml-kcal">{round(x.kcal)} kcal</span>
          <span className="muted small">
            P {round(x.protein)} · C {round(x.carbs)} · F {round(x.fat)}
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={recipe ? 'Recipe' : 'New recipe'}>
        <div className="sheet-head">
          <h2>{!recipe ? 'New recipe' : editing ? 'Edit recipe' : recipe.name}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>

        {!editing && recipe && (
          <>
            <div className="ml-slotline">
              {recipe.slots.map((s) => (
                <span key={s} className="ml-chip plain">
                  {SLOTS.find((x) => x.key === s)?.label}
                </span>
              ))}
              <span className={'ml-chip ' + (missing.length === 0 ? 'ok' : 'miss')}>{missing.length === 0 ? 'Cookable now' : `${missing.length} missing`}</span>
            </div>
            <p className="muted small">One portion for each of you:</p>
            {macroBlock}
            {incomplete && <p className="prod-note">Some ingredients have no nutrition numbers yet, so the totals are a little low.</p>}

            <h3 className="prod-h">Ingredients</h3>
            <div className="ml-ing">
              {recipe.ingredients.map((i, k) => {
                const have = !i.product_id || inStock(pantry, i.product_id)
                return (
                  <div key={k} className="ml-ing-row">
                    <span className={'ml-dot ' + (have ? 'ok' : 'miss')} aria-label={have ? 'At home' : 'Missing'} />
                    <span className="ml-ing-name">{i.name}</span>
                    <span className="ml-ing-amts">{members.map((m) => `${round(i.amounts[m.id] ?? 0)} ${i.unit}`).join(' / ')}</span>
                  </div>
                )
              })}
              <p className="muted small">Amounts: {members.map((m) => first(m.display_name)).join(' / ')}. Raw or dry weight.</p>
            </div>

            {recipe.method && (
              <>
                <h3 className="prod-h">Method</h3>
                <p className="ml-text">{recipe.method}</p>
              </>
            )}
            {recipe.storage && (
              <>
                <h3 className="prod-h">Storage</h3>
                <p className="ml-text">{recipe.storage}</p>
              </>
            )}

            <h3 className="prod-h">Plan it</h3>
            <div className="row-2">
              <label className="field">
                <span>Day</span>
                <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Meal</span>
                <select value={planSlot} onChange={(e) => setPlanSlot(e.target.value as Slot)}>
                  {SLOTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="sheet-actions">
              <button className="btn soft" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                className="btn primary grow"
                disabled={!planDate}
                onClick={() => {
                  onPlan(recipe.id, planDate, planSlot)
                  onClose()
                }}
              >
                Add to plan
              </button>
            </div>
          </>
        )}

        {editing && (
          <>
            <label className="field">
              <span>Name</span>
              <input autoFocus={!recipe} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken rice bowl" maxLength={160} />
            </label>
            <div className="field">
              <span>For which meals?</span>
              <div className="ml-slotline">
                {SLOTS.map((s) => (
                  <button key={s.key} type="button" className={'ml-toggle' + (slots.includes(s.key) ? ' on' : '')} onClick={() => toggleSlot(s.key)} aria-pressed={slots.includes(s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Ingredients (grams or ml for one portion)</span>
              <div className="ml-ing">
                {rows.map((r, i) => (
                  <div key={i} className="ml-edit-row">
                    <div className="ml-edit-top">
                      <span className="ml-ing-name">{r.name}</span>
                      <button type="button" className="icon-btn" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`}>
                        <IconX size={16} />
                      </button>
                    </div>
                    <div className="ml-amt-grid">
                      {members.map((m) => (
                        <label key={m.id} className="ml-amt">
                          <span>
                            {first(m.display_name)} ({r.unit})
                          </span>
                          <input inputMode="decimal" value={r.amounts[m.id] ?? ''} onChange={(e) => setAmount(i, m.id, e.target.value)} placeholder="0" maxLength={7} />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="prod-search">
                  <IconSearch size={18} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a product to this recipe" aria-label="Search your products" />
                </div>
                {q.trim() && found.length === 0 && <p className="muted small">No product matches that. Add it first on the Products page (Profile, then Products).</p>}
                {found.map((p) => (
                  <button key={p.id} type="button" className="ml-row" onClick={() => addProduct(p)}>
                    <span className="ml-row-main">
                      <strong>{p.name}</strong>
                      <span className="muted small">{p.kcal_100 == null ? 'No nutrition numbers' : `${p.kcal_100} kcal per 100 ${p.unit}`}</span>
                    </span>
                    <IconPlus size={18} />
                  </button>
                ))}
                {rows.length > 0 && members.length > 1 && (
                  <button type="button" className="btn soft" onClick={fillOthers}>
                    Fill {members.slice(1).map((m) => first(m.display_name)).join(' and ')} from {first(members[0].display_name)} (by daily calories)
                  </button>
                )}
              </div>
            </div>

            <p className="muted small">Calories and macros of this recipe:</p>
            {macroBlock}
            {incomplete && <p className="prod-note">An ingredient has no nutrition numbers, so the totals are low.</p>}

            <label className="field">
              <span>Method</span>
              <textarea value={method} onChange={(e) => setMethod(e.target.value)} rows={3} placeholder="How to cook it…" maxLength={3000} />
            </label>
            <label className="field">
              <span>Storage</span>
              <textarea value={storage} onChange={(e) => setStorage(e.target.value)} rows={2} placeholder="e.g. Keeps 3 days in the fridge" maxLength={600} />
            </label>
            {error && <p className="prod-error" role="alert">{error}</p>}
            <div className="sheet-actions">
              {recipe && (
                <button className="btn danger" onClick={remove} disabled={busy}>
                  <IconTrashFilled size={18} /> {confirmDel ? 'Tap again to delete' : 'Delete'}
                </button>
              )}
              <button className="btn primary grow" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
