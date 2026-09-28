import { Router } from 'express'
import {
  SESSION_COOKIE, clearFailedAttempts, clearSessionCookie, hashPassword, isLocked, parseCookies,
  recordFailedAttempt, setSessionCookie, validatePassword, validateUsername, verifyPassword,
} from '../lib/auth.js'
import { createSession, deleteSession, getSession } from '../lib/sessions.js'
import { getUser, updateUser } from '../lib/users.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()

const BAD_LOGIN = 'Invalid username or password.'
const secure = () => process.env.NODE_ENV === 'production'
const sessionToken = req => parseCookies(req.headers.cookie)[SESSION_COOKIE]

// A fixed decoy so a login for a username that does not exist still pays the same scrypt cost as
// a real one, and response time does not reveal which usernames have accounts.
let decoy
const getDecoy = () => (decoy ??= hashPassword('decoy password that never matches anything'))

// POST /api/auth/login — public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}
    const name = validateUsername(username)
    const user = name ? await getUser(name) : null

    if (!user) {
      const d = await getDecoy()
      await verifyPassword(String(password ?? ''), d.hash, d.salt)
      return res.status(401).json({ error: BAD_LOGIN })
    }

    if (isLocked(user)) return res.status(429).json({ error: 'Account locked. Try again in 15 minutes.' })

    const ok = typeof password === 'string' && await verifyPassword(password, user.hash, user.salt)
    if (!ok) {
      const patch = recordFailedAttempt(user)
      await updateUser(user.id, patch, { etag: user._etag })
      if (patch.lockedUntil) return res.status(429).json({ error: 'Account locked. Try again in 15 minutes.' })
      return res.status(401).json({ error: BAD_LOGIN })
    }

    await updateUser(user.id, clearFailedAttempts(), { etag: user._etag })
    const token = await createSession(user.id)
    res.setHeader('Set-Cookie', setSessionCookie(token, { secure: secure() }))
    res.json({ username: user.id })
  } catch (err) {
    if (err.code === 409) return res.status(409).json({ error: 'Sign in conflicted with another attempt. Try again.' })
    console.error('Login failed:', err.message)
    res.status(500).json({ error: 'Sign in failed', detail: err.message })
  }
})

// POST /api/auth/logout — public
router.post('/logout', async (req, res) => {
  try {
    await deleteSession(sessionToken(req))
    res.setHeader('Set-Cookie', clearSessionCookie({ secure: secure() }))
    res.json({ ok: true })
  } catch (err) {
    console.error('Logout failed:', err.message)
    res.status(500).json({ error: 'Sign out failed', detail: err.message })
  }
})

// GET /api/auth/me — public, always 200 so the frontend can check sign in state
router.get('/me', async (req, res) => {
  try {
    const token = sessionToken(req)
    const session = token ? await getSession(token) : null
    if (!session) return res.json({ authenticated: false })
    res.json({ username: session.username, authenticated: true })
  } catch (err) {
    console.error('Session lookup failed:', err.message)
    res.status(500).json({ error: 'Session lookup failed', detail: err.message })
  }
})

// POST /api/auth/change-password — requires a session
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ error: 'New password must be 12 to 200 characters.' })
    }
    const user = await getUser(req.username)
    if (!user) return res.status(401).json({ error: 'Authentication required' })

    const ok = typeof currentPassword === 'string' && await verifyPassword(currentPassword, user.hash, user.salt)
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' })

    const { hash, salt } = await hashPassword(newPassword)
    await updateUser(user.id, { hash, salt, passwordChangedAt: new Date().toISOString() }, { etag: user._etag })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 409) return res.status(409).json({ error: 'Your account changed while saving. Try again.' })
    console.error('Change password failed:', err.message)
    res.status(500).json({ error: 'Change password failed', detail: err.message })
  }
})

export default router
