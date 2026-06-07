// Vérifie que le compte admin@cctp.local peut se loguer via Supabase.
// node --env-file=.env.local scripts/check-admin-login.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const c = createClient(url, anon)

const { data, error } = await c.auth.signInWithPassword({
  email: 'admin@cctp.local',
  password: 'Admin1234!',
})
if (error) {
  console.log('SIGNIN ERROR:', error.status, error.message)
  process.exit(1)
}
console.log('SIGNIN OK')
console.log('  user_id        :', data.user.id)
console.log('  email          :', data.user.email)
console.log('  email_confirmed:', data.user.email_confirmed_at ? 'yes' : 'NO')
console.log('  session ttl    :', new Date(data.session.expires_at * 1000).toISOString())
