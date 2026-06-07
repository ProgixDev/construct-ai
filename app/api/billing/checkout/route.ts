import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/billing/checkout
 *
 * Body: { plan: 'pro' | 'team' }
 *
 * Returns either:
 *   - { url: '...stripe checkout url...' }      when Stripe is configured
 *   - { mocked: true, plan: '...' }              when Stripe keys are absent
 *
 * The client (PaywallModal) accepts both. In mocked mode the modal falls back
 * to activatePlan() locally — useful for local dev without Stripe.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { plan?: string }
  const plan = body.plan
  if (plan !== 'pro' && plan !== 'team') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  const priceId =
    plan === 'pro' ? process.env.STRIPE_PRICE_PRO :
    plan === 'team' ? process.env.STRIPE_PRICE_TEAM :
    undefined

  if (!secretKey || !priceId) {
    // Stripe not configured — tell the client to do a client-side activation.
    return NextResponse.json({
      mocked: true,
      plan,
      reason: !secretKey ? 'missing_stripe_secret_key' : 'missing_price_id',
    })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, '')

  try {
    // We avoid pulling the Stripe SDK as a hard dependency. The REST API
    // works fine for a checkout session with a single line item.
    const form = new URLSearchParams()
    form.set('mode', 'subscription')
    form.set('line_items[0][price]', priceId)
    form.set('line_items[0][quantity]', '1')
    form.set('success_url', `${appUrl}/settings?tab=abonnement&checkout=success`)
    form.set('cancel_url',  `${appUrl}/settings?tab=abonnement&checkout=cancelled`)
    form.set('allow_promotion_codes', 'true')
    form.set('client_reference_id', `plan:${plan}`)

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const json = await res.json() as { url?: string; error?: { message?: string } }
    if (!res.ok) {
      return NextResponse.json(
        { error: json.error?.message ?? 'Stripe checkout failed', status: res.status },
        { status: 502 },
      )
    }
    return NextResponse.json({ url: json.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
