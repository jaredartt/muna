import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { applyTheme } from '../lib/theme'

type Member = Pick<Profile, 'id' | 'display_name' | 'avatar'>

type AuthState = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  members: Member[]
  inviteCode: string
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'display_name' | 'avatar' | 'theme_pref' | 'muna_personality'>>) => Promise<string | null>
  joinHousehold: (code: string) => Promise<string | null>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteCode, setInviteCode] = useState('')

  const loadProfile = useCallback(async (userId: string) => {
    // The profile row is created by a database trigger on first sign-in; retry briefly just in case.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (data) {
        const p = data as Profile
        setProfile(p)
        applyTheme(p.theme_pref)
        const [{ data: ms }, { data: hh }] = await Promise.all([
          supabase.from('profiles').select('id, display_name, avatar').eq('household_id', p.household_id),
          supabase.from('households').select('invite_code').eq('id', p.household_id).maybeSingle(),
        ])
        setMembers((ms ?? []) as Member[])
        setInviteCode(hh?.invite_code ?? '')
        return
      }
      await new Promise((r) => setTimeout(r, 500))
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
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
        setTimeout(() => loadProfile(s.user.id), 0)
      } else {
        setProfile(null)
        setMembers([])
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  }, [])

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

  const value = useMemo(
    () => ({ loading, session, profile, members, inviteCode, signInWithGoogle, signOut, updateProfile, joinHousehold }),
    [loading, session, profile, members, inviteCode, signInWithGoogle, signOut, updateProfile, joinHousehold],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
