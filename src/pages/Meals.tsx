import { useCallback, useMemo, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconPlus, IconSearch } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useShopping } from '../hooks/useShopping'
import RecipePicker from '../components/RecipePicker'
import RecipeSheet from '../components/RecipeSheet'
import { addDays, formatDateNice, parseDateStr, todayStr } from '../lib/dates'
import { fillWeek, first, loadStarter, missingIngredients, productMap, recipeMacros, round, setMeal, SLOTS, usePantry, usePlan, useRecipes, weekStart, type Recipe, type Slot } from '../lib/meals'
import { useProducts } from '../lib/products'

type Tab = 'plan' | 'recipes'
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Meals: choose what you eat each day, see calories and macros against your targets, and let Muna plan the shopping. */
export default function Meals() {
  const { profile, members: allMembers, session } = useAuth()
  const products = useProducts()
  const recipes = useRecipes()
  const plan = usePlan()
  const pantry = usePantry()
  const today = todayStr()
  const [tab, setTab] = useState<Tab>('plan')
  const [date, setDate] = useState(today)
  const [picking, setPicking] = useState<Slot | null>(null)
  const [openRecipe, setOpenRecipe] = useState<{ recipe: Recipe | null } | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [slotFilter, setSlotFilter] = useState<Slot | 'all'>('all')

  // the person using the app comes first
  const members = useMemo(() => {
    const me = session?.user.id
    return [...allMembers].sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.display_name.localeCompare(b.display_name)))
  }, [allMembers, session])
  const pmap = useMemo(() => productMap(products), [products])

  // the shopping task itself is kept up to date by <ShoppingSync/>; the button below runs the same check on demand
  const shop = useShopping()
  const runShopping = useCallback(async () => {
    setBusy(true)
    const m = await shop()
    setBusy(false)
    setMsg(m || 'Nothing to buy for the next 7 days.')
  }, [shop])

  if (!profile) return null
  const hid = profile.household_id

  const planOf = (d: string, s: Slot) => {
    const row = plan.find((p) => p.plan_date === d && p.slot === s)
    return row ? recipes.find((r) => r.id === row.recipe_id) : undefined
  }
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i))
  const hasMeals = (d: string) => plan.some((p) => p.plan_date === d)

  // totals of the chosen day, per person
  const totals = members.map((m) => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    for (const s of SLOTS) {
      const r = planOf(date, s.key)
      if (!r) continue
      const x = recipeMacros(r, m.id, pmap)
      t.kcal += x.kcal
      t.protein += x.protein
      t.carbs += x.carbs
      t.fat += x.fat
    }
    return { m, t }
  })

  const shownRecipes = recipes.filter((r) => (slotFilter === 'all' || r.slots.includes(slotFilter)) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())))

  async function start() {
    setBusy(true)
    const err = await loadStarter(hid, allMembers, products)
    setBusy(false)
    setMsg(err ?? 'Loaded your products and 20 recipes.')
  }
  async function fill(week: 'A' | 'B') {
    setBusy(true)
    const n = await fillWeek(hid, date, week)
    setBusy(false)
    setMsg(n ? `Filled ${n} meal${n === 1 ? '' : 's'} from Week ${week}. Your own choices were kept.` : 'Nothing to fill: either the recipes are not loaded yet or every slot already has a meal.')
  }

  const chip = (r: Recipe) => {
    const miss = missingIngredients(r, pantry).length
    return <span className={'ml-chip ' + (miss === 0 ? 'ok' : 'miss')}>{miss === 0 ? 'Cookable' : `${miss} missing`}</span>
  }
  const kcalLine = (r: Recipe) => members.map((m) => `${first(m.display_name)} ${round(recipeMacros(r, m.id, pmap).kcal)}`).join(' · ') + ' kcal'

  return (
    <div className="page">
      <header className="page-head">
        <h1>Meals</h1>
      </header>

      <div className="segmented small-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>
          Plan
        </button>
        <button role="tab" aria-selected={tab === 'recipes'} className={tab === 'recipes' ? 'active' : ''} onClick={() => setTab('recipes')}>
          Recipes
        </button>
      </div>

      {msg && (
        <p className="prod-note" role="status" onClick={() => setMsg('')}>
          {msg}
        </p>
      )}

      {tab === 'plan' && (
        <>
          {recipes.length === 0 && (
            <p className="prod-note">
              No recipes yet. Open the Recipes tab and tap "Load the plan" to get your 20 meals.
            </p>
          )}
          <section className="card">
            <div className="ml-daynav">
              <button className="icon-btn" onClick={() => setDate(addDays(date, -7))} aria-label="Previous week">
                <IconChevronLeft size={22} />
              </button>
              <strong>{date === today ? 'Today' : formatDateNice(date)}</strong>
              <button className="icon-btn" onClick={() => setDate(addDays(date, 7))} aria-label="Next week">
                <IconChevronRight size={22} />
              </button>
            </div>
            <div className="ml-week">
              {weekDays.map((d) => (
                <button key={d} className={'ml-day' + (d === date ? ' on' : '') + (d === today ? ' today' : '')} onClick={() => setDate(d)} aria-label={formatDateNice(d)} aria-pressed={d === date}>
                  <span>{DAY[parseDateStr(d).getDay()]}</span>
                  <strong>{parseDateStr(d).getDate()}</strong>
                  <i className={hasMeals(d) ? 'on' : ''} />
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            {SLOTS.map((s) => {
              const r = planOf(date, s.key)
              return (
                <div key={s.key} className="ml-slot">
                  <span className="ml-slot-name">{s.label}</span>
                  {r ? (
                    <div className="ml-slot-body">
                      <button className="ml-slot-recipe" onClick={() => setOpenRecipe({ recipe: r })}>
                        <strong>{r.name}</strong>
                        <span className="muted small">{kcalLine(r)}</span>
                      </button>
                      {chip(r)}
                      <button className="ml-link" onClick={() => setPicking(s.key)}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <button className="ml-empty" onClick={() => setPicking(s.key)}>
                      <IconPlus size={18} /> Choose a meal
                    </button>
                  )}
                </div>
              )
            })}
          </section>

          <section className="card">
            <h3>The day in numbers</h3>
            {totals.map(({ m, t }) => {
              const g = m.targets
              const pct = g?.kcal ? Math.min(100, (t.kcal / g.kcal) * 100) : 0
              return (
                <div key={m.id} className="ml-total">
                  <div className="ml-total-head">
                    <strong>{first(m.display_name)}</strong>
                    <span>
                      {round(t.kcal)}
                      {g ? ` / ${g.kcal}` : ''} kcal
                    </span>
                  </div>
                  {g && (
                    <div className="ml-bar" aria-hidden="true">
                      <i style={{ width: pct + '%' }} />
                    </div>
                  )}
                  <span className="muted small">
                    Protein {round(t.protein)}
                    {g ? `/${g.protein}` : ''} g · Carbs {round(t.carbs)}
                    {g ? `/${g.carbs}` : ''} g · Fat {round(t.fat)}
                    {g ? `/${g.fat}` : ''} g
                  </span>
                </div>
              )
            })}
          </section>

          <section className="card">
            <h3>Plan the week</h3>
            <p className="muted small">Fill the empty meals of this week from your nutrition plan. Your own choices are never overwritten.</p>
            <div className="btn-row">
              <button className="btn soft" onClick={() => fill('A')} disabled={busy}>
                Week A
              </button>
              <button className="btn soft" onClick={() => fill('B')} disabled={busy}>
                Week B
              </button>
              <button className="btn primary" onClick={runShopping} disabled={busy}>
                {busy ? 'Checking…' : 'Check what is missing'}
              </button>
            </div>
            <p className="muted small">Muna looks at the next 7 days, and puts everything you do not have yet in one shopping task with a to-do list. Tick a line when you have bought it and the recipe becomes cookable.</p>
          </section>
        </>
      )}

      {tab === 'recipes' && (
        <>
          {!recipes.some((r) => r.code) && (
            <section className="card">
              <h3>Your nutrition plan</h3>
              <p className="muted small">Load the 67 Rewe products and the 20 recipes (breakfasts, merienda, lunches and dinners) made for the two of you. Products you already have are kept.</p>
              <button className="btn primary" onClick={start} disabled={busy}>
                {busy ? 'Loading…' : 'Load the plan'}
              </button>
            </section>
          )}
          <section className="card">
            <div className="prod-search">
              <IconSearch size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`} aria-label="Search recipes" />
            </div>
            <div className="ml-slotline">
              {(['all', ...SLOTS.map((s) => s.key)] as (Slot | 'all')[]).map((k) => (
                <button key={k} className={'ml-toggle' + (slotFilter === k ? ' on' : '')} onClick={() => setSlotFilter(k)} aria-pressed={slotFilter === k}>
                  {k === 'all' ? 'All' : SLOTS.find((s) => s.key === k)?.label}
                </button>
              ))}
            </div>
            <div className="ml-list">
              {recipes.length > 0 && shownRecipes.length === 0 && <p className="muted small">No recipe matches that.</p>}
              {shownRecipes.map((r) => (
                <button key={r.id} className="ml-row" onClick={() => setOpenRecipe({ recipe: r })}>
                  <span className="ml-row-main">
                    <strong>{r.name}</strong>
                    <span className="muted small">{kcalLine(r)}</span>
                  </span>
                  {chip(r)}
                </button>
              ))}
            </div>
            <button className="btn soft" onClick={() => setOpenRecipe({ recipe: null })}>
              <IconPlus size={18} /> New recipe
            </button>
          </section>
        </>
      )}

      {picking && (
        <RecipePicker
          slot={picking}
          recipes={recipes}
          pantry={pantry}
          products={pmap}
          members={members}
          current={planOf(date, picking)?.id ?? null}
          onPick={(id) => {
            void setMeal(hid, date, picking, id)
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {openRecipe && (
        <RecipeSheet
          householdId={hid}
          recipe={openRecipe.recipe}
          members={members}
          productList={products}
          products={pmap}
          pantry={pantry}
          defaultDate={date}
          onPlan={(id, d, s) => {
            void setMeal(hid, d, s, id)
            setDate(d)
            setTab('plan')
          }}
          onClose={() => setOpenRecipe(null)}
        />
      )}
    </div>
  )
}
