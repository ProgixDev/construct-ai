'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import Animate from '@/components/feedback/Animate'
import Footer from '@/components/navigation/Footer'
import { formatSiret, isValidSiret, isValidVatFr } from '@/shared/validation/siret'
import { signInWithPassword, signUpWithPassword } from '@/features/auth/api'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const { t, locale, setLocale } = useLanguage()

  const [mode, setMode] = useState<Mode>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [siret, setSiret] = useState('')
  const [address, setAddress] = useState('')
  const [vatIntra, setVatIntra] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setNotice('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t.auth.errorEmail)
    if (password.length < 6) return setError(t.auth.errorPassword)

    if (mode === 'signup') {
      if (!fullName.trim()) return setError(t.auth.errorName)
      if (password !== confirmPassword) return setError(t.auth.errorConfirm)
      // SIRET + VAT are optional at signup per the lenient policy — only
      // format-check when the user actually typed something.
      if (siret.trim() && !isValidSiret(siret)) return setError(t.auth.errorSiret)
      if (vatIntra.trim() && !isValidVatFr(vatIntra)) return setError(t.auth.errorVat)
    }

    setIsSubmitting(true)
    try {
      if (mode === 'signup') {
        const { data, error: err } = await signUpWithPassword({
          email,
          password,
          name: fullName.trim() || undefined,
        })
        if (err) {
          setError(err.message)
          return
        }
        // No session means email confirmation is enabled OR the address
        // was already registered (Supabase deliberately doesn't tell us
        // which, to avoid leaking which emails exist). Either way, the
        // honest UX is "go check your inbox" — no redirect.
        if (!data.session) {
          setNotice(
            locale === 'fr'
              ? `Vérifiez votre boîte mail (${email}) pour confirmer votre compte.`
              : `Check your inbox (${email}) to confirm your account.`,
          )
          return
        }
      } else {
        const { error: err } = await signInWithPassword({ email, password })
        if (err) {
          setError(err.message)
          return
        }
      }
      // Full-page navigation (not router.push). The auth provider lives at the
      // app root and does NOT remount on a soft navigation, so a client-side
      // push would land on /dashboard with the stale logged-out state until a
      // manual refresh. A hard navigation reloads with the freshly-set session
      // cookie, so the server sees the user and the provider re-fetches /api/me.
      window.location.assign('/dashboard')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <main className="min-h-screen relative overflow-hidden bg-surface-container-lowest text-on-surface flex items-center justify-center">
      {/* Ambient Glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary-container/20 blur-[150px] rounded-full pointer-events-none translate-y-[-50%] translate-x-[-20%] animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-secondary-container/10 blur-[150px] rounded-full pointer-events-none translate-y-[30%] translate-x-[20%]" />

      <div className="relative z-10 w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 px-6 py-12 items-center min-h-[90vh]">
        
        {/* Left Side: Branding & Visuals */}
        <section className="hidden lg:flex flex-col justify-center relative relative">
          <Animate variant="fade-up" delay={0}>
            <Link href="/" className="inline-flex items-center gap-3 mb-10 group cursor-pointer transition-transform hover:scale-[1.02]">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 group-hover:bg-white/15 transition-colors">
                <span className="material-symbols-outlined text-on-surface text-2xl">architecture</span>
              </div>
              <span className="font-headline font-bold text-3xl tracking-tight text-white">
                Plombia Chiffrage
              </span>
            </Link>
          </Animate>

          <Animate variant="fade-up" delay={100}>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-surface-container/80 backdrop-blur-md border border-outline-variant/30 mb-8 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                SECURE
              </span>
            </div>
          </Animate>

          <Animate variant="fade-up" delay={200}>
            <h1 className="font-headline text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight mb-8 text-white">
              {t.auth.heroTitle}
            </h1>
          </Animate>

          <Animate variant="fade-up" delay={300}>
            <p className="text-on-surface-variant max-w-lg leading-relaxed text-lg mb-12">
              {t.auth.heroDesc}
            </p>
          </Animate>

          <Animate variant="fade-up" delay={400}>
            <div className="relative rounded-3xl overflow-hidden border border-outline-variant/20 bg-surface-container/30 backdrop-blur-md p-6 group transition-all hover:bg-surface-container/40">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(at_0%_0%,#d4ff3a_0px,transparent_50%),radial-gradient(at_100%_100%,#e8ff7a_0px,transparent_50%)] pointer-events-none group-hover:opacity-20 transition-opacity" />
              <div className="relative z-10 flex gap-5 items-center">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                  <span className="material-symbols-outlined text-primary text-3xl">security</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-on-surface mb-1 uppercase tracking-wider font-headline">Strong Security</h4>
                  <p className="text-sm text-on-surface-variant leading-relaxed">We protect your plans and keep them private.</p>
                </div>
              </div>
            </div>
          </Animate>
        </section>

        {/* Right Side: Auth Form */}
        <section className="flex items-center justify-center lg:justify-end w-full">
          <Animate variant="fade-up" delay={150} className="w-full max-w-[480px]">
            <div className="w-full rounded-[2rem] border border-outline-variant/20 bg-surface-container-low/60 backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] p-8 md:p-12 relative overflow-hidden">
              
              {/* Subtle top glare */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="flex justify-between items-center mb-10">
                <div className="inline-flex rounded-xl border border-outline-variant/30 bg-surface-container/80 p-1.5 backdrop-blur-sm shadow-inner">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`px-6 py-2.5 text-xs font-bold uppercase tracking-[0.15em] rounded-lg transition-all duration-300 ${
                      mode === 'login'
                        ? 'bg-primary-container text-on-primary-container shadow-md'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.auth.loginTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`px-6 py-2.5 text-xs font-bold uppercase tracking-[0.15em] rounded-lg transition-all duration-300 ${
                      mode === 'signup'
                        ? 'bg-primary-container text-on-primary-container shadow-md'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.auth.signupTab}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setLocale(locale === 'en' ? 'fr' : 'en')}
                  className="w-11 h-11 flex items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container/50 text-on-surface text-xs font-black tracking-widest hover:border-primary/50 hover:text-primary transition-colors backdrop-blur-sm"
                >
                  {locale === 'en' ? 'FR' : 'EN'}
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className={`space-y-6 transition-all duration-500 origin-top ${mode === 'signup' ? 'opacity-100 max-h-[100px] scale-y-100' : 'opacity-0 max-h-0 scale-y-0 overflow-hidden'}`}>
                  {mode === 'signup' && (
                    <div className="space-y-2.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                        {t.auth.fullName}
                      </label>
                      <div className="relative group">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">person</span>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                    {t.auth.email}
                  </label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">mail</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      {t.auth.password}
                    </label>
                    {mode === 'login' && (
                       <button type="button" className="text-[11px] font-bold text-primary hover:text-primary-fixed transition-colors tracking-wider uppercase">
                         Forgot?
                       </button>
                    )}
                  </div>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">lock</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className={`space-y-6 transition-all duration-500 origin-top ${mode === 'signup' ? 'opacity-100 max-h-[100px] scale-y-100' : 'opacity-0 max-h-0 scale-y-0 overflow-hidden'}`}>
                  {mode === 'signup' && (
                    <div className="space-y-2.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                        {t.auth.confirmPassword}
                      </label>
                      <div className="relative group">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">lock_reset</span>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className={`space-y-5 transition-all duration-500 origin-top ${mode === 'signup' ? 'opacity-100 max-h-[640px] scale-y-100' : 'opacity-0 max-h-0 scale-y-0 overflow-hidden'}`}>
                  {mode === 'signup' && (
                    <>
                      <div className="flex items-center gap-3 pt-3">
                        <div className="h-px flex-1 bg-outline-variant/20" />
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">business</span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-on-surface">{t.auth.companyStep}</span>
                        </div>
                        <div className="h-px flex-1 bg-outline-variant/20" />
                      </div>
                      <p className="text-[11px] text-on-surface-variant/80 leading-relaxed -mt-2 px-1">
                        {t.auth.companyStepDesc}
                      </p>

                      <div className="space-y-2.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                          {t.auth.companyName}
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">storefront</span>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(event) => setCompanyName(event.target.value)}
                            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all"
                            placeholder={t.auth.companyNamePlaceholder}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                          {t.auth.siret}
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">badge</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={siret}
                            onChange={(event) => setSiret(formatSiret(event.target.value))}
                            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all font-mono"
                            placeholder={t.auth.siretPlaceholder}
                            maxLength={17}
                          />
                        </div>
                        <p className="text-[10px] text-on-surface-variant/60 ml-1">{t.auth.siretHint}</p>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                          {t.auth.address}
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">location_on</span>
                          <input
                            type="text"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all"
                            placeholder={t.auth.addressPlaceholder}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {t.auth.vatIntra}
                          </label>
                          <span className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">
                            {t.auth.vatIntraOptional}
                          </span>
                        </div>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-2xl group-focus-within:text-primary transition-colors">receipt_long</span>
                          <input
                            type="text"
                            value={vatIntra}
                            onChange={(event) => setVatIntra(event.target.value.toUpperCase())}
                            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container/60 pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 focus:bg-surface-container-high transition-all font-mono"
                            placeholder={t.auth.vatIntraPlaceholder}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {error && (
                  <Animate variant="fade-in">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-bold shadow-inner">
                      <span className="material-symbols-outlined text-[20px]">error</span>
                      {error}
                    </div>
                  </Animate>
                )}

                {notice && (
                  <Animate variant="fade-in">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-bold shadow-inner">
                      <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
                      {notice}
                    </div>
                  </Animate>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full relative mt-8 rounded-xl bg-primary text-on-primary py-5 font-headline font-extrabold text-[14px] uppercase tracking-[0.2em] hover:bg-primary-fixed active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 transition-all overflow-hidden group shadow-[0_0_20px_rgba(212,255,58,0.3)] hover:shadow-[0_0_30px_rgba(212,255,58,0.5)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        {mode === 'login' ? 'SIGNING IN...' : 'CREATING ACCOUNT...'}
                      </>
                    ) : (
                      <>
                        {mode === 'login' ? t.auth.loginButton : t.auth.signupButton}
                        <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                      </>
                    )}
                  </span>
                </button>

                <p className="mt-8 text-center text-sm text-on-surface-variant/60 leading-relaxed px-4">
                  By continuing, you agree to our{' '}
                  <Link href="#" className="underline hover:text-on-surface-variant transition-colors">Terms of Service</Link> 
                  {' '}and{' '}
                  <Link href="#" className="underline hover:text-on-surface-variant transition-colors">Privacy Policy</Link>.
                </p>
                <div className="text-center">
                  <p className="mt-5 text-[11px] text-on-surface-variant/40 leading-relaxed">
                    {t.auth.legal}
                  </p>
                </div>
              </form>
            </div>
          </Animate>
        </section>
      </div>
    </main>
    <Footer />
    </>
  )
}
