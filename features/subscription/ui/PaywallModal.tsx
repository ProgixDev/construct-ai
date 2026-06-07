'use client'

import { useState } from 'react'
import { activatePlan, PAID_PLANS, type Plan } from '@/features/subscription/store'
import { startCheckout, type CheckoutPlan } from '@/features/subscription/checkout'

type Props = {
  onClose: () => void
  onSubscribed?: (plan: Exclude<Plan, 'trial'>) => void
  /** Why the user hit the paywall — drives the headline copy. */
  reason?: 'trial-used' | 'upgrade'
}

export default function PaywallModal({ onClose, onSubscribed, reason = 'trial-used' }: Props) {
  const [selected, setSelected] = useState<Exclude<Plan, 'trial'>>('pro')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headline = reason === 'trial-used'
    ? 'Votre chiffrage gratuit est utilisé'
    : 'Débloquez les chiffrage illimités'

  const subline = reason === 'trial-used'
    ? 'Passez à un plan payant pour continuer à générer des chiffrage depuis vos CCTP.'
    : 'Comparez nos plans et choisissez celui qui correspond à votre activité.'

  const subscribe = async () => {
    setError(null)
    setProcessing(true)
    try {
      if (selected === 'enterprise') {
        // Enterprise has no self-service Stripe price — route to a contact form.
        window.location.href = 'mailto:contact@plombia.fr?subject=Demande%20plan%20Enterprise'
        return
      }
      // Hit /api/billing/checkout. If Stripe is configured server-side we
      // get back { url } and redirect. If not (dev mode), we get { mocked: true }
      // and fall back to a local activation so the demo still works.
      const result = await startCheckout(selected as CheckoutPlan)
      if (result.kind === 'redirect') {
        window.location.href = result.url
        return
      }
      // Mocked — activate locally so the UI unlocks immediately.
      activatePlan(selected)
      onSubscribed?.(selected)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’activation')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,5,5,0.82)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !processing) onClose() }}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-surface-container border border-outline-variant/20 shadow-2xl overflow-hidden"
        style={{ animation: 'modal-in 0.25s ease-out' }}
      >
        <span className="absolute top-3 left-3 w-4 h-4 border-l border-t border-white/15 pointer-events-none" />
        <span className="absolute top-3 right-3 w-4 h-4 border-r border-t border-white/15 pointer-events-none" />
        <span className="absolute bottom-3 left-3 w-4 h-4 border-l border-b border-white/15 pointer-events-none" />
        <span className="absolute bottom-3 right-3 w-4 h-4 border-r border-b border-white/15 pointer-events-none" />
        <div className="absolute inset-0 hero-grid-fine opacity-25 pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between px-8 pt-7 pb-0">
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Abonnement</span>
            </div>
            <h2 className="font-headline font-black text-2xl tracking-tight text-white">{headline}</h2>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{subline}</p>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="relative z-10 p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAID_PLANS.map((plan) => {
            const isSelected = selected === plan.id
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                className={`relative text-left p-5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-primary bg-surface-container-high shadow-[0_0_24px_rgba(212,255,58,0.18)]'
                    : 'border-white/5 bg-surface-container-low hover:border-primary/30 hover:bg-surface-container-high'
                }`}
              >
                {plan.featured && (
                  <span className="absolute -top-2.5 left-5 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[9px] font-black uppercase tracking-widest">
                    Recommandé
                  </span>
                )}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '12px' }}>check</span>
                  </div>
                )}

                <div className="font-headline font-black text-lg text-on-surface">{plan.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant mt-0.5">{plan.tag}</div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-headline font-black text-3xl text-white">{plan.price}</span>
                  {plan.per && <span className="text-xs text-on-surface-variant">{plan.per}</span>}
                </div>

                <ul className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-primary text-[14px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="relative z-10 mx-8 mb-2 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <span className="material-symbols-outlined text-sm mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="relative z-10 px-8 pb-8 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 text-xs text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-primary/80 text-sm">shield</span>
            Paiement sécurisé · résiliable à tout moment
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="px-5 py-3 rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface-variant text-sm font-semibold hover:bg-surface-container-high transition-colors disabled:opacity-40"
          >
            Plus tard
          </button>
          <button
            onClick={subscribe}
            disabled={processing}
            className="group flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary font-headline font-black uppercase tracking-[0.15em] text-sm rounded-xl hover:shadow-[0_0_30px_rgba(212,255,58,0.45)] active:scale-95 transition-all disabled:opacity-60 disabled:scale-100"
          >
            {processing ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Activation…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                S&rsquo;abonner
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
