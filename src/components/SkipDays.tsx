import { useAuth } from '../context/AuthContext'
import { parseDateStr } from '../lib/dates'
import { toggleSkip, useSkips, type SkipArea } from '../lib/skips'

const label = (d: string) => parseDateStr(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })

/** "Skip these days": tap a day and Muna never plans anything on it (kept until you tap it again). */
export default function SkipDays({ area, days, title = 'Days to skip' }: { area: SkipArea; days: string[]; title?: string }) {
  const { session, profile } = useAuth()
  const uid = session?.user.id ?? ''
  const skipped = useSkips(area, uid)
  if (!profile || !days.length) return null
  const shown = days.slice(0, 28)
  const count = shown.filter((d) => skipped.includes(d)).length
  return (
    <div className="field">
      <span>
        {title}
        {count ? ` (${count})` : ''}
      </span>
      <div className="ml-slotline">
        {shown.map((d) => (
          <button key={d} type="button" className={'ml-toggle skip' + (skipped.includes(d) ? ' on' : '')} onClick={() => void toggleSkip(profile.household_id, uid, area, d)} aria-pressed={skipped.includes(d)}>
            {label(d)}
          </button>
        ))}
      </div>
      {days.length > shown.length && <p className="muted small">Showing the first {shown.length} days.</p>}
    </div>
  )
}
