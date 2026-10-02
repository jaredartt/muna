import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconMicrophoneFilled } from '@tabler/icons-react'
import { IconSend, IconVolume, IconVolumeOff, IconX } from '@tabler/icons-react'
import Muna, { type MunaMood } from '../components/Muna'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { loadDraft, saveDraft } from '../lib/draft'
import { notifyTasksChanged } from '../lib/events'
import { WavRecorder } from '../lib/recorder'
import type { ChatMessage } from '../lib/types'

const SUGGESTIONS = ['What do we have planned this week?', 'Add "buy groceries" for tomorrow', 'Plan a cozy Sunday for us']
const MAX_RECORD_SECONDS = 60
// A silent half-moment of sound: playing it during a tap "unlocks" the audio player, so Muna may speak later without a tap (iPhone rule).
const SILENT_WAV = 'data:audio/wav;base64,UklGRkwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const VOICE_KEY = 'muna.voiceReplies.v1'
// Spoken replies are ON unless you turned them off once (that choice is remembered on this phone).
function loadVoicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== '0'
  } catch {
    return true
  }
}

/** Plain speech text cut into pieces: a short first one (starts fast) and then bigger ones, about 650 characters in all. */
function voiceChunks(reply: string): string[] {
  const plain = reply
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>~]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = plain.match(/[^.!?…]+[.!?…]*\s*/g)?.map((x) => x.trim()).filter(Boolean) ?? []
  const out: string[] = []
  let cur = ''
  let total = 0
  for (const sentence of sentences) {
    if (total + sentence.length > 650) break
    const limit = out.length === 0 ? 110 : 260
    if (cur && cur.length + 1 + sentence.length > limit) {
      out.push(cur)
      cur = sentence
    } else cur = cur ? cur + ' ' + sentence : sentence
    total += sentence.length
    if (out.length === 0 && cur.length >= 60) {
      out.push(cur)
      cur = ''
    }
  }
  if (cur) out.push(cur)
  return out.slice(0, 5)
}

async function readFunctionError(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
    } catch {
      /* fall through */
    }
  }
  return 'Muna could not answer right now. Please try again in a moment.'
}

// Remember the conversation while the app is open, so coming back to this tab shows it instantly (no empty flash).
let historyCache: { uid: string; messages: ChatMessage[] } | null = null

function mmss(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function Chat() {
  const { session } = useAuth()
  const cached = historyCache && historyCache.uid === session?.user.id ? historyCache.messages : null
  const [messages, setMessages] = useState<ChatMessage[]>(cached ?? [])
  const [loaded, setLoaded] = useState(Boolean(cached))
  const [text, setText] = useState(() => loadDraft(session?.user.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [voiceReplies, setVoiceReplies] = useState(loadVoicePref)
  const justLoaded = useRef(Boolean(cached)) // true right after the history is fetched: jump to the end instantly, like WhatsApp
  const recRef = useRef<WavRecorder | null>(null)
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const voiceRepliesRef = useRef(voiceReplies)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speakId = useRef(0) // a newer reply cancels a slower older one
  const voiceCache = useRef(new Map<string, Promise<string | null>>()) // speech already made, so listening again is instant
  const [playing, setPlaying] = useState<string | null>(null) // id of the message being read aloud

  useEffect(() => {
    voiceRepliesRef.current = voiceReplies
    try {
      localStorage.setItem(VOICE_KEY, voiceReplies ? '1' : '0')
    } catch {
      /* private mode: fine, it just will not be remembered */
    }
  }, [voiceReplies])

  // Keep the unsent message when you switch tabs or close the app (stored on this phone only).
  useEffect(() => {
    saveDraft(session?.user.id, text)
  }, [text, session])

  useEffect(() => {
    if (!session) return
    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        justLoaded.current = true
        setMessages(((data ?? []) as ChatMessage[]).reverse())
        setLoaded(true)
      })
  }, [session])

  useEffect(() => {
    if (loaded && session) historyCache = { uid: session.user.id, messages }
  }, [loaded, messages, session])

  // useLayoutEffect = runs before the screen is painted, so you never see the chat at the top first
  useLayoutEffect(() => {
    const instant = justLoaded.current
    justLoaded.current = false
    const toBottom = (smooth: boolean) => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    if (!instant) {
      const id = requestAnimationFrame(() => toBottom(true))
      return () => cancelAnimationFrame(id)
    }
    // Screen just opened: jump to the newest message at once. iPhones finish laying the page out a moment later, so repeat a few times.
    toBottom(false)
    const ids = [60, 200, 500].map((ms) => window.setTimeout(() => toBottom(false), ms))
    const raf = requestAnimationFrame(() => toBottom(false))
    return () => {
      cancelAnimationFrame(raf)
      ids.forEach((t) => window.clearTimeout(t))
    }
  }, [messages, busy, recording, loaded])

  // leaving the screen while recording: drop the recording and release the microphone
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      recRef.current?.cancel()
      window.speechSynthesis?.cancel()
      audioRef.current?.pause()
    },
    [],
  )

  const stopVoice = useCallback(() => {
    speakId.current++
    setPlaying(null)
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
  }, [])

  // Muna's voice comes from Google's Gemini text-to-speech (edge function muna-voice). To start fast, the reply is cut into
  // short pieces that are all requested at the same time; the first (short) one is ready after a moment and starts playing
  // while the others are still being made. If that fails, use the phone's own voice.
  const speak = useCallback(async (reply: string, opts: { force?: boolean; id?: string } = {}) => {
    const my = ++speakId.current
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    const pieces = voiceChunks(reply)
    if (!pieces.length) {
      setPlaying(null)
      return
    }
    setPlaying(opts.id ?? null)
    const cache = voiceCache.current
    const jobs = pieces.map((t) => {
      let job = cache.get(t)
      if (!job) {
        job = supabase.functions
          .invoke('muna-voice', { body: { text: t } })
          .then(({ data, error: err }) => (!err && data?.audio ? `data:${data.mime || 'audio/wav'};base64,${data.audio}` : null))
          .catch(() => null)
        cache.set(t, job)
        void job.then((v) => {
          if (!v) cache.delete(t) // a failed piece is tried again next time
        })
        if (cache.size > 24) cache.delete(cache.keys().next().value as string)
      }
      return job
    })
    const alive = () => my === speakId.current && (opts.force || voiceRepliesRef.current)
    const done = () => {
      if (my === speakId.current) setPlaying(null)
    }
    for (let i = 0; i < jobs.length; i++) {
      const src = await jobs[i]
      if (!alive()) return
      if (!src) {
        // this piece (and the rest) with the phone's voice
        if (!('speechSynthesis' in window)) return done()
        const u = new SpeechSynthesisUtterance(pieces.slice(i).join(' '))
        u.lang = navigator.language
        u.onend = done
        u.onerror = done
        window.speechSynthesis.speak(u)
        return
      }
      const a = audioRef.current ?? (audioRef.current = new Audio())
      try {
        await new Promise<void>((resolve, reject) => {
          a.onended = () => resolve()
          a.onerror = () => reject(new Error('audio'))
          a.src = src
          a.play().catch(reject)
        })
      } catch {
        return done()
      } finally {
        a.onended = null
        a.onerror = null
      }
    }
    done()
  }, [])

  // The "Listen" button under each of Muna's messages: reads it again (also when spoken replies are off). Tap again to stop.
  function replay(m: ChatMessage) {
    if (playing === m.id) {
      stopVoice()
      return
    }
    unlockSpeech(true) // this tap wakes up the audio player (iPhone)
    void speak(m.content, { force: true, id: m.id })
  }

  // iPhone only lets a page play sound after a tap, so "wake up" the audio player and the phone voice during the tap that starts the exchange.
  const unlockSpeech = useCallback((force = false) => {
    if (!force && !voiceRepliesRef.current) return
    const a = audioRef.current ?? (audioRef.current = new Audio())
    a.src = SILENT_WAV
    void a.play().catch(() => {})
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  }, [])

  const finish = useCallback(
    (data: { reply: string; transcript?: string; changed?: boolean }, placeholderId?: string) => {
      const stamp = Date.now()
      setMessages((m) => {
        const next = placeholderId ? m.map((x) => (x.id === placeholderId ? { ...x, content: data.transcript || x.content } : x)) : m
        return [...next, { id: 'a-' + stamp, role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]
      })
      if (data.changed) notifyTasksChanged()
      if (voiceRepliesRef.current) void speak(data.reply, { id: 'a-' + stamp })
    },
    [speak],
  )

  async function ask(body: Record<string, unknown>, bubbleText: string, restoreText?: string) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    const tempId = 'tmp-' + Date.now()
    setMessages((m) => [...m, { id: tempId, role: 'user', content: bubbleText, created_at: new Date().toISOString() }])
    const { data, error: err } = await supabase.functions.invoke('muna-chat', {
      body: { ...body, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    })
    busyRef.current = false
    setBusy(false)
    if (err || !data?.reply) {
      setMessages((m) => m.filter((x) => x.id !== tempId))
      if (restoreText) setText((t) => t || restoreText) // do not lose what you typed if sending failed
      setError(await readFunctionError(err))
      return
    }
    finish(data, tempId)
  }

  function sendText(raw: string) {
    const content = raw.trim()
    if (!content) return
    unlockSpeech()
    setText('')
    void ask({ message: content }, content, content)
  }

  async function startRecording() {
    if (busyRef.current || recording) return
    setError('')
    unlockSpeech()
    const rec = new WavRecorder()
    try {
      await rec.start()
    } catch {
      rec.cancel()
      setError('I could not use the microphone. On iPhone, check Settings → Safari (or Muna) → Microphone, and allow it.')
      return
    }
    recRef.current = rec
    setRecording(true)
    setSeconds(0)
    timerRef.current = window.setInterval(() => {
      const s = recRef.current?.seconds ?? 0
      setSeconds(s)
      if (s >= MAX_RECORD_SECONDS) void stopAndSend()
    }, 250)
  }

  function cancelRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    recRef.current?.cancel()
    recRef.current = null
    setRecording(false)
  }

  async function stopAndSend() {
    const rec = recRef.current
    if (!rec) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    recRef.current = null
    setRecording(false)
    const clip = await rec.stop()
    if (clip.seconds < 0.8) {
      setError('That was very short. Hold on a little longer while you talk.')
      return
    }
    void ask({ audio: { base64: clip.base64, mime: clip.mime } }, 'Voice message…')
  }

  const mood: MunaMood = busy ? 'thinking' : recording ? 'listening' : 'happy'

  return (
    <div className="page chat">
      <header className="chat-head">
        <Muna size={64} mood={mood} />
        <div>
          <h1>Muna</h1>
          <p className="muted small">{busy ? 'Thinking…' : recording ? 'Listening… tap send when you are done' : 'Ask me anything, or tell me what to do.'}</p>
        </div>
        <button
          className={'icon-btn' + (voiceReplies ? ' on' : '')}
          onClick={() => {
            if (voiceReplies) stopVoice()
            else {
              voiceRepliesRef.current = true // this tap also wakes up the audio player (iPhone)
              unlockSpeech()
            }
            setVoiceReplies(!voiceReplies)
          }}
          aria-label={voiceReplies ? 'Turn off spoken replies' : 'Turn on spoken replies'}
          aria-pressed={voiceReplies}
        >
          {voiceReplies ? <IconVolume size={22} /> : <IconVolumeOff size={22} />}
        </button>
      </header>

      <div className={'messages' + (loaded ? '' : ' hidden')}>
        {messages.length === 0 && !busy && (
          <div className="chat-empty">
            <p className="muted">Hi! I can add, change and complete tasks for you, and plan your days. Type, or tap the microphone to send me a voice note. Try:</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => sendText(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={'bubble ' + m.role}>
            {m.content}
            {m.role === 'assistant' && m.content.trim() && (
              <button type="button" className={'listen-btn' + (playing === m.id ? ' on' : '')} onClick={() => replay(m)} aria-label={playing === m.id ? 'Stop listening' : 'Listen to this message'}>
                {playing === m.id ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" />
                  </svg>
                ) : (
                  <IconVolume size={20} />
                )}
                <span>{playing === m.id ? 'Stop' : 'Listen'}</span>
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant typing" aria-label="Muna is typing">
            <i />
            <i />
            <i />
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      {recording ? (
        <div className="composer recording">
          <button type="button" className="round-btn" onClick={cancelRecording} aria-label="Cancel recording">
            <IconX size={22} />
          </button>
          <div className="rec-info" role="status">
            <i className="rec-dot" />
            <span>{mmss(seconds)}</span>
            <span className="muted small">Recording…</span>
          </div>
          <button type="button" className="round-btn primary" onClick={() => void stopAndSend()} aria-label="Send voice message">
            <IconSend size={20} />
          </button>
        </div>
      ) : (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            sendText(text)
          }}
        >
          <button type="button" className="round-btn" onClick={() => void startRecording()} disabled={busy} aria-label="Record a voice message">
            <IconMicrophoneFilled size={22} />
          </button>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message Muna…" aria-label="Message Muna" />
          <button type="submit" className="round-btn primary" disabled={!text.trim() || busy} aria-label="Send">
            <IconSend size={20} />
          </button>
        </form>
      )}
    </div>
  )
}
