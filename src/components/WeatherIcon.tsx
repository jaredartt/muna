import type { Kind } from '../lib/weather'

// Small hand-drawn weather icons (no icon library needed). Colours come from the app theme.
export default function WeatherIcon({ kind, size = 28, night = false }: { kind: Kind; size?: number; night?: boolean }) {
  const sun = 'var(--yellow, #f7c948)'
  const cloud = 'var(--wx-cloud, #b9c4d6)'
  const rain = 'var(--blue, #5b9bf5)'
  const Sun = (
    <g>
      <circle cx="9" cy="9" r="4.2" fill={sun} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="9" y1="1.6" x2="9" y2="3.2" stroke={sun} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${a} 9 9)`} />
      ))}
    </g>
  )
  const Moon = <path d="M14 3.5a7 7 0 1 0 6.5 9.8A7.5 7.5 0 0 1 14 3.5z" fill={sun} />
  const Cloud = <path d="M7 19a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.2A3.4 3.4 0 0 1 17 19z" fill={cloud} />
  let body
  switch (kind) {
    case 'clear':
      body = night ? Moon : <g transform="translate(3 3) scale(1.25)">{Sun}</g>
      break
    case 'partly':
      body = (
        <g>
          <g transform="translate(-1 -1) scale(0.85)">{night ? Moon : Sun}</g>
          <g transform="translate(2.5 3) scale(0.9)">{Cloud}</g>
        </g>
      )
      break
    case 'cloud':
      body = <g transform="translate(0 1)">{Cloud}</g>
      break
    case 'fog':
      body = (
        <g stroke={cloud} strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="8" x2="20" y2="8" />
          <line x1="2.5" y1="12.5" x2="18" y2="12.5" />
          <line x1="5" y1="17" x2="21" y2="17" />
        </g>
      )
      break
    case 'drizzle':
    case 'rain':
      body = (
        <g>
          <g transform="translate(0 -2)">{Cloud}</g>
          {(kind === 'rain' ? [8, 12.5, 17] : [9, 15]).map((x) => (
            <line key={x} x1={x} y1="18.5" x2={x - 1.4} y2="22" stroke={rain} strokeWidth="1.8" strokeLinecap="round" />
          ))}
        </g>
      )
      break
    case 'snow':
      body = (
        <g>
          <g transform="translate(0 -2)">{Cloud}</g>
          {[8, 12.5, 17].map((x) => (
            <circle key={x} cx={x} cy="20.3" r="1.3" fill="#fff" stroke={cloud} strokeWidth="0.8" />
          ))}
        </g>
      )
      break
    case 'storm':
      body = (
        <g>
          <g transform="translate(0 -2)">
            <path d="M7 19a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.6 1.2A3.4 3.4 0 0 1 17 19z" fill="#8d98ad" />
          </g>
          <path d="M12.8 14l-3 4.6h2.6l-1.3 4.2 4.4-5.6h-2.7z" fill={sun} />
        </g>
      )
      break
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      {body}
    </svg>
  )
}
