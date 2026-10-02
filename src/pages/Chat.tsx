import { useCallback, useEffect, useRef, useState } from 'react'
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

function mmss(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function Chat() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState(() => loadDraft(session?.user.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [voiceReplies, setVoiceReplies] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const justLoaded = useRef(false) // true right after the history is fetched: jump to the end instantly, like WhatsApp
  const recRef = useRef<WavRecorder | null>(null)
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const voiceRepliesRef = useRef(false)

  useEffect(() => {
    voiceRepliesRef.current = voiceReplies
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
      })
  }, [session])

  useEffect(() => {
    const instant = justLoaded.current
    justLoaded.current = false
    // wait one frame so the messages are laid out, then show the newest one (instantly when the screen opens, smoothly afterwards)
    const id = requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'end' }))
    return () => cancelAnimationFrame(id)
  }, [messages, busy, recording])

  // leaving the screen while recording: drop the recording and release the microphone
  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      recRef.current?.cancel()
      window.speechSynthesis?.cancel()
    },
    [],
  )

  const speak = useCallback((reply: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(reply.replace(/[*_`#]/g, ''))
    u.lang = navigator.language
    window.speechSynthesis.speak(u)
  }, [])

  // iPhone only lets a page speak after a tap, so "wake up" the voice during the tap that starts the exchange.
  const unlockSpeech = useCallback(() => {
    if (voiceRepliesRef.current && 'speechSynthesis' in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
    }
  }, [])

  const finish = useCallback(
    (data: { reply: string; transcript?: string; changed?: boolean }, placeholderId?: string) => {
      setMessages((m) => {
        const next = placeholderId ? m.map((x) => (x.id === placeholderId ? { ...x, content: data.transcript || x.content } : x)) : m
        return [...next, { id: 'a-' + Date.now(), role: 'assistant', content: data.reply, created_at: new Date().toISOString() }]
      })
      if (data.changed) notifyTasksChanged()
      if (voiceRepliesRef.current) speak(data.reply)
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
            if (voiceReplies) window.speechSynthesis?.cancel()
            setVoiceReplies(!voiceReplies)
          }}
          aria-label={voiceReplies ? 'Turn off spoken replies' : 'Turn on spoken replies'}
          aria-pressed={voiceReplies}
        >
          {voiceReplies ? <IconVolume size={22} /> : <IconVolumeOff size={22} />}
        </button>
      </header>

      <div className="messages">
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
        <div ref={endRef} />
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
