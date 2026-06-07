// One-off script: apply a SQL file to the Supabase DB using the direct
// connection (port 5432) so DDL works correctly. Reads .env.local for the
// connection string; pass the migration path as argv[2].
//
// Usage:
//   node scripts/apply-migration.mjs supabase/migrations/20260517190000_quotes_persistence.sql

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const dotenvPath = resolve(process.cwd(), '.env.local')
const envText = readFileSync(dotenvPath, 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const pooled = process.env.DATABASE_URL
if (!pooled) {
  console.error('Missing DATABASE_URL in .env.local')
  process.exit(1)
}

// Convert pooled URL (port 6543, ?pgbouncer=true) into a direct URL (5432).
// DDL through pgbouncer-transaction is unreliable; the direct pooler port
// accepts long-lived sessions and runs DDL safely.
const directUrl = pooled
  .replace(':6543/', ':5432/')
  .replace(/\?pgbouncer=true$/, '')
  .replace(/&pgbouncer=true/, '')

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/apply-migration.mjs <path-to-sql>')
  process.exit(1)
}

const sql = readFileSync(resolve(process.cwd(), filePath), 'utf8')

const client = postgres(directUrl, { prepare: false, max: 1 })

try {
  console.log(`Applying ${filePath} ...`)
  await client.unsafe(sql)
  console.log('OK')
} catch (err) {
  console.error('FAILED:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
