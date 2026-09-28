import { createContext, useContext, useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ loading: true, authenticated: false, username: null })

  useEffect(() => {
    fetch(`${API}/api/auth/me`)
      .then(r => (r.ok ? r.json() : { authenticated: false }))
      .then(d => setAuth({ loading: false, authenticated: !!d.authenticated, username: d.username ?? null }))
      .catch(() => setAuth({ loading: false, authenticated: false, username: null }))
  }, [])

  if (auth.loading) {
    return <div className="auth-loading" aria-label="Loading"><div className="auth-spinner" /></div>
  }

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export async function signOut() {
  try {
    await fetch(`${API}/api/auth/logout`, { method: 'POST' })
  } finally {
    window.location.href = '/'
  }
}
