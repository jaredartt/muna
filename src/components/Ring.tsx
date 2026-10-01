// Circular progress ring (like the Goals / Calories cards in the Figma design).
export default function Ring({ pct, color, value, label }: { pct: number; color: string; value: string; label: string }) {
  const r = 46
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 102 102" width="102" height="102" aria-hidden="true">
        <circle cx="51" cy="51" r={r} fill="none" stroke="var(--track)" strokeWidth="10" />
        <circle
          cx="51"
          cy="51"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(c * clamped) / 100} ${c}`}
          transform="rotate(-90 51 51)"
        />
      </svg>
      <div className="ring-text">
        <strong style={{ color }}>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}
