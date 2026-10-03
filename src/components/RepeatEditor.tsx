import { useState } from 'react'
import { IconRepeat } from '@tabler/icons-react'
import { describeRepeat, type Repeat } from '../lib/recurrence'

type Props = { value: Repeat | null; onChange: (r: Repeat | null) => void; date: string }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKS: [number, string][] = [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [-1, 'Last']]
const NTHS: [number, string][] = [[1, 'first'], [2, 'second'], [3, 'third'], [4, 'fourth'], [-1, 'last']]
const UNITS = { day: 'day(s)', week: 'week(s)', month: 'month(s)', year: 'year(s)' }

function toggle(list: number[] | undefined, n: number): number[] {
  const l = list ?? []
  return l.includes(n) ? l.filter((x) => x !== n) : [...l, n]
}

function Chips({ options, selected, onToggle, wide }: { options: [number, string][]; selected: number[] | undefined; onToggle: (n: number) => void; wide?: boolean }) {
  return (
    <div className={'day-chips' + (wide ? ' wide' : '')}>
      {options.map(([n, label]) => (
        <button key={n} type="button" className={'day-chip' + (selected?.includes(n) ? ' on' : '')} aria-pressed={selected?.includes(n) ?? false} onClick={() => onToggle(n)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function RepeatEditor({ value, onChange, date }: Props) {
  const [monthMode, setMonthMode] = useState<'dates' | 'weekday'>(value?.nth ? 'weekday' : 'dates')
  const [endMode, setEndMode] = useState<'never' | 'until' | 'count'>(value?.until ? 'until' : value?.count ? 'count' : 'never')
  const [showExcept, setShowExcept] = useState(Boolean(value?.exceptWeekdays?.length || value?.exceptWeeks?.length))

  if (!date) {
    return (
      <div className="field">
        <span>Repeat</span>
        <p className="muted small">Pick a date first, then you can make it repeat.</p>
      </div>
    )
  }

  const startDay = new Date(date + 'T00:00:00')
  const startWeekday = (startDay.getDay() + 6) % 7
  const startMonthDay = startDay.getDate()
  const set = (patch: Partial<Repeat>) => value && onChange({ ...value, ...patch })

  function chooseFreq(f: string) {
    if (!f) return onChange(null)
    const freq = f as Repeat['freq']
    const next: Repeat = { freq, every: value?.every ?? 1, until: value?.until, count: value?.count, exceptDates: value?.exceptDates }
    if (freq === 'week') next.weekdays = [startWeekday]
    if (freq === 'month') {
      if (monthMode === 'weekday') next.nth = { n: (Math.min(4, Math.ceil(startMonthDay / 7)) as 1 | 2 | 3 | 4), weekday: startWeekday }
      else next.monthDays = [startMonthDay]
    }
    if (freq !== 'year') {
      next.exceptWeekdays = value?.exceptWeekdays
      next.exceptWeeks = value?.exceptWeeks
    }
    onChange(next)
  }

  function chooseMonthMode(m: 'dates' | 'weekday') {
    setMonthMode(m)
    if (!value) return
    const next: Repeat = { ...value, nth: undefined, monthDays: undefined }
    if (m === 'weekday') next.nth = { n: Math.min(4, Math.ceil(startMonthDay / 7)) as 1 | 2 | 3 | 4, weekday: startWeekday }
    else next.monthDays = [startMonthDay]
    onChange(next)
  }

  function chooseEnd(m: 'never' | 'until' | 'count') {
    setEndMode(m)
    if (m === 'never') set({ until: null, count: null })
    if (m === 'until') set({ until: value?.until ?? '', count: null })
    if (m === 'count') set({ count: value?.count ?? 10, until: null })
  }

  return (
    <div className="field repeat-box">
      <span>
        <IconRepeat size={14} className="repeat-ic" />
        Repeat
      </span>
      <select value={value?.freq ?? ''} onChange={(e) => chooseFreq(e.target.value)}>
        <option value="">Does not repeat</option>
        <option value="day">Every day</option>
        <option value="week">Every week</option>
        <option value="month">Every month</option>
        <option value="year">Every year</option>
      </select>

      {value && (
        <>
          <div className="repeat-line">
            <span>Every</span>
            <input type="number" inputMode="numeric" min={1} max={99} value={value.every} onChange={(e) => set({ every: Math.max(1, Number(e.target.value) || 1) })} />
            <span>{UNITS[value.freq]}</span>
          </div>

          {value.freq === 'week' && (
            <>
              <span className="sub">On these days</span>
              <Chips options={DAYS.map((d, i) => [i, d])} selected={value.weekdays} onToggle={(n) => set({ weekdays: toggle(value.weekdays, n) })} />
              <p className="muted small">Pick two days for &ldquo;twice a week&rdquo;, three for &ldquo;three times a week&rdquo;.</p>
            </>
          )}

          {value.freq === 'month' && (
            <>
              <div className="segmented small-seg" role="radiogroup" aria-label="Monthly pattern">
                <button type="button" role="radio" aria-checked={monthMode === 'dates'} className={monthMode === 'dates' ? 'active' : ''} onClick={() => chooseMonthMode('dates')}>
                  On dates
                </button>
                <button type="button" role="radio" aria-checked={monthMode === 'weekday'} className={monthMode === 'weekday' ? 'active' : ''} onClick={() => chooseMonthMode('weekday')}>
                  On a weekday
                </button>
              </div>
              {monthMode === 'dates' ? (
                <>
                  <Chips
                    wide
                    options={[...Array.from({ length: 31 }, (_, i): [number, string] => [i + 1, String(i + 1)]), [-1, 'Last']]}
                    selected={value.monthDays}
                    onToggle={(n) => set({ monthDays: toggle(value.monthDays, n) })}
                  />
                  <p className="muted small">Pick two dates for &ldquo;twice a month&rdquo;.</p>
                </>
              ) : (
                <div className="repeat-line">
                  <span>The</span>
                  <select value={value.nth?.n ?? 1} onChange={(e) => set({ nth: { n: Number(e.target.value) as 1 | 2 | 3 | 4 | -1, weekday: value.nth?.weekday ?? startWeekday } })}>
                    {NTHS.map(([n, l]) => (
                      <option key={n} value={n}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <select value={value.nth?.weekday ?? startWeekday} onChange={(e) => set({ nth: { n: value.nth?.n ?? 1, weekday: Number(e.target.value) } })}>
                    {DAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {value.freq !== 'year' && (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={showExcept}
                  onChange={(e) => {
                    setShowExcept(e.target.checked)
                    if (!e.target.checked) set({ exceptWeekdays: undefined, exceptWeeks: undefined })
                  }}
                />
                <span>Skip some days</span>
              </label>
              {showExcept && (
                <>
                  <span className="sub">Never on</span>
                  <Chips options={DAYS.map((d, i) => [i, d])} selected={value.exceptWeekdays} onToggle={(n) => set({ exceptWeekdays: toggle(value.exceptWeekdays, n) })} />
                  <span className="sub">Never in these weeks of the month</span>
                  <Chips options={WEEKS} selected={value.exceptWeeks} onToggle={(n) => set({ exceptWeeks: toggle(value.exceptWeeks, n) })} />
                </>
              )}
            </>
          )}

          <span className="sub">Ends</span>
          <div className="repeat-line">
            <select value={endMode} onChange={(e) => chooseEnd(e.target.value as 'never' | 'until' | 'count')}>
              <option value="never">Never</option>
              <option value="until">On a date</option>
              <option value="count">After some times</option>
            </select>
            {endMode === 'until' && <input type="date" min={date} value={value.until ?? ''} onChange={(e) => set({ until: e.target.value || null })} />}
            {endMode === 'count' && (
              <>
                <input type="number" inputMode="numeric" min={1} max={999} value={value.count ?? 10} onChange={(e) => set({ count: Math.max(1, Number(e.target.value) || 1) })} />
                <span>times</span>
              </>
            )}
          </div>

          <p className="repeat-summary">{describeRepeat(value, date)}</p>
        </>
      )}
    </div>
  )
}
