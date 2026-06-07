// Crée un user Supabase pré-confirmé + ligne dans public.users avec
// is_platform_admin=true (= accès toutes orgs / tous secteurs). À lancer avec
// `node --env-file=.env.local scripts/create-admin-user.mjs`.

import { createClient } from '@supabase/supabase-js'

const url   = process.env.NEXT_PUBLIC_SUPABASE_URL
const key   = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const EMAIL    = process.env.ADMIN_EMAIL    || 'admin@cctp.local'
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const NAME     = process.env.ADMIN_NAME     || 'Admin CCTP'

const admin = createClient(url, key, { auth: { persistSession: false } })

// 1) Auth user
let userId = null
{
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: NAME },
  })
  if (error && !/already|registered|exist/i.test(error.message)) {
    console.error('createUser error:', error.message); process.exit(1)
  }
  if (data?.user) {
    userId = data.user.id
    console.log('auth user created:', EMAIL, userId)
  } else {
    // already exists — look it up
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listErr) { console.error('listUsers:', listErr.message); process.exit(1) }
    const existing = list.users.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())
    if (!existing) { console.error('user supposedly exists but not found in listUsers'); process.exit(1) }
    userId = existing.id
    // reset password + ensure confirmed
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME },
    })
    if (updErr) console.warn('updateUserById warning:', updErr.message)
    console.log('auth user reused + password reset:', EMAIL, userId)
  }
}

// 2) public.users row with is_platform_admin = true
{
  const { error } = await admin
    .from('users')
    .upsert({
      id: userId,
      email: EMAIL,
      name: NAME,
      is_platform_admin: true,
      status: 'active',
    }, { onConflict: 'id' })
  if (error) { console.error('users upsert error:', error.message); process.exit(1) }
  console.log('public.users upserted with is_platform_admin=true')
}

console.log('---')
console.log('LOGIN:')
console.log('  email   :', EMAIL)
console.log('  password:', PASSWORD)
console.log('URL: http://localhost:3000/auth')
