import { useState } from 'react'
import { LogIn } from 'lucide-react'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        window.location.href = '/'
        return
      }
      if (res.status === 429) {
        setError('Account locked. Try again in 15 minutes.')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Sign in failed.')
      }
    } catch {
      setError('Could not reach the server.')
    }
    setPassword('')
    setBusy(false)
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="logo-mark">Z</div>
        <div className="login-header-title">Zones AI Advisory</div>
      </header>

      <main className="login-main">
        <form className="login-card" onSubmit={submit}>
          <h1 className="login-title">Sign in</h1>

          <label className="login-field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              required
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="login-submit" type="submit" disabled={busy || !username || !password}>
            <LogIn size={15} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {error && <div className="login-error" role="alert">{error}</div>}
        </form>
      </main>
    </div>
  )
}
