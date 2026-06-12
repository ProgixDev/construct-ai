// Seed a ready-to-use TEST user in the Supabase auth backend.
//
// Creates ONLY the auth.users row (pre-confirmed email + password). We do NOT
// touch public.users — the app's bootstrapUser() creates public.users + a
// personal account + an owner membership on first login. Pre-creating the
// public row would make bootstrap skip account/membership and break quoting.
//
// Run: node --env-file=.env.local scripts/seed-test-user.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const EMAIL    = process.env.TEST_EMAIL    || 'test@plombia.fr'
const PASSWORD = process.env.TEST_PASSWORD || 'TestPlombia2026!'
const NAME     = process.env.TEST_NAME     || 'Test Plombia'

const admin = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: NAME },
})

if (error && !/already|registered|exist/i.test(error.message)) {
  console.error('createUser error:', error.message)
  process.exit(1)
}

let userId = data?.user?.id
if (userId) {
  console.log('auth user created:', EMAIL, userId)
} else {
  // Already exists — reset password + ensure confirmed so the creds are valid.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) { console.error('listUsers:', listErr.message); process.exit(1) }
  const existing = list.users.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())
  if (!existing) { console.error('user supposedly exists but not found'); process.exit(1) }
  userId = existing.id
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: NAME },
  })
  if (updErr) { console.error('updateUserById:', updErr.message); process.exit(1) }
  console.log('auth user reused + password reset:', EMAIL, userId)
}

console.log('---')
console.log('LOGIN:')
console.log('  email   :', EMAIL)
console.log('  password:', PASSWORD)
console.log('public.users + account + membership are created automatically on first login.')
