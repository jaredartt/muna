import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconBrandGoogle, IconCopy, IconDeviceDesktop, IconLogout, IconMoon, IconSun } from '@tabler/icons-react'
import Avatar from '../components/Avatar'
import { AVATARS } from '../lib/icons'
import { useAuth } from '../context/AuthContext'
import type { ThemePref } from '../lib/types'

const THEMES: { value: ThemePref; label: string; Icon: typeof IconSun }[] = [
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'dark', label: 'Dark', Icon: IconMoon },
  { value: 'system', label: 'System', Icon: IconDeviceDesktop },
]

export default function Profile() {
  const { profile, session, members, inviteCode, updateProfile, joinHousehold, signOut } = useAuth()
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

  async function save(patch: Parameters<typeof updateProfile>[0], okMsg = 'Saved') {
    const err = await updateProfile(patch)
    setNote(err ?? okMsg)
    setTimeout(() => setNote(''), 2500)
  }

  async function join() {
    const err = await joinHousehold(code.trim())
    setNote(err ?? 'Joined! You now share tasks together.')
    if (!err) setCode('')
    setTimeout(() => setNote(''), 3500)
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Profile</h1>
      </header>

      <section className="card">
        <div className="profile-top">
          <Avatar name={profile.avatar} size={72} />
          <div>
            <h3>{profile.display_name || 'You'}</h3>
            <p className="muted small">{session?.user.email}</p>
          </div>
        </div>
        <div className="avatar-grid">
          {Object.keys(AVATARS).map((a) => (
            <button key={a} className={'avatar-choice' + (profile.avatar === a ? ' selected' : '')} onClick={() => save({ avatar: a })} aria-label={a}>
              <Avatar name={a} size={44} />
            </button>
          ))}
        </div>
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <button className="btn soft" onClick={() => save({ display_name: name.trim() })} disabled={name.trim() === profile.display_name}>
          Save name
        </button>
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
              <strong>{Math.max(0, usage.budget - usage.used).toLocaleString()}</strong> <span className="muted">of {usage.budget.toLocaleString()} tokens left this month</span>
            </p>
            <p className="muted small">Every chat with Muna uses a few tokens. Your allowance refills on the 1st of each month.</p>
          </>
        ) : (
          <p className="muted small">Loading…</p>
        )}
      </section>

      <section className="card">
        <h3>Our home</h3>
        <p className="muted small">
          {partner ? `Sharing tasks with ${partner.display_name || 'your partner'}.` : 'Your partner joins by entering your invite code (Profile → Our home) after signing in with Google.'}
        </p>
        <div className="code-row">
          <code>{inviteCode}</code>
          <button className="icon-btn" onClick={() => navigator.clipboard?.writeText(inviteCode).then(() => setNote('Code copied'))} aria-label="Copy invite code">
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

      <section className="card">
        <h3>Google Calendar</h3>
        <p className="muted small">Syncing with Google Calendar is coming soon.</p>
        <button className="btn soft" disabled>
          <IconBrandGoogle size={18} /> Connect (soon)
        </button>
      </section>

      <button className="btn ghost" onClick={signOut}>
        <IconLogout size={18} /> Sign out
      </button>

      {note && <div className="toast" role="status">{note}</div>}
    </div>
  )
}
