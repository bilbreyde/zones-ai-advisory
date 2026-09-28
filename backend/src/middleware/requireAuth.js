import { SESSION_COOKIE, parseCookies } from '../lib/auth.js'
import { getSession } from '../lib/sessions.js'

// Every /api route mounted after this requires a valid advisory_session cookie.
export default async function requireAuth(req, res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    const session = token ? await getSession(token) : null
    if (!session) return res.status(401).json({ error: 'Authentication required' })
    req.username = session.username
    next()
  } catch (err) {
    console.error('Session lookup failed:', err.message)
    res.status(500).json({ error: 'Session lookup failed', detail: err.message })
  }
}
