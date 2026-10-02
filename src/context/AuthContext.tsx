import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Member, Profile } from '../lib/types'
import { applyTheme } from '../lib/theme'
import { GOOGLE_CALENDAR_SCOPE } from '../lib/google'

type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'avatar' | 'avatar_color' | 'theme_pref'>>

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  members: Member[]
  inviteCode: string
  munaPersonality: string // ONE text shared by everyone in the home
  saveMunaPersonality: (text: string) => Promise<string | null>
  googleStatus: Record<string, boolean> // user id -> has connected Google Calendar
  googleReady: boolean // the first answer about who connected Google has arrived
  googleConnected: boolean // me
  anyGoogleConnected: boolean // me or my partner
  signInWithGoogle: () => Promise<void>
  connectGoogle: () => Promise<void>
  disconnectGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<string | null>
  joinHousehold: (code: string) => Promise<string | null>
}

const Ctx = createContext<AuthState | null>(null)
const CONNECTING_FLAG = 'muna-connecting-google'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [munaPersonality, setMunaPersonality] = useState('')
  const [googleStatus, setGoogleStatus] = useState<Record<string, boolean>>({})
  const [googleReady, setGoogleReady] = useState(false)

  const loadGoogleStatus = useCallback(async () => {
    const { data } = await supabase.rpc('get_google_status')
    const map: Record<string, boolean> = {}
    for (const row of (data ?? []) as { user_id: string; connected: boolean }[]) map[row.user_id] = row.connected
    setGoogleStatus(map)
    setGoogleReady(true)
  }, [])

  const loadProfile = useCallback(
    async (userId: string) => {
      // The profile row is created by a database trigger on first sign-in; retry briefly just in case.
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        if (data) {
          const p = data as Profile
          setProfile(p)
          applyTheme(p.theme_pref)
          const [{ data: ms }, { data: hh }] = await Promise.all([
            supabase.from('profiles').select('id, display_name, avatar, avatar_color').eq('household_id', p.household_id),
            supabase.from('households').select('invite_code, muna_personality').eq('id', p.household_id).maybeSingle(),
          ])
          // Only replace what we show when the answer really arrived. On iPhones the network is often not ready
          // for a moment after the app wakes up; an empty answer must never wipe the text on screen.
          if (ms) setMembers(ms as Member[])
          if (hh) {
            setInviteCode(hh.invite_code ?? '')
            if (typeof hh.muna_personality === 'string') setMunaPersonality(hh.muna_personality)
          }
          void loadGoogleStatus()
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }
    },
    [loadGoogleStatus],
  )

  // Right after the person grants Calendar access, Google hands us a long-lived "refresh token" exactly once.
  // We pass it to the server (which keeps it private) so Muna can reach the calendar later.
  const captureGoogleToken = useCallback(
    async (s: Session | null) => {
      let flagged = false
      try {
        flagged = sessionStorage.getItem(CONNECTING_FLAG) === '1'
      } catch {
        /* ignore */
      }
      if (!flagged || !s?.provider_refresh_token) return
      const { error } = await supabase.rpc('save_google_connection', { p_refresh_token: s.provider_refresh_token })
      if (!error) {
        try {
          sessionStorage.removeItem(CONNECTING_FLAG)
        } catch {
          /* ignore */
        }
        await loadGoogleStatus()
      }
    },
    [loadGoogleStatus],
  )

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        await loadProfile(data.session.user.id)
        await captureGoogleToken(data.session)
      }
      if (active) setLoading(false)
      // Clean the ?code=... left over from the Google redirect.
      if (window.location.search.includes('code=')) {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) {
        // Don't await inside the callback (Supabase recommends deferring).
        setTimeout(() => {
          void loadProfile(s.user.id)
          void captureGoogleToken(s)
        }, 0)
      } else {
        setProfile(null)
        setMembers([])
        setMunaPersonality('')
        setGoogleStatus({})
        setGoogleReady(false)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile, captureGoogleToken])

  // Muna's personality is shared: when your partner saves it, this phone updates too.
  const householdId = profile?.household_id
  useEffect(() => {
    if (!householdId) return
    const refresh = async () => {
      const { data } = await supabase.from('households').select('muna_personality').eq('id', householdId).maybeSingle()
      if (data && typeof data.muna_personality === 'string') setMunaPersonality(data.muna_personality)
    }
    const channel = supabase
      .channel('household-' + householdId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, (payload) => {
        const v = (payload.new as { muna_personality?: unknown }).muna_personality
        if (typeof v === 'string') setMunaPersonality(v)
      })
      .subscribe()
    // Backup for iPhones that pause the live connection while the app is in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [householdId])

  const saveMunaPersonality = useCallback(async (text: string) => {
    const clean = text.trim().slice(0, 2000)
    const { error } = await supabase.rpc('set_household_personality', { p_text: clean })
    if (error) return error.message
    setMunaPersonality(clean)
    return null
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  }, [])

  const connectGoogle = useCallback(async () => {
    try {
      sessionStorage.setItem(CONNECTING_FLAG, '1')
    } catch {
      /* ignore */
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: GOOGLE_CALENDAR_SCOPE,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }, [])

  const disconnectGoogle = useCallback(async () => {
    const { error } = await supabase.rpc('disconnect_google')
    await loadGoogleStatus()
    return error?.message ?? null
  }, [loadGoogleStatus])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const updateProfile: AuthState['updateProfile'] = useCallback(
    async (patch) => {
      if (!session) return 'Not signed in'
      const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id)
      if (error) return error.message
      if (patch.theme_pref) applyTheme(patch.theme_pref)
      await loadProfile(session.user.id)
      return null
    },
    [session, loadProfile],
  )

  const joinHousehold: AuthState['joinHousehold'] = useCallback(
    async (code) => {
      if (!session) return 'Not signed in'
      const { error } = await supabase.rpc('join_household', { code })
      if (error) return error.message.includes('invalid') ? 'That code does not match any home.' : error.message
      await loadProfile(session.user.id)
      return null
    },
    [session, loadProfile],
  )

  const googleConnected = Boolean(session && googleStatus[session.user.id])
  const anyGoogleConnected = Object.values(googleStatus).some(Boolean)

  const value = useMemo(
    () => ({
      loading,
      session,
      profile,
      members,
      munaPersonality,
      saveMunaPersonality,
      inviteCode,
      googleStatus,
      googleReady,
      googleConnected,
      anyGoogleConnected,
      signInWithGoogle,
      connectGoogle,
      disconnectGoogle,
      signOut,
      updateProfile,
      joinHousehold,
    }),
    [loading, session, profile, members, inviteCode, munaPersonality, saveMunaPersonality, googleStatus, googleReady, googleConnected, anyGoogleConnected, signInWithGoogle, connectGoogle, disconnectGoogle, signOut, updateProfile, joinHousehold],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
