// Sign in session storage. One document per open session, keyed by its opaque random token.
// Container: auth_sessions (partition key /type, value always "session"). The container named
// "sessions" is advisory meeting sessions and is unrelated to sign in.
import { containers } from '../db.js'
import { isExpired, newSessionToken, sessionExpiry } from './auth.js'

const TYPE = 'session'
const store = () => containers.auth_sessions

export async function createSession(username) {
  const token = newSessionToken()
  await store().items.create({
    id: token,
    type: TYPE,
    username,
    createdAt: new Date().toISOString(),
    expiresAt: sessionExpiry(),
  })
  return token
}

/** The session document, or null if the token is unknown or the session has expired. */
export async function getSession(token) {
  if (typeof token !== 'string' || !token) return null
  try {
    const { resource } = await store().item(token, TYPE).read()
    if (!resource || isExpired(resource.expiresAt)) return null
    return resource
  } catch (err) {
    if (err.code === 404) return null
    throw err
  }
}

export async function deleteSession(token) {
  if (typeof token !== 'string' || !token) return
  try {
    await store().item(token, TYPE).delete()
  } catch (err) {
    if (err.code !== 404) throw err // already gone is fine
  }
}

async function deleteWhere(query) {
  const { resources } = await store().items
    .query(query, { partitionKey: TYPE })
    .fetchAll()
  for (const doc of resources) await deleteSession(doc.id)
  return resources.length
}

/** Deletes every session whose expiresAt has passed. Returns how many were removed. */
export function pruneExpiredSessions() {
  return deleteWhere({
    query: 'SELECT c.id FROM c WHERE c.type = @type AND c.expiresAt < @now',
    parameters: [{ name: '@type', value: TYPE }, { name: '@now', value: new Date().toISOString() }],
  })
}

/** Signs a user out everywhere. Used when an account is deleted. */
export function deleteSessionsForUser(username) {
  return deleteWhere({
    query: 'SELECT c.id FROM c WHERE c.type = @type AND c.username = @username',
    parameters: [{ name: '@type', value: TYPE }, { name: '@username', value: username }],
  })
}
