import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type ConfirmButton = { label: string; value: string; tone?: 'danger' | 'primary' }
export type ConfirmOptions = {
  title?: string
  message: ReactNode
  confirmLabel?: string // default "Delete"
  cancelLabel?: string // default "Cancel"
  tone?: 'danger' | 'primary' // red for deleting, coral for things like undo
  buttons?: ConfirmButton[] // several choices instead of one confirm button (e.g. "Only this day" / "All repeats")
}
type Ctx = {
  /** Shows the pop-up. true = confirmed. */
  confirm: (o: ConfirmOptions) => Promise<boolean>
  /** Same pop-up with several choices: the value of the button pressed, or null when cancelled. */
  choose: (o: ConfirmOptions) => Promise<string | null>
}
const C = createContext<Ctx | null>(null)

/** One "are you sure?" pop-up for the whole app (deleting, undoing). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ o: ConfirmOptions; done: (v: string | null) => void } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const lastFocus = useRef<Element | null>(null)

  const choose = useCallback(
    (o: ConfirmOptions) =>
      new Promise<string | null>((resolve) => {
        lastFocus.current = document.activeElement
        setLeaving(false)
        setState({ o, done: resolve })
      }),
    [],
  )
  const confirm = useCallback(async (o: ConfirmOptions) => (await choose(o)) !== null, [choose])

  function finish(v: string | null) {
    if (!state) return
    const { done } = state
    setLeaving(true)
    window.setTimeout(() => {
      setState(null)
      setLeaving(false)
      done(v)
      if (lastFocus.current instanceof HTMLElement) lastFocus.current.blur()
    }, 140)
  }

  useEffect(() => {
    if (!state) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(null)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const value = useMemo(() => ({ confirm, choose }), [confirm, choose])
  const o = state?.o
  const tone = o?.tone ?? 'danger'
  const buttons: ConfirmButton[] = o ? o.buttons ?? [{ label: o.confirmLabel ?? 'Delete', value: 'yes', tone }] : []
  return (
    <C.Provider value={value}>
      {children}
      {o && (
        <div className={'confirm-backdrop' + (leaving ? ' leaving' : '')} onClick={() => finish(null)}>
          <div className="confirm-box" role="alertdialog" aria-modal="true" aria-label={o.title ?? 'Are you sure?'} onClick={(e) => e.stopPropagation()}>
            {o.title && <h3>{o.title}</h3>}
            <p>{o.message}</p>
            <div className="confirm-btns">
              <button type="button" className="btn soft" autoFocus onClick={() => finish(null)}>
                {o.cancelLabel ?? 'Cancel'}
              </button>
              {buttons.map((b) => (
                <button key={b.value} type="button" className={'btn ' + ((b.tone ?? tone) === 'danger' ? 'danger-solid' : 'primary')} onClick={() => finish(b.value)}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </C.Provider>
  )
}

export function useConfirm(): Ctx {
  const c = useContext(C)
  if (!c) throw new Error('useConfirm needs ConfirmProvider')
  return c
}
