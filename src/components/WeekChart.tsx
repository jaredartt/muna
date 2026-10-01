// Smooth area chart of tasks per weekday (like the Sleep card in the Figma design).
export default function WeekChart({ counts }: { counts: number[] }) {
  const W = 129
  const H = 50
  const max = Math.max(1, ...counts)
  const pts = counts.map((n, i) => ({ x: (i / 6) * W, y: H - 6 - (n / max) * (H - 18) }))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const mx = (p0.x + p1.x) / 2
    d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true" className="week-chart">
      <defs>
        <linearGradient id="weekfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--orange)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--orange)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill="url(#weekfill)" />
      <path d={d} fill="none" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
