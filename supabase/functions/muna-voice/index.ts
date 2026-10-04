// Muna's voice: turns a reply into speech with Google's Gemini text-to-speech (same GEMINI_API_KEY as muna-chat, free tier).
// The app plays the returned WAV. If this fails, the app falls back to the phone's own (robotic) voice.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
// Tried in this order until one works. Change with the secrets GEMINI_TTS_MODEL / GEMINI_TTS_VOICE (voices: Leda, Kore, Achernar, Zephyr, Puck ...).
const MODELS = [Deno.env.get('GEMINI_TTS_MODEL') ?? 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview']
const VOICE = Deno.env.get('GEMINI_TTS_VOICE') ?? 'Leda'
const STYLE = 'warm, gentle and cozy, like a kind little friend, natural pace'
// When Muna speaks Spanish she sounds like she is from Andalusia (southern Spain), not Latin American. English stays as it was.
const STYLE_ES = STYLE + '. Speak Spanish with a warm Andalusian accent from Seville, southern Spain: relaxed, melodic and soft, clearly Peninsular Spanish and NOT Latin American'
const SPANISH_WORDS = /\b(el|la|los|las|que|qué|de|y|un|una|para|con|te|me|se|es|en|por|está|estás|hola|gracias|vale|bien|muy|pero|como|cómo|tu|tus|mi|mis|ya|no|sí|hoy|mañana)\b/gi
/** Is this text Spanish? (accents and ¿¡ are a giveaway, otherwise many common Spanish words) */
export function looksSpanish(t: string): boolean {
  if (/[¿¡ñáéíóú]/i.test(t)) return true
  const words = t.split(/\s+/).length
  return (t.match(SPANISH_WORDS)?.length ?? 0) >= Math.max(3, words * 0.3)
}
const MAX_CHARS = 700
// Each model has its OWN free daily limit (about 10 requests a day). When one says "limit reached" (429) it is skipped for a while,
// so the next model can keep Muna's real voice going instead of the phone's robotic one.
const COOL_OFF_MS = 30 * 60 * 1000
const coolOff = new Map<string, number>()

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Plain sentences only: no markdown, links or emoji, and not longer than MAX_CHARS (cut at the end of a sentence). */
function clean(raw: string): string {
  let t = raw
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>~]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length > MAX_CHARS) {
    const cut = t.slice(0, MAX_CHARS)
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
    t = end > 200 ? cut.slice(0, end + 1) : cut
  }
  return t
}

// Finds the first base64 audio block anywhere in the answer, whatever the exact nesting.
function findAudio(node: unknown): { data: string; mime?: string } | null {
  if (!node || typeof node !== 'object') return null
  const o = node as Record<string, unknown>
  if (o.type === 'audio' && typeof o.data === 'string') return { data: o.data, mime: typeof o.mime_type === 'string' ? o.mime_type : undefined }
  const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined
  if (inline && typeof inline.data === 'string') return { data: inline.data, mime: (inline.mimeType ?? inline.mime_type) as string | undefined }
  let found: { data: string; mime?: string } | null = null
  for (const v of Array.isArray(node) ? node : Object.values(o)) {
    const f = findAudio(v)
    if (f) found = f // keep the LAST one
  }
  return found
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
/** Raw 24 kHz 16-bit mono PCM -> a WAV file the phone can play. */
function wrapWav(pcm: Uint8Array): Uint8Array {
  const h = new DataView(new ArrayBuffer(44))
  const w = (o: number, s: string) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ')
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true)
  h.setUint32(24, 24000, true); h.setUint32(28, 48000, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true)
  w(36, 'data'); h.setUint32(40, pcm.length, true)
  const out = new Uint8Array(44 + pcm.length)
  out.set(new Uint8Array(h.buffer), 0)
  out.set(pcm, 44)
  return out
}

async function tts(model: string, text: string, withMime: boolean): Promise<{ ok: true; data: string } | { ok: false; status: number; body: string }> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      model,
      input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: looksSpanish(text) ? STYLE_ES : STYLE }] }] }],
      response_format: withMime ? { type: 'audio', mime_type: 'audio/wav' } : { type: 'audio' },
      generation_config: { speech_config: [{ voice: VOICE }] },
    }),
  })
  const body = await res.text()
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 400) }
  try {
    const found = findAudio(JSON.parse(body))
    if (found) return { ok: true, data: found.data }
  } catch {
    /* fall through */
  }
  return { ok: false, status: 502, body: 'no audio in the answer: ' + body.slice(0, 300) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!KEY) return json({ error: 'No Gemini key' }, 500)

  const authHeader = req.headers.get('Authorization') ?? ''
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
  const { data: u, error: uerr } = await db.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
  if (uerr || !u.user) return json({ error: 'Please sign in again.' }, 401)

  let body: { text?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const text = typeof body.text === 'string' ? clean(body.text) : ''
  if (!text) return json({ error: 'Nothing to say' }, 400)

  let last = ''
  let limited = false
  for (const model of MODELS) {
    if ((coolOff.get(model) ?? 0) > Date.now()) {
      limited = true
      continue
    }
    for (const withMime of [true, false]) {
      const r = await tts(model, text, withMime)
      if (r.ok) {
        let bytes = b64ToBytes(r.data)
        const isWav = bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
        if (!isWav) bytes = wrapWav(bytes)
        return json({ audio: bytesToB64(bytes), mime: 'audio/wav', model })
      }
      last = `${model} ${r.status} ${r.body}`
      console.error('tts failed', last)
      if (r.status === 429) {
        limited = true
        coolOff.set(model, Date.now() + COOL_OFF_MS)
        break // this model is out for today: try the next one
      }
      if (r.status !== 400) break // a 400 may just be the mime_type field: try once without it; anything else: next model
    }
  }
  if (limited) return json({ error: 'Muna is resting her voice for a moment.' }, 429)
  return json({ error: 'Muna could not speak right now.' }, 502)
})
