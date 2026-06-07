'use client'

// Client helpers to talk to /api/billing.
// Keeps the modal free of fetch/JSON plumbing and gives us a single place
// to swap in real Stripe SDK redirects if we ever import @stripe/stripe-js.

export type CheckoutPlan = 'pro' | 'team'

export type CheckoutResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'mocked'; plan: CheckoutPlan; reason: string }

/**
 * POST /api/billing/checkout — server returns either a Stripe Checkout URL
 * (configured) or a { mocked: true } sentinel (Stripe keys missing in dev).
 */
export async function startCheckout(plan: CheckoutPlan): Promise<CheckoutResult> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Checkout failed (HTTP ${res.status})`)
  }
  const json = (await res.json()) as
    | { url: string }
    | { mocked: true; plan: CheckoutPlan; reason?: string }
  if ('url' in json) {
    return { kind: 'redirect', url: json.url }
  }
  return { kind: 'mocked', plan: json.plan, reason: json.reason ?? 'mocked' }
}

/**
 * POST /api/billing/portal — opens the Stripe Customer Portal for an
 * existing subscription so the user can change plan / update card / cancel.
 */
export async function openBillingPortal(customerId: string): Promise<string> {
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Portal failed (HTTP ${res.status})`)
  }
  const json = (await res.json()) as { url: string }
  return json.url
}
