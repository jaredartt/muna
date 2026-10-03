import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { IconCheck, IconPlus } from '@tabler/icons-react'
import { AppIcon } from '../lib/icons'
import { DAY_START, HOURS_SHOWN, HOUR_H, SNAP, TOP_PAD, fmtMin, layoutLanes, yOf, type DayItem } from '../lib/dayItems'

type Props = {
  label: string // "Today · Thu 2 Oct"
  isToday: boolean
  items: DayItem[]
  onMove: (item: DayItem, startMin: number | null) => void // null = make it all-day
  onAdd: () => void
}

type Drag = { item: DayItem; x: number; y: number; zone: 'all' | 'grid'; min: number }
type Pending = { item: DayItem; x0: number; y0: number; x: number; y: number; grab: number; touch: boolean; timer: number }

const snap = (m: number) => Math.round(m / SNAP) * SNAP

/**
 * One day as a cosy column of hours. Tasks without a time sit in the all-day strip, which stays at the top while you scroll.
 * Press and hold a task (or just drag with a mouse) to move it: drop it on an hour to give it a time, or into the strip to make it all-day.
 */
export default function DayView({ label, isToday, items, onMove, onAdd }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const allRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const pending = useRef<Pending | null>(null)
  const suppressClick = useRef(false)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const [now, setNow] = useState(() => new Date())

  const allItems = useMemo(() => items.filter((i) => i.allDay), [items])
  const timed = useMemo(() => items.filter((i) => !i.allDay), [items])
  const lanes = useMemo(() => layoutLanes(timed), [timed])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Open around "now" (or 7 in the morning on other days), just under the all-day strip.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const d = new Date()
    const target = isToday ? Math.max(DAY_START / 60, d.getHours() + d.getMinutes() / 60 - 1.5) : DAY_START / 60
    const top = grid.getBoundingClientRect().top + window.scrollY + (target > DAY_START / 60 ? TOP_PAD : 0) + (target - DAY_START / 60) * HOUR_H - (stickyRef.current?.offsetHeight ?? 120) - 8
    window.scrollTo({ top: Math.max(0, top) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While something is being dragged the page must not scroll under the finger (iPhone needs a non-passive listener for this).
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault()
    }
    window.addEventListener('touchmove', block, { passive: false })
    return () => window.removeEventListener('touchmove', block)
  }, [])

  function compute(item: DayItem, x: number, y: number, grab: number): Drag {
    const allRect = allRef.current?.getBoundingClientRect()
    const gridRect = gridRef.current?.getBoundingClientRect()
    if (allRect && y <= allRect.bottom) return { item, x, y, zone: 'all', min: 0 }
    const dur = item.allDay ? 60 : Math.max(SNAP, item.end - item.start)
    const top = gridRect ? y - grab - gridRect.top - TOP_PAD : 0
    const min = Math.min(1440 - dur, Math.max(DAY_START, snap((top / HOUR_H) * 60 + DAY_START)))
    return { item, x, y, zone: 'grid', min }
  }

  function begin(p: Pending) {
    const d = compute(p.item, p.x, p.y, p.grab)
    dragRef.current = d
    setDrag(d)
    navigator.vibrate?.(8)
  }

  function cleanup() {
    const p = pending.current
    if (p) window.clearTimeout(p.timer)
    pending.current = null
    dragRef.current = null
    setDrag(null)
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    window.removeEventListener('pointercancel', handleCancel)
  }

  function handleMove(e: PointerEvent) {
    const p = pending.current
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    if (dragRef.current) {
      const d = compute(p.item, p.x, p.y, p.grab)
      dragRef.current = d
      setDrag(d)
      return
    }
    const dist = Math.hypot(p.x - p.x0, p.y - p.y0)
    if (p.touch && dist > 10) cleanup() // the finger is scrolling, not dragging
    else if (!p.touch && dist > 4) begin(p)
  }

  function handleUp() {
    const d = dragRef.current
    const p = pending.current
    if (d && p) {
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 350)
      if (d.zone === 'all') {
        if (!d.item.allDay) onMoveRef.current(d.item, null)
      } else if (d.item.allDay || d.min !== d.item.start) onMoveRef.current(d.item, d.min)
    }
    cleanup()
  }
  function handleCancel() {
    cleanup()
  }

  function onDown(e: ReactPointerEvent, item: DayItem) {
    if (!item.movable || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const touch = e.pointerType !== 'mouse'
    const p: Pending = { item, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, grab: item.allDay ? 14 : e.clientY - rect.top, touch, timer: 0 }
    pending.current = p
    if (touch) p.timer = window.setTimeout(() => pending.current === p && begin(p), 320)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
  }

  // Scroll the page by itself when a dragged task is held near the top or bottom of the screen.
  useEffect(() => {
    if (!drag) return
    let raf = 0
    const tick = () => {
      const p = pending.current
      if (p && dragRef.current) {
        const stickyBottom = stickyRef.current?.getBoundingClientRect().bottom ?? 0
        let dy = 0
        if (p.y > window.innerHeight - 150) dy = Math.min(14, (p.y - (window.innerHeight - 150)) / 6 + 3)
        else if (p.y > stickyBottom + 2 && p.y < stickyBottom + 130) dy = -Math.min(14, (130 - (p.y - stickyBottom)) / 6 + 3)
        if (dy) {
          window.scrollBy(0, dy)
          const d = compute(p.item, p.x, p.y, p.grab)
          dragRef.current = d
          setDrag(d)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  useEffect(() => () => cleanup(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (it: DayItem) => {
    if (!suppressClick.current) it.open()
  }
  const dragging = drag?.item.key
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const prevDur = drag ? (drag.item.allDay ? 60 : Math.max(SNAP, drag.item.end - drag.item.start)) : 0

  return (
    <div className="dayview">
      <div className="day-sticky" ref={stickyRef}>
        <div className={'allday' + (drag?.zone === 'all' ? ' drop' : '')} ref={allRef}>
          <div className="allday-head">
            <span className="allday-label">{label}</span>
            <button className="add-mini" onClick={onAdd} aria-label="Add a task">
              <IconPlus size={16} stroke={2.4} /> Add
            </button>
          </div>
          <div className="allday-chips">
            {allItems.length === 0 && <span className="allday-empty">{drag ? 'Drop here to make it all-day' : 'No all-day tasks. Drag a task up here to make it all-day.'}</span>}
            {allItems.map((it) => (
              <div
                key={it.key}
                className={`ad-pill c-${it.color}` + (it.done ? ' done' : '') + (dragging === it.key ? ' lifted' : '')}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onDown(e, it)}
                onClick={() => open(it)}
              >
                <AppIcon name={it.icon} size={15} />
                <span className="chip-title">{it.title}</span>
                <button className={'tick' + (it.done ? ' on' : '')} data-nodrag onClick={(e) => { e.stopPropagation(); it.toggle() }} aria-label={it.done ? 'Mark as not done' : 'Mark as done'}>
                  {it.done && <IconCheck size={12} stroke={3.2} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hours" ref={gridRef} style={{ height: HOURS_SHOWN * HOUR_H + 2 * TOP_PAD }}>
        {Array.from({ length: HOURS_SHOWN + 1 }, (_, i) => (
          <div key={i} className={'hour' + (i === HOURS_SHOWN ? ' last' : '')} style={{ top: TOP_PAD + i * HOUR_H }}>
            <span className="hour-label">{`${String((DAY_START / 60 + i) % 24).padStart(2, '0')}:00`}</span>
          </div>
        ))}
        <div className="slots" style={{ top: TOP_PAD }}>
          {timed.map((it) => {
            const l = lanes.get(it.key) ?? { lane: 0, lanes: 1 }
            const vs = Math.max(it.start, DAY_START)
            const h = Math.max(22, ((Math.max(it.end, vs + 15) - vs) / 60) * HOUR_H - 3)
            return (
              <div
                key={it.key}
                className={`blk c-${it.color}` + (it.done ? ' done' : '') + (dragging === it.key ? ' lifted' : '') + (h < 44 ? ' short' : '')}
                style={{ top: yOf(it.start, HOUR_H) + 1, height: h, left: `${(l.lane / l.lanes) * 100}%`, width: `calc(${100 / l.lanes}% - 4px)` }}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onDown(e, it)}
                onClick={() => open(it)}
              >
                <AppIcon name={it.icon} size={14} />
                <span className="blk-text">
                  <span className="blk-title">{it.title}</span>
                  {h >= 44 && <span className="blk-time">{fmtMin(it.start)}–{fmtMin(it.end)}</span>}
                </span>
                <button className={'tick' + (it.done ? ' on' : '')} data-nodrag onClick={(e) => { e.stopPropagation(); it.toggle() }} aria-label={it.done ? 'Mark as not done' : 'Mark as done'}>
                  {it.done && <IconCheck size={12} stroke={3.2} />}
                </button>
              </div>
            )
          })}
          {drag?.zone === 'grid' && (
            <div className={`blk preview c-${drag.item.color}`} style={{ top: yOf(drag.min, HOUR_H) + 1, height: Math.max(22, (prevDur / 60) * HOUR_H - 3), left: 0, right: 4 }}>
              <span className="blk-text">
                <span className="blk-title">{fmtMin(drag.min)}–{fmtMin(drag.min + prevDur)}</span>
              </span>
            </div>
          )}
        </div>
        {isToday && nowMin >= DAY_START && (
          <div className="now-line" style={{ top: TOP_PAD + yOf(nowMin, HOUR_H) }}>
            <i />
          </div>
        )}
      </div>

      {drag && (
        <div className={`drag-ghost c-${drag.item.color}`} style={{ left: drag.x, top: drag.y }}>
          <AppIcon name={drag.item.icon} size={15} /> {drag.item.title}
        </div>
      )}
    </div>
  )
}
