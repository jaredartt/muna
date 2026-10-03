import { IconChevronLeft } from '@tabler/icons-react'
import { navigate } from '../lib/router'
import { UPDATES } from '../lib/updates'

function niceDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

function dayLabel(ymd: string) {
  const t = new Date()
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1)
  if (ymd === iso(t)) return 'Today'
  if (ymd === iso(y)) return 'Yesterday'
  return null
}

export default function Updates() {
  // One group per day (newest day first); inside a day the newest change comes first, entries without a time go last.
  const days = [...new Set(UPDATES.map((u) => u.date))].sort().reverse()
  const itemsOf = (day: string) =>
    UPDATES.filter((u) => u.date === day).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
  return (
    <div className="page">
      <header className="page-head">
        <div className="updates-title">
          <button className="icon-btn" onClick={() => navigate('/profile')} aria-label="Back to Profile">
            <IconChevronLeft size={24} />
          </button>
          <h1>Update log</h1>
        </div>
      </header>
      {days.map((day) => (
        <section key={day} className="stack">
          <p className="update-day">
            <strong>{dayLabel(day) ?? niceDate(day)}</strong>
            {dayLabel(day) ? ` · ${niceDate(day)}` : ''}
            <span className="update-count">{itemsOf(day).length} {itemsOf(day).length === 1 ? 'change' : 'changes'}</span>
          </p>
          <div className="card">
            {itemsOf(day).map((u) => (
              <div key={u.title + (u.time ?? '')} className="update-item">
                <span className={`task-icon c-${u.color}`}>
                  <u.Icon size={20} />
                </span>
                <div className="update-body">
                  <strong>{u.title}</strong>
                  <span>{u.text}</span>
                  {u.time && <span className="update-date">{u.time}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
