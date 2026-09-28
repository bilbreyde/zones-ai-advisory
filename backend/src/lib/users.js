// Sign in accounts. Container: users (partition key /type, value always "user"). The document id
// is the normalized username. Accounts are created with scripts/manage-users.mjs — there is no
// user management API in the running app.
import { containers } from '../db.js'
import { hashPassword, normalizeUsername } from './auth.js'

const TYPE = 'user'
const store = () => containers.users

/** The user document, or null if there is no account with this username. */
export async function getUser(username) {
  const id = normalizeUsername(username)
  if (!id) return null
  try {
    const { resource } = await store().item(id, TYPE).read()
    return resource ?? null
  } catch (err) {
    if (err.code === 404) return null
    throw err
  }
}

export async function createUser(username, password) {
  const { hash, salt } = await hashPassword(password)
  const { resource } = await store().items.create({
    id: normalizeUsername(username),
    type: TYPE,
    hash,
    salt,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  })
  return resource
}

/**
 * Merges patch onto the user document with optimistic concurrency. Pass etag when the caller made
 * a decision based on a document it already read (login, change password), so a concurrent write
 * in between is a conflict rather than silently overwritten. Throws err.code 409 on conflict and
 * err.code 404 if the account does not exist.
 */
export async function updateUser(username, patch, { etag } = {}) {
  const current = await getUser(username)
  if (!current) {
    const err = new Error('User not found')
    err.code = 404
    throw err
  }
  const condition = etag ?? current._etag
  const next = { ...current, ...patch, id: current.id, type: TYPE }
  try {
    const { resource } = await store()
      .item(current.id, TYPE)
      .replace(next, { accessCondition: { type: 'IfMatch', condition } })
    return resource
  } catch (err) {
    // 412 Precondition Failed — the user document changed after the caller read it
    if (err.code === 412) {
      const conflict = new Error('Save conflict — user has changed')
      conflict.code = 409
      throw conflict
    }
    throw err
  }
}

/** All accounts, without hash or salt. */
export async function listUsers() {
  const { resources } = await store().items
    .query({
      query: 'SELECT c.id, c.createdAt, c.lockedUntil FROM c WHERE c.type = @type',
      parameters: [{ name: '@type', value: TYPE }],
    }, { partitionKey: TYPE })
    .fetchAll()
  return resources
}

export async function deleteUser(username) {
  try {
    await store().item(normalizeUsername(username), TYPE).delete()
    return true
  } catch (err) {
    if (err.code === 404) return false
    throw err
  }
}
