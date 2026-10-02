import { IconChevronLeft } from '@tabler/icons-react'
import { navigate } from '../lib/router'
import { UPDATES } from '../lib/updates'

function niceDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Updates() {
  const days = [...new Set(UPDATES.map((u) => u.date))]
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
          <p className="update-day">{niceDate(day)}</p>
          <div className="card">
            {UPDATES.filter((u) => u.date === day).map((u) => (
              <div key={u.title} className="update-item">
                <span className={`task-icon c-${u.color}`}>
                  <u.Icon size={20} />
                </span>
                <div className="update-body">
                  <strong>{u.title}</strong>
                  <span>{u.text}</span>
                  <span className="update-date">{niceDate(u.date)}{u.time ? ` · ${u.time}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
