// Create the `cctp-uploads` Storage bucket on the live Supabase project.
// Idempotent: re-running will report `already exists` and exit 0.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dotenvPath = resolve(process.cwd(), '.env.local')
const envText = readFileSync(dotenvPath, 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BUCKET = 'cctp-uploads'

const res = await fetch(`${url}/storage/v1/bucket`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: service,
    Authorization: `Bearer ${service}`,
  },
  body: JSON.stringify({
    id: BUCKET,
    name: BUCKET,
    public: false,                        // server-only access through service_role
    file_size_limit: 25 * 1024 * 1024,    // 25 MB matches OpenAI's PDF cap
    allowed_mime_types: ['application/pdf'],
  }),
})

const body = await res.json().catch(() => ({}))

if (res.ok) {
  console.log(`Bucket "${BUCKET}" created.`)
} else if (body?.error === 'Duplicate' || res.status === 409) {
  console.log(`Bucket "${BUCKET}" already exists.`)
} else {
  console.error('Failed:', res.status, body)
  process.exit(1)
}
