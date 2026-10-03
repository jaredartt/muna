import { useMemo, useRef, useState } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { useAnimatedClose } from '../hooks/useAnimatedClose'
import { first, missingIngredients, recipeMacros, round, SLOTS, type PantryRow, type Recipe, type Slot } from '../lib/meals'
import type { Product } from '../lib/products'
import type { Member } from '../lib/types'

type Props = {
  slot: Slot
  recipes: Recipe[]
  pantry: PantryRow[]
  products: Map<string, Product>
  members: Member[]
  current: string | null
  onPick: (recipeId: string | null) => void
  onClose: () => void
}

/** Choose the meal for one slot of a day. Shows the recipes made for that slot first. */
export default function RecipePicker({ slot, recipes, pantry, products, members, current, onPick, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { leaving, close } = useAnimatedClose(onClose)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const label = SLOTS.find((s) => s.key === slot)?.label ?? slot
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return recipes.filter((r) => (all || r.slots.includes(slot) || r.slots.length === 0) && (!t || r.name.toLowerCase().includes(t)))
  }, [recipes, q, all, slot])

  return (
    <div className={'sheet-backdrop sheet-anim' + (leaving ? ' leaving' : '')} ref={backdropRef} onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Choose ${label.toLowerCase()}`}>
        <div className="sheet-head">
          <h2>Choose {label.toLowerCase()}</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        <div className="prod-search">
          <IconSearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes" aria-label="Search recipes" />
        </div>
        <div className="ml-list">
          {shown.length === 0 && <p className="muted small">No recipe here yet. {all ? 'Add one in the Recipes tab.' : 'Try "Show all recipes".'}</p>}
          {shown.map((r) => {
            const miss = missingIngredients(r, pantry).length
            return (
              <button key={r.id} className={'ml-row' + (r.id === current ? ' on' : '')} onClick={() => onPick(r.id)}>
                <span className="ml-row-main">
                  <strong>{r.name}</strong>
                  <span className="muted small">{members.map((m) => `${first(m.display_name)} ${round(recipeMacros(r, m.id, products).kcal)} kcal`).join(' · ')}</span>
                </span>
                <span className={'ml-chip ' + (miss === 0 ? 'ok' : 'miss')}>{miss === 0 ? 'Cookable' : `${miss} missing`}</span>
              </button>
            )
          })}
        </div>
        <div className="sheet-actions">
          {current && (
            <button className="btn danger" onClick={() => onPick(null)}>
              Clear
            </button>
          )}
          <button className="btn soft grow" onClick={() => setAll(!all)}>
            {all ? `Only ${label.toLowerCase()} recipes` : 'Show all recipes'}
          </button>
        </div>
      </div>
    </div>
  )
}
