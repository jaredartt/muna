import { useEffect, useState } from 'react'
import { IconBrandGoogleFilled, IconDeviceDesktopFilled, IconMoonFilled, IconSunFilled } from '@tabler/icons-react'
import { IconCopy, IconLogout } from '@tabler/icons-react'
import Avatar from '../components/Avatar'
import IconPicker from '../components/IconPicker'
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
  const { profile, session, members, inviteCode, googleStatus, googleConnected, updateProfile, joinHousehold, connectGoogle, disconnectGoogle, signOut } = useAuth()
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('')
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [usage, setUsage] = useState<{ used: number; budget: number } | null>(null)

  useEffect(() => {
    supabase.rpc('get_ai_usage').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data
      if (row) setUsage({ used: Number(row.used), budget: Number(row.budget) })
    })
  }, [])

  useEffect(() => {
    if (profile) {
      setName(profile.display_name)
      setPersonality(profile.muna_personality)
    }
  }, [profile])

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
          Tell Muna who to be and how to help you. This only changes how Muna talks to you. For example: &ldquo;Be playful and short.
          Remind me gently about my gym days. I work evenings, so mornings are for chores.&rdquo;
        </p>
        <textarea value={personality} onChange={(e) => setPersonality(e.target.value)} rows={6} maxLength={2000} placeholder="Write anything Muna should know about you…" />
        <button className="btn soft" onClick={() => save({ muna_personality: personality.trim() }, 'Muna will remember')} disabled={personality.trim() === profile.muna_personality}>
          Save personality
        </button>
      </section>

      <section className="card">
        <h3>Muna&rsquo;s energy</h3>
        {usage ? (
          <>
            <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={usage.budget} aria-valuenow={Math.min(usage.used, usage.budget)} aria-label="Muna energy used this month">
              <i style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.budget)) * 100)}%` }} />
            </div>
            <p>
              <strong>{usage.used.toLocaleString()}</strong> <span className="muted">tokens used this month, of a limit of {usage.budget.toLocaleString()}</span>
            </p>
            <p className="muted small">The used number is counted exactly from what Gemini reports. The limit is a safety setting we chose, not a Google balance. It resets on the 1st of each month.</p>
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
