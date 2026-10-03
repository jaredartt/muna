// Circular progress ring (like the Goals / Calories cards in the Figma design).
export default function Ring({ pct, color, value, label, labelBelow }: { pct: number; color: string; value: string; label: string; labelBelow?: boolean }) {
  const r = 46
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const ring = (
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
        {!labelBelow && <span>{label}</span>}
      </div>
    </div>
  )
  if (!labelBelow) return ring
  // the small text sits under the circle, with some room, instead of being squeezed inside it
  return (
    <div className="ring-stack">
      {ring}
      <span className="ring-below">{label}</span>
    </div>
  )
}
