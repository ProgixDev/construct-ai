import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

// Client-side auth surface. Every call from the browser goes through here,
// never directly into supabase-js — keeps the sign-up / sign-in / fetch-me
// semantics in one file we can evolve without touching UI components.

export type CurrentUser = {
  id: string
  name: string | null
  email: string
  isPlatformAdmin: boolean
}

export type CurrentMembership = {
  role: 'owner' | 'member'
  account: {
    id: string
    name: string
    kind: 'individual' | 'company'
  }
}

export type MePayload = {
  user: CurrentUser
  memberships: CurrentMembership[]
}

/** Sign up with email + password. Metadata lands on auth.users.user_metadata
 * and is read once by bootstrapUser() on first /api/me call. */
export async function signUpWithPassword(input: {
  email: string
  password: string
  name?: string
}) {
  const supabase = createBrowserSupabaseClient()
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: input.name ? { name: input.name } : undefined,
    },
  })
}

export async function signInWithPassword(input: { email: string; password: string }) {
  const supabase = createBrowserSupabaseClient()
  return supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
}

export async function signOut() {
  const supabase = createBrowserSupabaseClient()
  return supabase.auth.signOut()
}

/**
 * Fetch the current user + memberships from our server. Returns `null` if
 * the caller is unauthenticated (401) — the UI uses this to decide whether
 * to redirect to /auth. Any other status throws.
 */
export async function fetchMe(): Promise<MePayload | null> {
  const res = await fetch('/api/me', { credentials: 'include', cache: 'no-store' })
  if (res.status === 401) return null
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `GET /api/me failed (${res.status})`)
  }
  return (await res.json()) as MePayload
}
