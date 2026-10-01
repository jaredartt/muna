import { useCallback, useEffect, useRef, useState } from 'react'
import { IconMicrophone, IconSend, IconVolume, IconVolumeOff } from '@tabler/icons-react'
import Muna, { type MunaMood } from '../components/Muna'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { notifyTasksChanged } from '../lib/events'
import type { ChatMessage } from '../lib/types'

// Browser speech APIs (Safari on iPhone supports both; support inside a home-screen app can vary).
type SRResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
type SRInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SRResultEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SRConstructor = new () => SRInstance

function getSpeechRecognition(): SRConstructor | null {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const SUGGESTIONS = ['What do we have planned this week?', 'Add "buy groceries" for tomorrow', 'Plan a cozy Sunday for us']

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

export default function Chat() {
  const { session } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceReplies, setVoiceReplies] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<SRInstance | null>(null)
  const voiceModeRef = useRef(false)
  const voiceRepliesRef = useRef(false)
  const busyRef = useRef(false)
  const canListen = getSpeechRecognition() !== null

  useEffect(() => {
    voiceModeRef.current = voiceMode
  }, [voiceMode])
  useEffect(() => {
    voiceRepliesRef.current = voiceReplies
  }, [voiceReplies])

  useEffect(() => {
    if (!session) return
    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setMessages(((data ?? []) as ChatMessage[]).reverse()))
  }, [session])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const stopListening = useCallback(() => {
    recRef.current?.abort()
    recRef.current = null
    setListening(false)
  }, [])

  const speak = useCallback((reply: string, then?: () => void) => {
    if (!('speechSynthesis' in window)) {
      then?.()
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(reply.replace(/[*_`#]/g, ''))
    u.lang = navigator.language
    u.onend = () => then?.()
    u.onerror = () => then?.()
    window.speechSynthesis.speak(u)
  }, [])

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR || busyRef.current) return
    const rec = new SR()
    rec.lang = navigator.language
    rec.interimResults = true
    rec.continuous = false
    let finalText = ''
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setText(t)
      if (e.results[e.results.length - 1].isFinal) finalText = t
    }
    rec.onerror = () => {
      setListening(false)
      setVoiceMode(false)
    }
    rec.onend = () => {
      setListening(false)
      recRef.current = null
      if (finalText.trim()) {
        void send(finalText, true)
      } else if (voiceModeRef.current) {
        setVoiceMode(false)
      }
    }
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function send(raw: string, fromVoice = false) {
    const content = raw.trim()
    if (!content || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setText('')
    const tempId = 'tmp-' + Date.now()
    setMessages((m) => [...m, { id: tempId, role: 'user', content, created_at: new Date().toISOString() }])
    const { data, error: err } = await supabase.functions.invoke('muna-chat', {
      body: {
        message: content,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localNow: new Date().toString(),
      },
    })
    busyRef.current = false
    setBusy(false)
    if (err || !data?.reply) {
      setError(await readFunctionError(err))
      if (voiceModeRef.current) setVoiceMode(false)
      return
    }
    setMessages((m) => [...m, { id: 'a-' + Date.now(), role: 'assistant', content: data.reply, created_at: new Date().toISOString() }])
    if (data.changed) notifyTasksChanged()
    if (voiceRepliesRef.current || fromVoice || voiceModeRef.current) {
      speak(data.reply, () => {
        if (voiceModeRef.current) startListening()
      })
    }
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      setVoiceMode(false)
      stopListening()
      window.speechSynthesis?.cancel()
    } else {
      setVoiceMode(true)
      setVoiceReplies(true)
      voiceModeRef.current = true
      startListening()
    }
  }

  const mood: MunaMood = busy ? 'thinking' : listening ? 'listening' : 'happy'

  return (
    <div className="page chat">
      <header className="chat-head">
        <Muna size={64} mood={mood} />
        <div>
          <h1>Muna</h1>
          <p className="muted small">{busy ? 'Thinking…' : listening ? 'Listening…' : 'Ask me anything, or tell me what to do.'}</p>
        </div>
        <button
          className={'icon-btn' + (voiceReplies ? ' on' : '')}
          onClick={() => {
            if (voiceReplies) window.speechSynthesis?.cancel()
            setVoiceReplies(!voiceReplies)
          }}
          aria-label={voiceReplies ? 'Turn off spoken replies' : 'Turn on spoken replies'}
        >
          {voiceReplies ? <IconVolume size={22} /> : <IconVolumeOff size={22} />}
        </button>
      </header>

      <div className="messages">
        {messages.length === 0 && !busy && (
          <div className="chat-empty">
            <p className="muted">Hi! I can add, change and complete tasks for you, and plan your days. Try:</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
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

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        {canListen && (
          <button
            type="button"
            className={'round-btn' + (voiceMode ? ' on' : '')}
            onClick={toggleVoiceMode}
            aria-label={voiceMode ? 'Stop voice mode' : 'Start voice mode'}
            aria-pressed={voiceMode}
          >
            <IconMicrophone size={22} />
          </button>
        )}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message Muna…" aria-label="Message Muna" />
        <button type="submit" className="round-btn primary" disabled={!text.trim() || busy} aria-label="Send">
          <IconSend size={20} />
        </button>
      </form>
    </div>
  )
}
