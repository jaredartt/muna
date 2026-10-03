import { useEffect, useMemo, useRef } from 'react'
import { useShopping } from '../hooks/useShopping'
import { usePantry, usePlan, useRecipes } from '../lib/meals'

const DAY_KEY = 'muna.shopDay.v1'

// Keeps the shopping task up to date by itself (renders nothing): a moment after the meal plan or the pantry changes,
// and once a day when the app opens. Both phones may run it, so it waits a random moment and re-checks the real list first.
export default function ShoppingSync() {
  const run = useShopping()
  const runRef = useRef(run)
  runRef.current = run
  const plan = usePlan()
  const pantry = usePantry()
  const recipes = useRecipes()
  const signature = useMemo(
    () => plan.map((p) => `${p.plan_date}${p.slot}${p.recipe_id}`).join('|') + '#' + pantry.map((p) => `${p.product_id}${p.packs}${p.pct_left}`).join('|') + '#' + recipes.length,
    [plan, pantry, recipes.length],
  )

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = window.setTimeout(() => void runRef.current({ create: false }), 2000 + Math.random() * 3000)
    return () => window.clearTimeout(t)
  }, [signature])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    let seen = ''
    try {
      seen = localStorage.getItem(DAY_KEY) ?? ''
    } catch {
      /* fine */
    }
    if (seen === today) return
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(DAY_KEY, today)
      } catch {
        /* fine */
      }
      void runRef.current({ create: false })
    }, 6000 + Math.random() * 3000)
    return () => window.clearTimeout(t)
  }, [])
  return null
}
