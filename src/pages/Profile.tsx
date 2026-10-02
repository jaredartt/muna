import { useEffect, useRef, useState } from 'react'
import { IconBrandGoogleFilled, IconDeviceDesktopFilled, IconMoonFilled, IconSunFilled } from '@tabler/icons-react'
import { IconChevronRight, IconCopy, IconLogout } from '@tabler/icons-react'
import { IconTimelineEventFilled } from '@tabler/icons-react'
import { navigate } from '../lib/router'
import Avatar from '../components/Avatar'
import IconPicker from '../components/IconPicker'
import MyIcons from '../components/MyIcons'
import { AVATAR_SUGGESTIONS, TASK_COLORS } from '../lib/icons'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ThemePref } from '../lib/types'

const THEMES: { value: ThemePref; label: string; Icon: typeof IconSunFilled }[] = [
  { value: 'light', label: 'Light', Icon: IconSunFilled },
  { value: 'dark', label: 'Dark', Icon: IconMoonFilled },
  { value: 'system', label: 'System', Icon: IconDeviceDesktopFilled },
]

export default function Profile() {
  const { profile, session, members, inviteCode, munaPersonality, saveMunaPersonality, googleStatus, googleConnected, updateProfile, joinHousehold, connectGoogle, disconnectGoogle, signOut } = useAuth()
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('')
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [usage, setUsage] = useState<{ used: number } | null>(null)

  useEffect(() => {
    supabase.rpc('get_ai_usage').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data
      if (row) setUsage({ used: Number(row.used) })
    })
  }, [])

  useEffect(() => {
    if (profile) setName(profile.display_name)
  }, [profile])

  // The personality is shared by both of you. Show the saved text, but never overwrite
  // something this person is in the middle of typing.
  const lastSaved = useRef('')
  useEffect(() => {
    // Remember the OLD saved text first. React runs the function below later, so reading lastSaved.current inside it
    // would already see the NEW text and the box would stay empty (this was the "personality disappeared" bug).
    const before = lastSaved.current
    lastSaved.current = munaPersonality
    setPersonality((draft) => (draft === before ? munaPersonality : draft))
  }, [munaPersonality])

  if (!profile) return null

  const partner = members.find((m) => m.id !== profile.id)
  const partnerConnected = partner ? Boolean(googleStatus[partner.id]) : false

  function flash(msg: string, ms = 2500) {
    setNote(msg)
    setTimeout(() => setNote(''), ms)
  }

  async function save(patch: Parameters<typeof updateProfile>[0], okMsg = 'Saved') {
    const err = await updateProfile(patch)
    flash(err ?? okMsg)
  }

  async function join() {
    const err = await joinHousehold(code.trim())
    flash(err ?? 'Joined! You now share tasks together.', 3500)
    if (!err) setCode('')
  }

  async function disconnect() {
    const err = await disconnectGoogle()
    flash(err ?? 'Google Calendar disconnected')
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Profile</h1>
      </header>

      <section className="card">
        <div className="profile-top">
          <Avatar name={profile.avatar} color={profile.avatar_color} size={72} />
          <div>
            <h3>{profile.display_name || 'You'}</h3>
            <p className="muted small">{session?.user.email}</p>
          </div>
        </div>
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <button className="btn soft" onClick={() => save({ display_name: name.trim() })} disabled={name.trim() === profile.display_name}>
          Save name
        </button>
        <div className="field">
          <span>Your colour</span>
          <div className="swatches">
            {TASK_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch c-${c}` + (profile.avatar_color === c ? ' selected' : '')}
                onClick={() => save({ avatar_color: c }, 'Colour saved')}
                aria-label={c}
                aria-pressed={profile.avatar_color === c}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <span>Your icon</span>
          <IconPicker value={profile.avatar} onChange={(a) => save({ avatar: a }, 'Icon saved')} suggestions={AVATAR_SUGGESTIONS} colorClass={`c-${profile.avatar_color}`} />
        </div>
      </section>

      <MyIcons colorClass={`c-${profile.avatar_color}`} />

      <section className="card">
        <h3>Appearance</h3>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label, Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={profile.theme_pref === value}
              className={profile.theme_pref === value ? 'active' : ''}
              onClick={() => save({ theme_pref: value }, 'Theme updated')}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Muna&rsquo;s personality</h3>
        <p className="muted small">
          Tell Muna who to be and how to help you. This is <strong>one shared text</strong>: {partner ? `${partner.display_name || 'your partner'} and you` : 'everyone in your home'} see and edit the same thing, and it changes how Muna talks to both of you. For example: &ldquo;Be playful and short. Remind us gently about gym days.&rdquo;
        </p>
        <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} rows={6} maxLength={2000} placeholder="Write anything Muna should know about both of you…" />
        <button className="btn soft" onClick={async () => flash((await saveMunaPersonality(personality)) ?? 'Saved for both of you')} disabled={personality.trim() === munaPersonality}>
          Save personality
        </button>
      </section>

      <section className="card">
        <h3>Muna&rsquo;s energy</h3>
        {usage ? (
          <>
            <p>
              <strong>{usage.used.toLocaleString()}</strong> <span className="muted">tokens used this month</span>
            </p>
            <p className="muted small">Counted exactly from what Gemini reports. There is no limit in the app: on the free plan Google only applies its own speed limits.</p>
          </>
        ) : (
          <p className="muted small">Loading…</p>
        )}
      </section>

      <section className="card">
        <h3>Google Calendar</h3>
        <p className="muted small">
          Your Google events show up in Muna&rsquo;s calendar (yours and your partner&rsquo;s), and tasks with a date are added to your Google Calendar automatically.
        </p>
        <p>
          <strong>You:</strong> <span className={googleConnected ? 'ok' : 'muted'}>{googleConnected ? 'Connected' : 'Not connected'}</span>
        </p>
        {partner && (
          <p>
            <strong>{partner.display_name || 'Partner'}:</strong> <span className={partnerConnected ? 'ok' : 'muted'}>{partnerConnected ? 'Connected' : 'Not connected yet'}</span>
          </p>
        )}
        {googleConnected ? (
          <div className="btn-row">
            <button className="btn soft" onClick={() => void connectGoogle()}>
              <IconBrandGoogleFilled size={18} /> Reconnect
            </button>
            <button className="btn ghost" onClick={() => void disconnect()}>
              Disconnect
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={() => void connectGoogle()}>
            <IconBrandGoogleFilled size={18} /> Connect Google Calendar
          </button>
        )}
        <p className="muted small">Google may say the app is &ldquo;not verified&rdquo;. That is normal for a private app: tap Advanced, then &ldquo;Go to Muna&rdquo;.</p>
      </section>

      <section className="card">
        <h3>Our home</h3>
        <p className="muted small">
          {partner ? `Sharing tasks with ${partner.display_name || 'your partner'}.` : 'Your partner joins automatically when they sign in with their invited Google account.'}
        </p>
        <div className="code-row">
          <code>{inviteCode}</code>
          <button className="icon-btn" onClick={() => navigator.clipboard?.writeText(inviteCode).then(() => flash('Code copied'))} aria-label="Copy invite code">
            <IconCopy size={20} />
          </button>
        </div>
        <label className="field">
          <span>Have a code from your partner?</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter invite code" maxLength={16} />
        </label>
        <button className="btn soft" onClick={join} disabled={!code.trim()}>
          Join their home
        </button>
      </section>

      <button className="card link-card" onClick={() => navigate('/updates')}>
        <span className="task-icon c-sky">
          <IconTimelineEventFilled size={22} />
        </span>
        <span className="link-text">
          <strong>Update log</strong>
          <small className="muted">Everything we changed in Muna</small>
        </span>
        <IconChevronRight size={20} />
      </button>

      <button className="btn ghost" onClick={signOut}>
        <IconLogout size={18} /> Sign out
      </button>

      {note && (
        <div className="toast" role="status">
          {note}
        </div>
      )}
    </div>
  )
}
