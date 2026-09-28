// Account lifecycle for username and password sign in (src/lib/auth.js). There is no admin role
// and no user management screen in the running app on purpose: whoever can run this script against
// Cosmos controls who can sign in. It connects exactly the way the API does (src/db.js, reading
// COSMOS_ENDPOINT / COSMOS_KEY / COSMOS_DATABASE from backend/.env).
//
// Usage (from the repo root):
//   node backend/scripts/manage-users.mjs create <username>           prompts for a password twice
//   node backend/scripts/manage-users.mjs list                        usernames, created, locked until
//   node backend/scripts/manage-users.mjs reset-password <username>   prompts for a new password, clears lockout
//   node backend/scripts/manage-users.mjs delete <username>           deletes the account and all its sessions
//
// Before any write it prints the active az subscription and the Cosmos endpoint and asks to continue.

import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(here, '../.env') })

// db.js builds its Cosmos client at import time, so these load after .env
const { initDb } = await import('../src/db.js')
const { hashPassword, validatePassword, validateUsername, MIN_PASSWORD_LENGTH } = await import('../src/lib/auth.js')
const { createUser, deleteUser, getUser, listUsers, updateUser } = await import('../src/lib/users.js')
const { deleteSessionsForUser } = await import('../src/lib/sessions.js')

const EXPECTED_SUBSCRIPTION_PREFIX = '7d70637f'

const [command, target] = process.argv.slice(2)

function usage(message) {
  if (message) console.error(message + '\n')
  console.error(
    'Usage:\n' +
      '  node backend/scripts/manage-users.mjs create <username>\n' +
      '  node backend/scripts/manage-users.mjs list\n' +
      '  node backend/scripts/manage-users.mjs reset-password <username>\n' +
      '  node backend/scripts/manage-users.mjs delete <username>',
  )
  process.exit(1)
}

// Piped stdin (scripting): one shared reader, since a fresh readline per prompt would swallow the
// lines buffered for the prompts after it.
let pipedLines
function nextPipedLine(question) {
  process.stdout.write(question)
  pipedLines ??= createInterface({ input: process.stdin })[Symbol.asyncIterator]()
  return pipedLines.next().then(({ value, done }) => {
    process.stdout.write('\n')
    return done ? '' : value
  })
}

function ask(question) {
  if (!process.stdin.isTTY) return nextPipedLine(question)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(res => rl.question(question, answer => { rl.close(); res(answer) }))
}

// Reads a line without echoing it. Falls back to a plain read when stdin is not a terminal.
function askHidden(question) {
  if (!process.stdin.isTTY) return nextPipedLine(question)
  return new Promise((res, rej) => {
    process.stdout.write(question)
    const stdin = process.stdin
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData)
          process.stdout.write('\n')
          return res(value)
        }
        if (ch === '\u0003') { // Ctrl+C
          stdin.setRawMode(false); stdin.off('data', onData)
          process.stdout.write('\n')
          return rej(new Error('Cancelled'))
        }
        if (ch === '\u0008' || ch === '\u007f') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function promptNewPassword() {
  const first = await askHidden(`Password (min ${MIN_PASSWORD_LENGTH} characters): `)
  if (!validatePassword(first)) usage(`Password must be ${MIN_PASSWORD_LENGTH} to 200 characters.`)
  const second = await askHidden('Confirm password: ')
  if (first !== second) usage('Passwords do not match.')
  return first
}

// Shows which Azure subscription and Cosmos account a write would land in, and asks to continue.
async function confirmTarget(action) {
  let account
  try {
    account = JSON.parse(execSync('az account show -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch {
    console.error('Could not read the active Azure subscription. Run "az login" first.')
    process.exit(1)
  }
  console.log(`Subscription: ${account.name} (${account.id})`)
  console.log(`Tenant:       ${account.tenantId}`)
  console.log(`Cosmos:       ${process.env.COSMOS_ENDPOINT} / ${process.env.COSMOS_DATABASE || 'zones-ai-advisory'}`)
  if (!account.id?.startsWith(EXPECTED_SUBSCRIPTION_PREFIX)) {
    console.warn(`WARNING: this is not the Zones AI Advisory subscription (${EXPECTED_SUBSCRIPTION_PREFIX}...).`)
  }
  console.log(`About to: ${action}`)
  const answer = await ask('Continue? (y/N) ')
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('Cancelled. Nothing was changed.')
    process.exit(0)
  }
}

if (!command) usage()
if (!['create', 'list', 'reset-password', 'delete'].includes(command)) usage(`Unknown command "${command}".`)
if (!process.env.COSMOS_ENDPOINT) usage('COSMOS_ENDPOINT is not set. Check backend/.env.')

try {
  await initDb()

  if (command === 'list') {
    const users = await listUsers()
    console.log(`${users.length} account(s)`)
    for (const u of users.sort((a, b) => a.id.localeCompare(b.id))) {
      const locked = u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()
      console.log(`  ${u.id}  created ${u.createdAt ?? 'unknown'}${locked ? `  locked until ${u.lockedUntil}` : ''}`)
    }
    process.exit(0)
  }

  const username = validateUsername(target ?? '')
  if (!username) {
    usage(`"${target ?? ''}" is not a valid username. Use 2 to 40 characters: lower case letters, digits, dot, underscore or hyphen.`)
  }
  const existing = await getUser(username)

  if (command === 'create') {
    if (existing) usage(`${username} already has an account. Use reset-password to change it.`)
    const password = await promptNewPassword()
    await confirmTarget(`create account "${username}"`)
    await createUser(username, password)
    console.log(`Created ${username}.`)
    process.exit(0)
  }

  if (command === 'reset-password') {
    if (!existing) usage(`${username} has no account. Use create instead.`)
    const password = await promptNewPassword()
    await confirmTarget(`reset the password for "${username}" and clear any lockout`)
    const { hash, salt } = await hashPassword(password)
    await updateUser(username, { hash, salt, failedAttempts: 0, lockedUntil: null, passwordChangedAt: new Date().toISOString() })
    console.log(`Reset password for ${username}. Lockout cleared.`)
    process.exit(0)
  }

  if (command === 'delete') {
    if (!existing) usage(`${username} has no account.`)
    await confirmTarget(`DELETE account "${username}" and sign out all of its sessions`)
    await deleteUser(username)
    const removed = await deleteSessionsForUser(username)
    console.log(`Deleted ${username} and ${removed} session(s).`)
    process.exit(0)
  }
} catch (err) {
  console.error(`Failed: ${err.message}`)
  process.exit(1)
}
