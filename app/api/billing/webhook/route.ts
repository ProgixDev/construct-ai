import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

/**
 * POST /api/billing/webhook
 *
 * Stripe events handler. Verifies the signature, then persists the new
 * subscription state. Right now it just logs — wire it to your DB layer
 * (e.g. update `accounts.subscription_plan` and `accounts.stripe_customer_id`).
 *
 * Stripe events we care about:
 *   - checkout.session.completed      → first activation
 *   - customer.subscription.updated   → plan change / renewal
 *   - customer.subscription.deleted   → cancellation
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature') ?? ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const raw = await req.text()

  if (!secret) {
    console.warn('[billing/webhook] STRIPE_WEBHOOK_SECRET not set — event dropped')
    return NextResponse.json({ ok: false, reason: 'webhook_secret_not_configured' }, { status: 503 })
  }

  if (!verifyStripeSignature(raw, signature, secret)) {
    return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 401 })
  }

  let event: { type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        client_reference_id?: string
        customer?: string
        subscription?: string
        metadata?: Record<string, string>
      }
      console.log('[billing/webhook] checkout.session.completed', {
        ref: session.client_reference_id,
        customer: session.customer,
        subscription: session.subscription,
      })
      // TODO: persist (accountId, customerId, subscriptionId, plan) in `accounts` table.
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id?: string; customer?: string; status?: string }
      console.log('[billing/webhook]', event.type, sub)
      // TODO: update `accounts.subscription_status` for the matching customer.
      break
    }
    default:
      // Silently accept other events so Stripe doesn't retry.
      break
  }

  return NextResponse.json({ ok: true })
}

/**
 * Verifies Stripe's `Stripe-Signature` header without pulling the SDK.
 * The signed payload is `${timestamp}.${raw_body}`, signed with HMAC-SHA256
 * using the webhook secret. We compare with constant-time equality.
 */
function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  const parts = Object.fromEntries(
    signature.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k, v]
    }),
  ) as { t?: string; v1?: string }
  if (!parts.t || !parts.v1) return false

  const signed = `${parts.t}.${payload}`
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'))
  } catch {
    return false
  }
}
