import { useMemo } from 'react'
import { AppIcon } from '../lib/icons'
import { DAY_START, HOURS_SHOWN, fmtMin, layoutLanes, yOf, type DayItem } from '../lib/dayItems'
import { parseDateStr } from '../lib/dates'

const WH = 40 // pixels per hour in the week view
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

type Props = {
  days: string[] // 7 dates, Monday first
  today: string
  selected: string
  itemsByDay: Map<string, DayItem[]>
  onPickDay: (d: string) => void // open that day in the day view
}

/** The whole week at a glance: all-day things in the strip at the top (it stays while you scroll), timed things as small blocks. Tap a day to open it. */
export default function WeekView({ days, today, selected, itemsByDay, onPickDay }: Props) {
  const lanes = useMemo(() => days.map((d) => layoutLanes((itemsByDay.get(d) ?? []).filter((i) => !i.allDay))), [days, itemsByDay])
  return (
    <div className="weekview">
      <div className="day-sticky">
        <div className="allday wk-head">
          <div className="wk-corner" />
          {days.map((d, i) => {
            const all = (itemsByDay.get(d) ?? []).filter((x) => x.allDay)
            return (
              <button key={d} className={'wk-dayhead' + (d === today ? ' today' : '') + (d === selected ? ' sel' : '')} onClick={() => onPickDay(d)} aria-label={parseDateStr(d).toDateString()}>
                <span className="wk-letter">{LETTERS[i]}</span>
                <span className="wk-num">{parseDateStr(d).getDate()}</span>
                <span className="wk-all">
                  {all.slice(0, 3).map((it) => (
                    <i key={it.key} className={`c-${it.color}` + (it.done ? ' done' : '')} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="wk-body" style={{ height: HOURS_SHOWN * WH + 12 }}>
        {Array.from({ length: HOURS_SHOWN + 1 }, (_, i) => (
          <div key={i} className="wk-hour" style={{ top: i * WH }}>
            <span>{i === 0 || i === HOURS_SHOWN ? '' : String((DAY_START / 60 + i) % 24).padStart(2, '0')}</span>
          </div>
        ))}
        <div className="wk-cols">
          {days.map((d, di) => (
            <div key={d} className={'wk-col' + (d === today ? ' today' : '')} onClick={() => onPickDay(d)}>
              {(itemsByDay.get(d) ?? [])
                .filter((i) => !i.allDay)
                .map((it) => {
                  const l = lanes[di].get(it.key) ?? { lane: 0, lanes: 1 }
                  const vs = Math.max(it.start, DAY_START)
                  const h = Math.max(20, ((Math.max(it.end, vs + 30) - vs) / 60) * WH - 2)
                  return (
                    <button
                      key={it.key}
                      className={`wk-blk c-${it.color}` + (it.done ? ' done' : '')}
                      style={{ top: yOf(it.start, WH) + 1, height: h, left: `${(l.lane / l.lanes) * 100}%`, width: `calc(${100 / l.lanes}% - 2px)` }}
                      onClick={(e) => {
                        e.stopPropagation()
                        it.open()
                      }}
                      aria-label={`${it.title} ${fmtMin(it.start)}`}
                    >
                      {l.lanes === 1 && h >= 30 ? <span>{it.title}</span> : <AppIcon name={it.icon} size={12} />}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
