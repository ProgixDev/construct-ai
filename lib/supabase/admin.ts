import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/server/core/config/env'

// Server-only Supabase client using the service-role key. Bypasses RLS.
// Use for: Storage uploads/downloads, admin-level reads. Never expose to the
// browser. We use the JS client (not @supabase/ssr) because we never want it
// to read auth cookies for these calls.
let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
