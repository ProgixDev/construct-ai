// Quick read-only inspector: lists what's in the quotes / cctp_uploads tables.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const envText = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const direct = process.env.DATABASE_URL
  .replace(':6543/', ':5432/')
  .replace(/[?&]pgbouncer=true/, '')

const sql = postgres(direct, { prepare: false, max: 1 })

const uploads = await sql`select id, file_name, account_id, created_at from cctp_uploads order by created_at desc limit 10`
console.log(`\ncctp_uploads (${uploads.length} latest):`)
for (const r of uploads) console.log(`  ${r.created_at.toISOString()}  ${r.file_name}  acc=${r.account_id.slice(0,8)}…`)

const quotes = await sql`select id, devis_number, project_name, status, account_id, total_ht, created_at from quotes order by created_at desc limit 10`
console.log(`\nquotes (${quotes.length} latest):`)
for (const r of quotes) console.log(`  ${r.created_at.toISOString()}  ${r.devis_number}  status=${r.status}  acc=${r.account_id.slice(0,8)}…  HT=${r.total_ht}  "${r.project_name}"`)

const lines = await sql`select count(*)::int as n from quote_lines`
console.log(`\nquote_lines total: ${lines[0].n}`)

const accounts = await sql`select id, name, kind from accounts order by created_at desc limit 5`
console.log(`\naccounts (${accounts.length} latest):`)
for (const r of accounts) console.log(`  ${r.id.slice(0,8)}…  ${r.kind}  "${r.name}"`)

const memberships = await sql`select user_id, account_id, role, status from memberships limit 10`
console.log(`\nmemberships (${memberships.length}):`)
for (const r of memberships) console.log(`  user=${r.user_id?.slice(0,8)}…  acc=${r.account_id.slice(0,8)}…  ${r.role}  ${r.status}`)

await sql.end()
