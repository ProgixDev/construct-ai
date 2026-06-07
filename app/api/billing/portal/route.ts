import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/billing/portal
 *
 * Body: { customerId: string }
 *
 * Returns: { url } redirect to the Stripe Customer Portal so the user can
 * upgrade / downgrade / cancel / update card.
 *
 * In a real app the customer id should be looked up server-side from the
 * authenticated user (stored when the first checkout completes via webhook).
 * For now we accept it from the body — wire it once you persist subscriptions.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { customerId?: string }
  const customerId = body.customerId
  if (!customerId) {
    return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, '')

  const form = new URLSearchParams()
  form.set('customer', customerId)
  form.set('return_url', `${appUrl}/settings?tab=abonnement`)

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const json = await res.json() as { url?: string; error?: { message?: string } }
  if (!res.ok) {
    return NextResponse.json({ error: json.error?.message ?? 'Portal failed' }, { status: 502 })
  }
  return NextResponse.json({ url: json.url })
}
