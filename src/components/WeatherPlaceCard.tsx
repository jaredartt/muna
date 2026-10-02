import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_PLACE, searchPlaces, type Place } from '../lib/weather'

/** Profile card: the city used for the weather (shared by both of you). */
export default function WeatherPlaceCard() {
  const { weatherPlace, saveWeatherPlace } = useAuth()
  const place = weatherPlace ?? DEFAULT_PLACE
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function search() {
    setNote('')
    setBusy(true)
    const r = await searchPlaces(q)
    setBusy(false)
    setResults(r)
    if (!r.length) setNote('I could not find that place. Try the city name only.')
  }

  async function pick(p: Place) {
    setBusy(true)
    const err = await saveWeatherPlace(p)
    setBusy(false)
    setNote(err ?? `Saved: ${p.name}. You both get the weather of this place.`)
    if (!err) {
      setResults(null)
      setQ('')
    }
  }

  return (
    <section className="card">
      <h3>Weather city</h3>
      <p className="muted small">
        Muna uses this city for the weather on Home and to warn you about outdoor plans. Now: <strong>{place.name}{place.country ? `, ${place.country}` : ''}</strong>
        {!weatherPlace && ' (default, change it if you live somewhere else)'}.
      </p>
      <div className="wx-search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder="Type a city…"
          maxLength={60}
          aria-label="City name"
        />
        <button className="btn soft" onClick={() => void search()} disabled={busy || q.trim().length < 2}>
          {busy ? '…' : 'Search'}
        </button>
      </div>
      {results?.map((r) => (
        <button key={`${r.lat},${r.lon}`} className="wx-result" onClick={() => void pick(r)} disabled={busy}>
          {r.name}
          {r.country ? <small className="muted">, {r.country}</small> : null}
        </button>
      ))}
      {note && <p className="muted small">{note}</p>}
    </section>
  )
}
