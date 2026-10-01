// Muna, the mascot: a soft amber "toast" face with a little speech bubble, drawn
// to match the Figma design (file "Muna", frame "Main menu"). Replace the shapes
// here if the mascot artwork changes; keep the same props so every screen updates.
export type MunaMood = 'happy' | 'thinking' | 'sleepy' | 'listening'

export default function Muna({ size = 96, mood = 'happy', bubble = true }: { size?: number; mood?: MunaMood; bubble?: boolean }) {
  const eyes =
    mood === 'sleepy' ? (
      <g stroke="var(--muna-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M9 33 q3.8 3.4 7.6 0" />
        <path d="M39.5 33 q3.8 3.4 7.6 0" />
      </g>
    ) : (
      <g fill="var(--muna-ink)">
        <ellipse cx="12.75" cy="32.5" rx="3.75" ry={mood === 'thinking' ? 3.2 : 5} />
        <ellipse cx="43.25" cy="32.5" rx="3.75" ry={mood === 'thinking' ? 3.2 : 5} />
      </g>
    )
  const mouth =
    mood === 'listening' ? (
      <ellipse cx="28" cy="43" rx="3" ry="3.6" fill="var(--muna-ink)" />
    ) : mood === 'thinking' ? (
      <path d="M23 42 h10" stroke="var(--muna-ink)" strokeWidth="2.6" strokeLinecap="round" />
    ) : (
      <path d="M21 39.5 Q28 47.5 35 39.5" stroke="var(--muna-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    )
  return (
    <svg
      width={size}
      height={(size * 58) / (bubble ? 94 : 56)}
      viewBox={bubble ? '0 0 94 58' : '0 0 56 58'}
      role="img"
      aria-label="Muna"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {bubble && (
        <g>
          <path d="M66 28 L62 38 L74 32Z" fill="var(--muna-body)" />
          <circle cx="78" cy="19" r="14" fill="var(--muna-body)" />
          <g fill="var(--muna-ink)" opacity="0.85">
            <circle cx="72" cy="19" r="1.9" />
            <circle cx="78" cy="19" r="1.9" />
            <circle cx="84" cy="19" r="1.9" />
          </g>
        </g>
      )}
      <rect x="0" y="16" width="56" height="40" rx="14.5" fill="var(--muna-body)" />
      {eyes}
      {mouth}
    </svg>
  )
}
