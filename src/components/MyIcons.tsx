import { useRef, useState } from 'react'
import { IconTrashFilled, IconUpload } from '@tabler/icons-react'
import { AppIcon } from '../lib/icons'
import { addCustomIcon, deleteCustomIcon, useCustomIcons } from '../lib/customIcons'
import { parseSvgIcon } from '../lib/svgIcons'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from './Confirm'

const MAX_ICONS = 300

// Profile card: upload your own SVG icons. They are shared with everyone in the home, live.
export default function MyIcons({ colorClass }: { colorClass: string }) {
  const { confirm } = useConfirm()
  const { profile } = useAuth()
  const icons = useCustomIcons()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const chosen = icons.find((i) => i.id === sel)

  async function onFiles(files: FileList | null) {
    if (!files || !files.length || !profile) return
    setBusy(true)
    setMsg('')
    let ok = 0
    const problems: string[] = []
    for (const f of Array.from(files).slice(0, 50)) {
      const label = f.name.replace(/\.svg$/i, '')
      try {
        if (icons.length + ok >= MAX_ICONS) throw new Error(`You reached ${MAX_ICONS} icons.`)
        if (f.size > 400_000) throw new Error('That file is too big.')
        const data = parseSvgIcon(await f.text())
        const name = label.replace(/[_\s]+/g, '-').toLowerCase().slice(0, 60) || 'icon'
        const err = await addCustomIcon(profile.household_id, name, '', data)
        if (err) throw new Error(err)
        ok++
      } catch (e) {
        problems.push(`${label}: ${e instanceof Error ? e.message : 'could not add it.'}`)
      }
    }
    setBusy(false)
    if (input.current) input.current.value = ''
    setMsg([ok ? `Added ${ok} icon${ok === 1 ? '' : 's'}.` : '', ...problems.slice(0, 3), problems.length > 3 ? `…and ${problems.length - 3} more could not be added.` : ''].filter(Boolean).join(' '))
  }

  async function remove() {
    if (!chosen) return
    if (!(await confirm({ message: <>Remove the icon <strong>{chosen.name}</strong>?</>, confirmLabel: 'Remove' }))) return
    const ok = await deleteCustomIcon(chosen.id)
    setMsg(ok ? `Removed “${chosen.name}”.` : 'Could not remove it.')
    setSel(null)
  }

  return (
    <section className="card">
      <h3>My icons</h3>
      <p className="muted small">
        Upload your own SVG icons. Both of you can use them for tasks and profiles, and new ones appear on the other phone within a moment. The file name becomes the search word (pizza.svg is found by typing “pizza”). Every colour turns into the task colour.
      </p>
      <input ref={input} type="file" accept=".svg,image/svg+xml" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
      <button className="btn soft" onClick={() => input.current?.click()} disabled={busy}>
        <IconUpload size={18} /> {busy ? 'Adding…' : 'Upload SVG icons'}
      </button>
      {msg && <p className="notice">{msg}</p>}
      {icons.length > 0 && (
        <>
          <div className="icon-grid my-icons" role="listbox" aria-label="My icons">
            {icons.map((i) => (
              <button type="button" key={i.id} role="option" aria-selected={sel === i.id} className={`icon-choice ${colorClass}` + (sel === i.id ? ' selected' : '')} onClick={() => setSel(sel === i.id ? null : i.id)} title={i.name} aria-label={i.name}>
                <AppIcon name={'custom:' + i.id} size={22} />
              </button>
            ))}
          </div>
          {chosen ? (
            <div className="my-icon-actions">
              <span className="small">{chosen.name}</span>
              <button className="btn danger" onClick={() => void remove()}>
                <IconTrashFilled size={18} /> Remove
              </button>
            </div>
          ) : (
            <p className="muted small">{icons.length} icon{icons.length === 1 ? '' : 's'}. Tap one to remove it.</p>
          )}
        </>
      )}
    </section>
  )
}
