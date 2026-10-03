export type ChartPoint = { label: string; value: number }

/** A small line chart (no library): points joined by a line, first and last label under it, the lowest and highest value on the side. */
export default function LineChart({ points, unit = '', color = 'var(--green)', height = 150 }: { points: ChartPoint[]; unit?: string; color?: string; height?: number }) {
  const W = 320
  const padL = 40
  const padR = 10
  const padT = 12
  const padB = 24
  if (points.length === 0) return null
  const vals = points.map((p) => p.value)
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  if (hi - lo < 1e-6) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.15
  lo -= pad
  hi += pad
  const x = (i: number) => (points.length === 1 ? (padL + W - padR) / 2 : padL + (i / (points.length - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (height - padT - padB)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${height - padB} L${x(0).toFixed(1)} ${height - padB} Z`
  const fmt = (v: number) => `${Math.round(v * 10) / 10}${unit}`
  const real = (v: number) => v
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Progress chart" className="line-chart">
      <line x1={padL} y1={y(real(hi - pad))} x2={W - padR} y2={y(real(hi - pad))} stroke="var(--line)" strokeWidth="1" />
      <line x1={padL} y1={y(real(lo + pad))} x2={W - padR} y2={y(real(lo + pad))} stroke="var(--line)" strokeWidth="1" />
      <text x={padL - 6} y={y(hi - pad) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{fmt(hi - pad)}</text>
      <text x={padL - 6} y={y(lo + pad) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{fmt(lo + pad)}</text>
      {points.length > 1 && <path d={area} fill={color} opacity="0.14" />}
      {points.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 3} fill={color} stroke="var(--card)" strokeWidth="1.5" />
      ))}
      <text x={x(0)} y={height - 6} textAnchor={points.length === 1 ? 'middle' : 'start'} fontSize="10" fill="var(--muted)">{points[0].label}</text>
      {points.length > 1 && <text x={x(points.length - 1)} y={height - 6} textAnchor="end" fontSize="10" fill="var(--muted)">{points[points.length - 1].label}</text>}
    </svg>
  )
}
