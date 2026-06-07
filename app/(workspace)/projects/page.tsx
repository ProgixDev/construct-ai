'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Modal from '@/components/feedback/Modal'
import Toast from '@/components/feedback/Toast'
import Animate from '@/components/feedback/Animate'
import UploadModal from '@/features/quote/ui/UploadModal'
import PlatformBackdrop from '@/components/feedback/PlatformBackdrop'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  deleteQuote,
  getAllQuotes,
  subscribeQuotes,
  visibleQuotes,
  addQuote,
  hydrateFromApi,
  type Quote,
  type QuoteStatus,
} from '@/features/quote/registry'
import { getCurrentUser, subscribeCurrentUser, type User } from '@/features/auth/currentUser'
import { getOrg, type Org } from '@/features/auth/orgs'
import { SEED_USERS } from '@/features/auth/currentUser'

const STATUS_CLASSES: Record<QuoteStatus, { classes: string; dot: string }> = {
  finalisé:  { classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', dot: 'bg-emerald-500'       },
  brouillon: { classes: 'bg-surface-container text-on-surface-variant border border-outline-variant/20', dot: 'bg-on-surface-variant' },
  envoyé:    { classes: 'bg-primary/10 text-primary border border-primary/20',             dot: 'bg-primary'           },
  archivé:   { classes: 'bg-surface-container text-outline border border-outline-variant/10', dot: 'bg-outline'        },
}

function fill(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })
}

function userLabel(userId: string): string {
  return SEED_USERS.find(u => u.id === userId)?.name ?? userId
}

export default function ProjectsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const statusLabel = (s: QuoteStatus): string => ({
    finalisé: t.projects.statusFinalized,
    envoyé: t.projects.statusSent,
    brouillon: t.projects.statusDraft,
    archivé: t.projects.statusArchived,
  }[s])
  const [user, setUser] = useState<User>(() => getCurrentUser())
  const [allQuotes, setAllQuotes] = useState<Quote[]>([])

  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState<QuoteStatus | 'tous'>('tous')
  const [filterSector, setFilterSector] = useState<'tous' | 'Plomberie' | 'CVC'>('tous')
  const [filterCreator, setFilterCreator] = useState<'tous' | string>('tous')
  const [viewMode, setViewMode]         = useState<'table' | 'grid'>('table')
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null)
  const [showUpload, setShowUpload]     = useState(false)
  const [toast, setToast]               = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    setAllQuotes(getAllQuotes())
    const unsub = subscribeQuotes(q => setAllQuotes([...q]))
    // Best-effort: replace the seeded local list with real DB quotes for the
    // current user. If unauthenticated or offline, the seed stays.
    hydrateFromApi()
    return unsub
  }, [])

  useEffect(() => {
    setUser(getCurrentUser())
    return subscribeCurrentUser(u => setUser({ ...u }))
  }, [])

  // Scope the full list down to what this user can see.
  const scoped = useMemo(() => visibleQuotes(allQuotes, user), [allQuotes, user])

  const quotes = useMemo(() => {
    return scoped.filter(q => {
      const matchSearch  = q.projectName.toLowerCase().includes(search.toLowerCase()) || q.lot.toLowerCase().includes(search.toLowerCase())
      const matchStatus  = filterStatus === 'tous' || q.status === filterStatus
      const matchSector  = filterSector === 'tous' || q.sector === filterSector
      const matchCreator = filterCreator === 'tous' || q.createdBy === filterCreator
      return matchSearch && matchStatus && matchSector && matchCreator
    })
  }, [scoped, search, filterStatus, filterSector, filterCreator])

  const handleDelete    = (q: Quote) => {
    deleteQuote(q.id)
    setDeleteTarget(null)
    setToast({ message: fill(t.projects.toastDeleted, { name: q.projectName }), type: 'info' })
  }
  const handleDuplicate = (q: Quote) => {
    const copy: Quote = {
      ...q,
      id: `q-${Date.now()}`,
      projectName: `${q.projectName} ${t.projects.copiedSuffix}`,
      status: 'brouillon',
      date: new Date().toLocaleDateString('fr-FR'),
      orgId: user.activeOrgId,
      createdBy: user.id,
    }
    addQuote(copy)
    setToast({ message: t.projects.toastDuplicated, type: 'success' })
  }

  const totalHT    = scoped.reduce((s, q) => s + q.totalHT, 0)
  const finalisés  = scoped.filter(q => q.status === 'finalisé').length
  const brouillons = scoped.filter(q => q.status === 'brouillon').length

  const isAdmin = user.role === 'admin'
  const contextOrgs = useMemo<Org[]>(() => {
    const ids = Array.from(new Set(scoped.map(q => q.orgId)))
    return ids.map(id => getOrg(id)).filter(Boolean) as Org[]
  }, [scoped])

  const creatorsInView = useMemo(() => {
    const ids = Array.from(new Set(scoped.map(q => q.createdBy)))
    return ids
  }, [scoped])

  // Members never see the creator filter — they only ever see themselves.
  const showCreatorFilter = user.role !== 'member' && creatorsInView.length > 1

  const scopeLabel = isAdmin
    ? (user.activeOrgId === user.primaryOrgId ? t.projects.scopeAll : t.projects.scopeClientSpace)
    : user.role === 'owner'
      ? t.projects.scopeMyOrg
      : t.projects.scopeMyQuotes

  return (
    <>
      <PlatformBackdrop />
      <div className="relative z-10 pb-32 space-y-8">

        <Animate variant="fade-up" as="section" className="pt-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-primary font-headline font-bold tracking-widest text-[10px] uppercase">{scopeLabel}</span>
              <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tighter text-on-surface mt-1">{scoped.length} {t.projects.quotesCount}</h1>
              <p className="text-on-surface-variant mt-1 text-sm">
                {finalisés} {t.projects.summaryFinalized} · {brouillons} {t.projects.summaryDrafts}
                {isAdmin && user.activeOrgId === user.primaryOrgId && contextOrgs.length > 0 && (
                  <> · {contextOrgs.length} {t.projects.summaryOrgs}</>
                )}
              </p>
            </div>
            <button onClick={() => setShowUpload(true)} className="whitespace-nowrap bg-primary-container text-on-primary-container px-8 py-4 rounded-xl font-headline font-black uppercase tracking-widest shadow-lg shadow-primary-container/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-xl">add</span>{t.projects.newQuote}
            </button>
          </div>
        </Animate>

        <Animate variant="fade-up" delay={60} as="section">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t.projects.statTotalQuotes, value: scoped.length.toString(), icon: 'description',  color: 'text-primary'           },
              { label: t.projects.statFinalized,   value: finalisés.toString(),     icon: 'check_circle',  color: 'text-emerald-400'       },
              { label: t.projects.statDrafts,      value: brouillons.toString(),    icon: 'edit_note',     color: 'text-on-surface-variant' },
              { label: t.projects.statTotalAmount, value: fmtEur(totalHT),          icon: 'payments',      color: 'text-tertiary'          },
            ].map((s, i) => (
              <Animate key={s.label} variant="scale-up" delay={i * 60} className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{s.label}</span>
                  <span className={`material-symbols-outlined text-sm ${s.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                </div>
                <div className={`text-2xl font-headline font-black tracking-tight ${s.color}`}>{s.value}</div>
              </Animate>
            ))}
          </div>
        </Animate>

        <Animate variant="fade-up" delay={80} as="section">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input type="text" placeholder={t.projects.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-surface-container border border-outline-variant/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as QuoteStatus | 'tous')} className="bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/40 transition-all">
              <option value="tous">{t.projects.filterAllStatus}</option>
              <option value="finalisé">{t.projects.statusFinalized}</option>
              <option value="envoyé">{t.projects.statusSent}</option>
              <option value="brouillon">{t.projects.statusDraft}</option>
              <option value="archivé">{t.projects.statusArchived}</option>
            </select>
            <select value={filterSector} onChange={e => setFilterSector(e.target.value as typeof filterSector)} className="bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/40 transition-all">
              <option value="tous">{t.projects.filterAllSectors}</option>
              <option value="Plomberie">{t.projects.sectorPlumbing}</option>
              <option value="CVC">{t.projects.sectorCVC}</option>
            </select>
            {showCreatorFilter && (
              <select value={filterCreator} onChange={e => setFilterCreator(e.target.value)} className="bg-surface-container border border-outline-variant/20 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary/40 transition-all">
                <option value="tous">{t.projects.filterAllCreators}</option>
                {creatorsInView.map(id => (
                  <option key={id} value={id}>{userLabel(id)}</option>
                ))}
              </select>
            )}
            <div className="ml-auto flex items-center gap-1 bg-surface-container rounded-xl p-1 border border-outline-variant/10">
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}><span className="material-symbols-outlined text-sm">table_rows</span></button>
              <button onClick={() => setViewMode('grid')}  className={`p-2 rounded-lg transition-all ${viewMode === 'grid'  ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}><span className="material-symbols-outlined text-sm">grid_view</span></button>
            </div>
          </div>
        </Animate>

        {viewMode === 'table' && (
          <Animate variant="fade-up" delay={100} as="section">
            {quotes.length === 0 ? (
              <div className="bg-surface-container-low rounded-2xl border border-white/5 p-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"><span className="material-symbols-outlined text-primary text-3xl">description</span></div>
                <h3 className="font-headline font-bold text-xl text-on-surface mb-2">{search ? t.projects.emptyNoResultsTitle : t.projects.emptyTitle}</h3>
                <p className="text-on-surface-variant text-sm max-w-xs mb-6">{search ? t.projects.emptyNoResultsDesc : t.projects.emptyDesc}</p>
                {!search && <button onClick={() => setShowUpload(true)} className="px-6 py-3 bg-primary-container text-on-primary-container font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,255,58,0.3)] transition-all">{t.projects.newQuote}</button>}
              </div>
            ) : (
              <div className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-surface-container">
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableProject}</th>
                        {isAdmin && <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableClient}</th>}
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableAuthor}</th>
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableDate}</th>
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableSupplier}</th>
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableItems}</th>
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">{t.projects.tableTotalHT}</th>
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{t.projects.tableStatus}</th>
                        <th className="px-4 py-4 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-center">{t.projects.tableActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quotes.map((q, i) => {
                        const sc  = STATUS_CLASSES[q.status]
                        const org = getOrg(q.orgId)
                        return (
                          <Animate key={q.id} as="tr" variant="fade-up" delay={i * 30} className="hover:bg-surface-container-high transition-colors group cursor-pointer" onClick={() => router.push(`/quote?id=${q.id}`)}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">{q.projectName}</div>
                              <div className="text-[10px] text-on-surface-variant mt-0.5">{q.lot}</div>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                  <span className={`material-symbols-outlined text-sm ${org?.kind === 'service_client' ? 'text-primary' : 'text-on-surface-variant'}`}>
                                    {org?.kind === 'service_client' ? 'handshake' : 'business_center'}
                                  </span>
                                  <span className="truncate max-w-[10rem]">{org?.name ?? '—'}</span>
                                </div>
                                {q.billing?.mode === 'per_quote' && (
                                  <div className={`text-[10px] mt-0.5 font-mono ${q.billing.invoicedAt ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {q.billing.invoicedAt ? `${t.projects.billed} ${fmtEur(q.billing.amount ?? 0)}` : `${t.projects.toBill} ${fmtEur(q.billing.amount ?? 0)}`}
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-4"><span className="text-xs text-on-surface-variant">{userLabel(q.createdBy)}</span></td>
                            <td className="px-4 py-4"><span className="text-sm font-mono text-on-surface-variant">{q.date}</span></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center font-headline font-black text-[8px]">{q.supplierInitials}</div>
                                <span className="text-sm text-on-surface-variant">{q.supplier}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4"><span className="text-sm font-mono text-on-surface-variant">{q.lineItems}</span></td>
                            <td className="px-4 py-4 text-right"><span className="text-sm font-mono font-bold text-on-surface">{fmtEur(q.totalHT)}</span></td>
                            <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${sc.classes}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{statusLabel(q.status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <Link href="/quote" className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"><span className="material-symbols-outlined text-sm">visibility</span></Link>
                                <button onClick={() => handleDuplicate(q)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-all"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                                <button onClick={() => setDeleteTarget(q)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-all"><span className="material-symbols-outlined text-sm">delete</span></button>
                              </div>
                            </td>
                          </Animate>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Animate>
        )}

        {viewMode === 'grid' && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotes.map((q, i) => {
              const sc  = STATUS_CLASSES[q.status]
              const org = getOrg(q.orgId)
              return (
                <Animate key={q.id} variant="fade-up" delay={i * 50}>
                  <div className="bg-surface-container rounded-2xl border border-outline-variant/10 p-6 hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer group" onClick={() => router.push(`/quote?id=${q.id}`)}>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${sc.classes}`}><span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{statusLabel(q.status)}</span>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDuplicate(q)} className="p-1 rounded-lg text-on-surface-variant hover:text-secondary transition-colors"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                        <button onClick={() => setDeleteTarget(q)}  className="p-1 rounded-lg text-on-surface-variant hover:text-red-400 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                      </div>
                    </div>
                    {isAdmin && org && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                        <span className="material-symbols-outlined text-[12px]">{org.kind === 'service_client' ? 'handshake' : 'business_center'}</span>
                        <span className="truncate max-w-[10rem]">{org.name}</span>
                      </div>
                    )}
                    <h3 className="font-headline font-bold text-base text-on-surface group-hover:text-primary transition-colors mb-1">{q.projectName}</h3>
                    <p className="text-[11px] text-on-surface-variant mb-4">{q.lot}</p>
                    <div className="text-3xl font-headline font-black tracking-tight text-on-surface mb-1">{fmtEur(q.totalHT)}</div>
                    <p className="text-[10px] text-on-surface-variant mb-4">HT · {q.lineItems} {t.projects.itemsSuffix} · {userLabel(q.createdBy)}</p>
                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant border-t border-white/5 pt-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-surface-container-high flex items-center justify-center font-headline font-black text-[7px]">{q.supplierInitials}</div>
                        <span>{q.supplier}</span>
                      </div>
                      <span className="font-mono">{q.date}</span>
                    </div>
                  </div>
                </Animate>
              )
            })}
          </section>
        )}
      </div>

      {deleteTarget && (
        <Modal title={t.projects.deleteTitle} onClose={() => setDeleteTarget(null)}>
          <div className="space-y-6">
            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
              <p className="text-sm text-on-surface font-semibold">{deleteTarget.projectName}</p>
              <p className="text-xs text-on-surface-variant mt-1">{deleteTarget.lot} · {fmtEur(deleteTarget.totalHT)} HT</p>
            </div>
            <p className="text-sm text-on-surface-variant">{t.projects.deleteDesc}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold hover:bg-surface-container-high transition-all">{t.common.cancel}</button>
              <button onClick={() => handleDelete(deleteTarget)} className="flex-1 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/20 transition-all">{t.common.delete}</button>
            </div>
          </div>
        </Modal>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
