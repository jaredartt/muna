import { useMemo } from 'react'
import { IconBrandGoogleFilled } from '@tabler/icons-react'
import Muna from '../components/Muna'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signInWithGoogle } = useAuth()
  // Supabase sends sign-in problems back in the URL (e.g. an account that is not on the guest list).
  const problem = useMemo(() => {
    const q = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#[^?]*\??/, ''))
    const d = q.get('error_description')
    if (!d) return ''
    return d.includes('not invited') || d.includes('Database error')
      ? 'This Google account is not on the guest list. Muna is private for now.'
      : 'Sign-in did not work. Please try again.'
  }, [])
  return (
    <main className="login">
      <div className="login-card">
        <Muna size={140} />
        <h1>Muna</h1>
        <p className="muted">Our little everything app.</p>
        <button className="btn primary big" onClick={signInWithGoogle}>
          <IconBrandGoogleFilled size={20} /> Continue with Google
        </button>
        {problem && <p className="error">{problem}</p>}
      </div>
    </main>
  )
}
