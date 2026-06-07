'use client'

import { Fragment, Suspense, useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Modal from '@/components/feedback/Modal'
import Toast from '@/components/feedback/Toast'
import Animate from '@/components/feedback/Animate'
import { useLanguage } from '@/contexts/LanguageContext'
import { generateQuotePdf } from '@/features/quote/pdf/generateQuotePdf'
import { SUPPLIERS, SESSION_KEY, type Supplier } from '@/features/catalog/suppliers'
import { loadStoredQuote, fetchQuoteById, patchQuote } from '@/features/quote/store'
import { itemsToRows, visualForCategory } from '@/features/quote/mappers/pricing'
import type { ExtractedQuote, ExtractedToc, QuoteValidation } from '@/features/quote/types'
import SupplierConnectModal from '@/features/catalog/ui/SupplierConnectModal'
import DetectedLotsPanel from '@/features/quote/ui/DetectedLotsPanel'
import ValidationPanel from '@/features/quote/ui/ValidationPanel'
import { getAllAccounts, subscribeAccounts, emptyDiscounts, type SupplierAccount } from '@/features/catalog/supplierAccounts'
import { getEntriesBySupplier, subscribeCatalog } from '@/features/catalog/store'
import { matchItem, methodLabel, methodTier } from '@/features/catalog/mappers/matching'
import type { CatalogEntry, MatchMethod } from '@/features/catalog/types'
import { unitPriceFor } from '@/features/quote/mappers/pricing'

type Row = {
  icon: string
  iconBg: string
  iconColor: string
  name: string
  sub: string
  qtyNum: number
  qtyUnit: string
  unitNum: number
  category: string
  uncertain?: boolean
  matchMethod?: MatchMethod
  matchScore?: number
}

const MAT_META: Omit<Row, 'unitNum'>[] = [
  {
    category: 'ALIMENTATION EF / EC',
    icon: 'water',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    name: 'Alimentation PER Ø32mm',
    sub: '10 bars — regard compteur → chaudière',
    qtyNum: 28,
    qtyUnit: 'ml',
  },
  {
    category: 'ALIMENTATION EF / EC',
    icon: 'plumbing',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    name: 'Distribution EF/EC tube cuivre Ø12/14',
    sub: 'Parties apparentes — avec colliers et rosaces',
    qtyNum: 48,
    qtyUnit: 'ml',
  },
  {
    category: 'ALIMENTATION EF / EC',
    icon: 'valve',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    name: "Vanne d'arrêt + réducteur de pression 3 bars",
    sub: 'NF EN 1567 — sous chaudière',
    qtyNum: 4,
    qtyUnit: 'ens',
  },
  {
    category: 'ÉVACUATIONS PVC',
    icon: 'valve',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    name: 'Chute PVC Ø100 CHUTUNIC NICOL',
    sub: 'Qualité assainissement NF — ventilation primaire incluse',
    qtyNum: 18,
    qtyUnit: 'ml',
  },
  {
    category: 'ÉVACUATIONS PVC',
    icon: 'valve',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    name: 'Évacuation horizontale PVC Ø100',
    sub: 'WC + appareils sanitaires — tampons dégorgement inclus',
    qtyNum: 32,
    qtyUnit: 'ml',
  },
  {
    category: 'ÉVACUATIONS PVC',
    icon: 'pipe',
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    name: 'Évacuation PVC Ø50/40 lavabos & machines',
    sub: 'Douches, lave-linge, lave-vaisselle — siphons inclus',
    qtyNum: 36,
    qtyUnit: 'ml',
  },
  {
    category: 'APPAREILS SANITAIRES',
    icon: 'bathroom',
    iconBg: 'bg-secondary/10',
    iconColor: 'text-secondary',
    name: 'WC suspendu porcelaine blanche NF',
    sub: 'Mécanisme 3/6L double commande — sans canalisations apparentes',
    qtyNum: 4,
    qtyUnit: 'U',
  },
  {
    category: 'APPAREILS SANITAIRES',
    icon: 'bathtub',
    iconBg: 'bg-secondary/10',
    iconColor: 'text-secondary',
    name: 'Baignoire acrylique + mitigeur thermostatique cl.3',
    sub: 'Ensemble douche chromé — pieds coussin néoprène',
    qtyNum: 4,
    qtyUnit: 'U',
  },
  {
    category: 'APPAREILS SANITAIRES',
    icon: 'kitchen',
    iconBg: 'bg-secondary/10',
    iconColor: 'text-secondary',
    name: 'Évier inox + mitigeur double débit',
    sub: 'Mono ou double bac selon plans — mousseur hydro-économe',
    qtyNum: 4,
    qtyUnit: 'U',
  },
  {
    category: 'CHAUFFAGE GAZ',
    icon: 'local_fire_department',
    iconBg: 'bg-tertiary/10',
    iconColor: 'text-tertiary',
    name: 'Chaudière gaz condensation individuelle',
    sub: 'Saunier-Duval / Atlantic / Elm Leblanc — ventouse + mise en service GRDF',
    qtyNum: 4,
    qtyUnit: 'U',
  },
  {
    category: 'CHAUFFAGE GAZ',
    icon: 'device_thermostat',
    iconBg: 'bg-tertiary/10',
    iconColor: 'text-tertiary',
    name: 'Radiateur acier RAL 9010 + tête thermostatique',
    sub: 'Console à sceller — dimensionné selon étude thermique',
    qtyNum: 16,
    qtyUnit: 'U',
  },
  {
    category: 'CHAUFFAGE GAZ',
    icon: 'thermostat',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    name: "Thermostat d'ambiance + horloge hebdomadaire",
    sub: 'Catégorie B — sonde intérieure séjour',
    qtyNum: 4,
    qtyUnit: 'U',
  },
  {
    category: 'VMC HYGRO B',
    icon: 'air',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    name: 'Centrale VMC hygro B collective',
    sub: 'Atlantic HYGROCOSY BC ou équivalent — certifiée',
    qtyNum: 1,
    qtyUnit: 'U',
  },
]

const TVA_RATE = 0.20

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildRows(prices: Supplier['prices']): Row[] {
  const priceMap: Record<number, number> = {
    0: prices[0],
    1: prices[0] * 0.78,
    2: prices[0] * 0.45,
    3: prices[1],
    4: prices[1] * 0.92,
    5: prices[1] * 0.65,
    6: prices[2],
    7: prices[2] * 1.41,
    8: prices[2] * 0.76,
    9: prices[3],
    10: prices[3] * 0.10,
    11: prices[3] * 0.08,
    12: prices[4],
  }
  return MAT_META.map((m, i) => ({ ...m, unitNum: priceMap[i] ?? prices[0] }))
}

function buildRowsFromExtracted(quote: ExtractedQuote, prices: Supplier['prices']): Row[] {
  return itemsToRows(quote.items, prices).map(({ idx: _idx, ...rest }) => {
    void _idx
    return rest
  })
}

/**
 * Quote rows using the plumber's ingested catalog + per-family discount matrix,
 * with the static supplier price table as the last-resort public fallback.
 * Attaches matchMethod + matchScore so the UI can show a confidence badge per line.
 */
function buildRowsFromCatalog(
  quote: ExtractedQuote,
  prices: Supplier['prices'],
  entries: CatalogEntry[],
  discountByFamily: Record<import('@/features/catalog/types').Family, number>,
): Row[] {
  return quote.items.map((item) => {
    const v = visualForCategory(item.category)
    const m = matchItem(item, {
      entries,
      discountByFamily,
      publicTariffFallback: (it) => unitPriceFor(it, prices),
    })
    return {
      icon: v.icon,
      iconBg: v.iconBg,
      iconColor: v.iconColor,
      name: item.name,
      sub: item.description || item.reference || '',
      qtyNum: item.quantity,
      qtyUnit: item.unit,
      unitNum: m.unitPriceHT,
      category: item.category,
      uncertain: item.uncertain,
      matchMethod: m.method,
      matchScore: m.score,
    }
  })
}

function colorForCategory(category: string): string {
  return visualForCategory(category).catColor
}

// Wrapper requis par Next.js 16 : useSearchParams() doit vivre dans une
// frontière Suspense pour autoriser le pré-rendu statique de la route.
export default function QuotePage() {
  return (
    <Suspense fallback={null}>
      <QuotePageInner />
    </Suspense>
  )
}

function QuotePageInner() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const quoteIdParam = searchParams.get('id')

  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showApprove, setShowApprove] = useState(false)
  const [approved, setApproved]       = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('auto')
  const [isEditing, setIsEditing]     = useState(false)
  const [supplierAccounts, setSupplierAccounts] = useState<Record<string, SupplierAccount>>({})
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [extracted, setExtracted]     = useState<ExtractedQuote | null>(null)
  const [toc, setToc]                 = useState<ExtractedToc | null>(null)
  const [validation, setValidation]   = useState<QuoteValidation | null>(null)
  const [devisNumber, setDevisNumber] = useState<string | null>(null)
  const [quoteDbId, setQuoteDbId]     = useState<string | null>(null)
  const [savedPrices, setSavedPrices] = useState<Map<string, number> | null>(null)
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([])
  const [rows, setRows]               = useState<Row[]>(buildRows(SUPPLIERS[0].prices))
  const [draft, setDraft]             = useState<Row[]>(buildRows(SUPPLIERS[0].prices))
  const lastSavedRef = useRef<string>('')

  // Initial load: either from /api/quotes/[id] when ?id=... is in the URL
  // (the user reopened a draft from /projects), or from sessionStorage (just
  // came from /processing after a fresh extraction).
  useEffect(() => {
    let cancelled = false
    const saved    = sessionStorage.getItem(SESSION_KEY)
    const supplier = (saved && SUPPLIERS.find(s => s.id === saved)) || SUPPLIERS[0]
    setSelectedSupplierId(supplier.id)

    async function hydrate() {
      if (quoteIdParam) {
        const result = await fetchQuoteById(quoteIdParam)
        if (cancelled) return
        if (result) {
          setExtracted(result.stored.quote)
          setDevisNumber(result.stored.devisNumber)
          setQuoteDbId(result.detail.id)
          if (result.detail.supplierId) setSelectedSupplierId(result.detail.supplierId)
          if (result.detail.status === 'approved' || result.detail.status === 'sent') setApproved(true)
          // Persist the prices the user previously saved — these override the
          // catalog-derived defaults so reloading a quote shows exactly what
          // the user left it at.
          const priceMap = new Map<string, number>()
          for (const l of result.detail.lines) priceMap.set(`${l.idx}|${l.name}`, l.unitPrice)
          setSavedPrices(priceMap)
        }
        return
      }
      const stored = loadStoredQuote()
      if (cancelled) return
      if (stored && stored.quote.items.length > 0) setExtracted(stored.quote)
      if (stored?.toc) setToc(stored.toc)
      if (stored?.validation) setValidation(stored.validation)
      if (stored?.devisNumber) setDevisNumber(stored.devisNumber)
      if (stored?.quoteId) setQuoteDbId(stored.quoteId)
    }
    hydrate()
    return () => { cancelled = true }
  }, [quoteIdParam])

  useEffect(() => {
    setSupplierAccounts(getAllAccounts())
    return subscribeAccounts(s => setSupplierAccounts({ ...s }))
  }, [])

  // Load catalog entries for the selected supplier + refresh on catalog changes.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const list = selectedSupplierId && selectedSupplierId !== 'auto'
        ? await getEntriesBySupplier(selectedSupplierId)
        : []
      if (!cancelled) setCatalogEntries(list)
    }
    load()
    const unsub = subscribeCatalog(() => load())
    return () => { cancelled = true; unsub() }
  }, [selectedSupplierId])

  // Rebuild rows whenever extracted quote, supplier, catalog, or account discounts change.
  useEffect(() => {
    const supplier = SUPPLIERS.find(s => s.id === selectedSupplierId) || SUPPLIERS[0]
    const account  = supplierAccounts[selectedSupplierId]
    const discounts = account?.discountByFamily ?? emptyDiscounts()
    let built: Row[]
    if (extracted && extracted.items.length > 0) {
      built = buildRowsFromCatalog(extracted, supplier.prices, catalogEntries, discounts)
    } else {
      built = buildRows(supplier.prices)
    }
    // When reopening a persisted quote, replay the user's last saved prices
    // on top of the catalog defaults. Match key is `idx|name` so reordering
    // doesn't accidentally cross-apply.
    if (savedPrices && savedPrices.size > 0) {
      built = built.map((r, i) => {
        const override = savedPrices.get(`${i}|${r.name}`)
        return override !== undefined && override > 0 ? { ...r, unitNum: override } : r
      })
    }
    setRows(built)
    if (!isEditing) setDraft(built.map(r => ({ ...r })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted, selectedSupplierId, catalogEntries, supplierAccounts, savedPrices])

  // Totals are now computed strictly from extracted rows — no hidden
  // fallbacks. A CCTP with no MOE lines produces laborHT=0, which prompts
  // the plomber to add the missing labour by hand (rows are editable).
  const calcTotals = (r: Row[]) => {
    const normalizeCategory = (value: string) =>
      value
        .toUpperCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['’`]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()

    const isLabor    = (row: Row) => normalizeCategory(row.category) === "MAIN D'OEUVRE"
    const isChantier = (row: Row) => normalizeCategory(row.category) === 'RACCORDEMENTS'
    const lineTotal  = (row: Row) => row.qtyNum * row.unitNum

    const laborHT     = r.filter(isLabor).reduce((s, row) => s + lineTotal(row), 0)
    const chantierHT  = r.filter(isChantier).reduce((s, row) => s + lineTotal(row), 0)
    const materialsHT = r.filter(row => !isLabor(row) && !isChantier(row)).reduce((s, row) => s + lineTotal(row), 0)
    const subtotalHT  = materialsHT + laborHT + chantierHT
    const tva         = subtotalHT * TVA_RATE
    return { materialsHT, laborHT, chantierHT, subtotalHT, tva, totalTTC: subtotalHT + tva }
  }

  const totals       = useMemo(() => calcTotals(rows),  [rows])
  const draftTotals  = useMemo(() => calcTotals(draft), [draft])
  const activeTotals = isEditing ? draftTotals : totals

  const supplierComparisons = useMemo(() => {
    const qtys = rows.map(r => r.qtyNum)
    return SUPPLIERS.map(s => {
      // Comparison row always uses the public tariff fallback — we don't refetch
      // each supplier's catalog just for the comparison pane; the selected
      // supplier's real catalog prices already show in `rows`.
      const built = extracted ? buildRowsFromExtracted(extracted, s.prices) : buildRows(s.prices)
      return { ...s, computedTotal: built.reduce((sum, r, i) => sum + (qtys[i] ?? r.qtyNum) * r.unitNum, 0) }
    })
  }, [rows, extracted])

  const autoTotal = supplierComparisons.find(s => s.id === 'auto')!.computedTotal

  const selectSupplier = (s: Supplier) => {
    if (s.id === selectedSupplierId) return
    setSelectedSupplierId(s.id)
    setToast({ message: `Prix ${s.name} appliqués.`, type: 'success' })
  }

  const startEdit  = () => { setDraft(rows.map(r => ({ ...r }))); setIsEditing(true) }
  const cancelEdit = () => { setDraft(rows.map(r => ({ ...r }))); setIsEditing(false) }
  const saveEdit   = async () => {
    const newRows = draft.map(r => ({ ...r }))
    setRows(newRows)
    setIsEditing(false)
    setToast({ message: 'Chiffrage mis à jour.', type: 'success' })
    await persistRows(newRows)
  }

  // Push the current rows + totals + supplier to the DB. Best-effort:
  // failure shows a toast but doesn't roll back the local state.
  async function persistRows(currentRows: Row[], opts: { status?: 'draft' | 'approved' } = {}) {
    if (!quoteDbId) return
    const totals = calcTotals(currentRows)
    const payload = {
      supplierId: selectedSupplierId,
      vatRate: TVA_RATE,
      totalHT: totals.subtotalHT,
      totalTTC: totals.totalTTC,
      ...(opts.status ? { status: opts.status } : {}),
      lines: currentRows.map((r, i) => ({
        idx: i,
        category: r.category,
        name: r.name,
        description: r.sub || '',
        reference: '',
        quantity: r.qtyNum,
        unit: r.qtyUnit,
        unitPrice: r.unitNum,
        lineTotalHT: r.qtyNum * r.unitNum,
        uncertain: !!r.uncertain,
      })),
    }
    const signature = JSON.stringify(payload)
    if (signature === lastSavedRef.current) return
    lastSavedRef.current = signature
    const ok = await patchQuote(quoteDbId, payload)
    if (!ok) {
      setToast({ message: 'Sauvegarde échouée — réessayez.', type: 'error' })
    }
  }

  const updateDraft = (idx: number, field: 'qtyNum' | 'unitNum', raw: string) => {
    const val = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0
    setDraft(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  const handleDownload = () => {
    setDownloading(true)
    setTimeout(() => {
      try {
        const currentSupplier = SUPPLIERS.find(s => s.id === selectedSupplierId) || SUPPLIERS[0]
        generateQuotePdf({
          devisNumber: devisNumber ?? undefined,
          rows: rows.map(r => ({
            category: r.category,
            name: r.name,
            sub: r.sub,
            qtyNum: r.qtyNum,
            qtyUnit: r.qtyUnit,
            unitNum: r.unitNum,
          })),
          project: {
            name:    extracted?.projectName || 'Chiffrage plomberie',
            lot:     extracted?.lot         || 'Lot 09 — Plomberie · Chauffage · VMC',
            client:  extracted?.client      || undefined,
            summary: extracted?.summary     || undefined,
          },
          supplier: {
            name:         currentSupplier.name,
            deliveryDays: currentSupplier.deliveryDays,
          },
          totals: {
            materialsHT:  totals.materialsHT,
            laborHT:      totals.laborHT,
            chantierHT:   totals.chantierHT,
            subtotalHT:   totals.subtotalHT,
            vatRate:      TVA_RATE,
            tva:          totals.tva,
            totalTTC:     totals.totalTTC,
          },
        })
        setToast({ message: 'PDF téléchargé.', type: 'success' })
      } catch {
        setToast({ message: 'Erreur PDF. Veuillez réessayer.', type: 'error' })
      } finally {
        setDownloading(false)
      }
    }, 400)
  }

  const handleApprove = async () => {
    setShowApprove(false)
    setApproved(true)
    setToast({ message: 'Chiffrage approuvé.', type: 'success' })
    await persistRows(rows, { status: 'approved' })
  }

  const displayRows       = isEditing ? draft : rows
  const maxTotal          = Math.max(...displayRows.map(r => r.qtyNum * r.unitNum), 1)
  const currentSupplier   = SUPPLIERS.find(s => s.id === selectedSupplierId)!
  const categories        = [...new Set(displayRows.map(r => r.category))]

  return (
    <>
      <main className="pb-32 px-6 max-w-7xl mx-auto technical-grid">

        {isEditing && (
          <div className="mb-6 flex items-center gap-3 px-5 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
            <span className="text-xs font-bold uppercase tracking-widest">{t.quote.editModeBanner}</span>
            <div className="ml-auto flex gap-2">
              <button onClick={cancelEdit} className="px-4 py-1.5 rounded-lg border border-amber-500/20 text-xs font-bold text-amber-400/70 hover:text-amber-400 transition-colors">{t.common.cancel}</button>
              <button onClick={saveEdit}   className="px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition-colors">{t.quote.save}</button>
            </div>
          </div>
        )}

        <Animate variant="fade-up">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-primary font-mono text-xs tracking-widest uppercase font-bold">{t.quote.generated}</span>
                <span className="h-px w-6 bg-outline-variant/40" />
                <span className="text-tertiary font-mono text-xs uppercase truncate">{extracted?.lot || 'Lot 09 — Plomberie · Chauffage · VMC'}</span>
                {extracted && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    {t.quote.confidence} {Math.round(extracted.confidence * 100)}%
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tighter text-on-surface">
                {extracted?.projectName || (<>Votre chiffrage <span className="text-primary-container">#PRJ-829</span></>)}
              </h1>
              <p className="mt-2 text-on-surface-variant max-w-xl text-base leading-relaxed">
                {extracted?.summary || t.quote.extractedFallback}
              </p>
              {extracted && extracted.notes.length > 0 && (
                <ul className="mt-3 space-y-1 max-w-xl">
                  {extracted.notes.slice(0, 3).map((n, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-400/80">
                      <span className="material-symbols-outlined text-[14px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-3 shrink-0 flex-wrap">
              {isEditing ? (
                <>
                  <button onClick={cancelEdit} className="px-5 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface-variant text-sm font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">close</span>{t.common.cancel}
                  </button>
                  <button onClick={saveEdit} className="px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">check</span>{t.quote.save}
                  </button>
                </>
              ) : (
                <button onClick={startEdit} className="px-5 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">edit</span>{t.quote.edit}
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={downloading || isEditing}
                className="px-5 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {downloading ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> : <span className="material-symbols-outlined text-sm">download</span>}
                {downloading ? t.quote.generating : t.quote.download}
              </button>
            </div>
          </div>
        </Animate>

        {toc && (
          <Animate variant="fade-up" delay={40}>
            <DetectedLotsPanel toc={toc} />
          </Animate>
        )}

        {validation && (
          <Animate variant="fade-up" delay={50}>
            <ValidationPanel validation={validation} />
          </Animate>
        )}

        <Animate variant="fade-up" delay={60} as="section" className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <span className="text-primary font-headline font-bold tracking-widest text-[10px] uppercase">Fournisseur</span>
              <h2 className="font-headline font-bold text-lg tracking-tight text-on-surface mt-0.5">
                Source des prix
                <span className="ml-3 text-sm font-normal text-on-surface-variant font-body">— {currentSupplier.name}</span>
              </h2>
            </div>
            <p className="text-[10px] text-on-surface-variant hidden md:block">Changer de fournisseur met à jour tous les prix</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {supplierComparisons.map((s) => {
              const isSelected = s.id === selectedSupplierId
              const diff       = s.computedTotal - autoTotal
              const diffPct    = autoTotal > 0 ? (diff / autoTotal) * 100 : 0
              const isCheaper  = diff < 0
              const isBaseline = s.id === 'auto'
              return (
                <button
                  key={s.id}
                  onClick={() => selectSupplier(s)}
                  disabled={isEditing}
                  className={`relative flex-shrink-0 w-44 p-4 rounded-2xl border text-left transition-all duration-300 ${isSelected ? 'border-primary bg-surface-container shadow-[0_0_24px_rgba(212,255,58,0.18)]' : 'border-white/5 bg-surface-container hover:border-primary/30 hover:bg-surface-container-high'} ${isEditing ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1", fontSize: '12px' }}>check</span>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 font-headline font-black text-xs transition-colors ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'}`}>{s.initials}</div>
                  <div className="font-headline font-bold text-sm text-on-surface leading-tight">{s.name}</div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5 mb-3 truncate">{s.sub}</div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${s.tierColor}`}>{s.tier}</span>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-on-surface-variant">
                    <span>★ {s.rating}</span>
                    <span>{s.deliveryDays}j livraison</span>
                  </div>
                  <div className={`mt-2.5 text-[10px] font-bold font-mono ${isBaseline ? 'text-primary' : isCheaper ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isBaseline ? '◆ RÉFÉRENCE' : `${isCheaper ? '▼' : '▲'} ${fmtEur(Math.abs(diff))} (${Math.abs(diffPct).toFixed(1)}%)`}
                  </div>
                </button>
              )
            })}
          </div>
        </Animate>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">

            <Animate variant="fade-up" as="section" className={`rounded-2xl overflow-hidden border transition-all duration-300 ${isEditing ? 'border-amber-500/25 bg-surface-container-low shadow-[0_0_0_1px_rgba(245,158,11,0.15)]' : 'bg-surface-container-low border-white/5'}`}>
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface-container">
                <div>
                  <h3 className="font-headline font-bold text-lg tracking-tight">Postes du chiffrage</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">{isEditing ? 'Cliquez sur une quantité ou un prix pour modifier' : `Prix catalogue ${currentSupplier.name} · Chiffrage conforme poste par poste`}</p>
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 ${isEditing ? 'text-amber-400' : 'text-emerald-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isEditing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {isEditing ? 'ÉDITION' : 'CONFORME'}
                </span>
              </div>
              <div className="p-2 overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-outline">
                      <th className="px-4 py-2 font-medium">Désignation</th>
                      <th className="px-4 py-2 font-medium">Qté</th>
                      <th className="px-4 py-2 font-medium">Prix unit. HT</th>
                      <th className="px-4 py-2 font-medium">Part</th>
                      <th className="px-4 py-2 font-medium text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const catRows = displayRows.map((r, idx) => ({ ...r, idx })).filter(r => r.category === cat)
                      const catTotal = catRows.reduce((s, r) => s + r.qtyNum * r.unitNum, 0)
                      return (
                        <Fragment key={`cat-${cat}`}>
                          <tr>
                            <td colSpan={5} className="px-4 pt-5 pb-2">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${colorForCategory(cat)}`}>{cat}</span>
                                <span className={`text-[10px] font-mono ${colorForCategory(cat)}`}>sous-total : {fmtEur(catTotal)}</span>
                              </div>
                              <div className="h-px bg-outline-variant/20 mt-2" />
                            </td>
                          </tr>
                          {catRows.map((m) => {
                            const rowTotal = m.qtyNum * m.unitNum
                            const pct      = Math.round((rowTotal / maxTotal) * 100)
                            return (
                              <tr key={`${m.idx}-${m.name}`} className={`group transition-colors ${isEditing ? 'hover:bg-amber-500/5' : 'hover:bg-surface-container-high'}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center shrink-0`}>
                                      <span className={`material-symbols-outlined text-sm ${m.iconColor}`}>{m.icon}</span>
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="text-sm font-semibold text-on-surface">{m.name}</div>
                                        {m.matchMethod && <MatchBadge method={m.matchMethod} score={m.matchScore ?? 0} />}
                                      </div>
                                      <div className="text-[10px] text-outline max-w-[240px] truncate">{m.sub}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5">
                                      <input type="number" min="0" step="1" value={m.qtyNum} onChange={e => updateDraft(m.idx, 'qtyNum', e.target.value)} className="w-20 bg-surface-container border border-amber-500/30 rounded-lg px-2 py-1 text-sm font-mono text-on-surface focus:outline-none focus:border-amber-500/60 transition-all" />
                                      <span className="text-xs text-on-surface-variant">{m.qtyUnit}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-mono text-on-surface-variant">{m.qtyNum.toLocaleString('fr-FR')} {m.qtyUnit}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input type="number" min="0" step="0.01" value={m.unitNum.toFixed(2)} onChange={e => updateDraft(m.idx, 'unitNum', e.target.value)} className="w-28 bg-surface-container border border-amber-500/30 rounded-lg px-2 py-1 text-sm font-mono text-on-surface focus:outline-none focus:border-amber-500/60 transition-all" />
                                      <span className="text-xs text-on-surface-variant">€</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-mono text-on-surface-variant">{fmtEur(m.unitNum)}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1 w-16 bg-surface-container rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${isEditing ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[10px] text-outline font-mono">{pct}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`text-sm font-mono font-bold transition-colors ${isEditing ? 'text-amber-400' : 'text-primary'}`}>{fmtEur(rowTotal)}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                    <tr>
                      <td colSpan={4} className="px-4 pt-6 pb-3"><div className="h-px bg-outline-variant/30" /></td>
                      <td className="px-4 pt-6 pb-3 text-right"><div className="h-px bg-outline-variant/30" /></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 pb-4"><span className="text-xs font-black uppercase tracking-widest text-on-surface">TOTAL MATÉRIAUX HT</span></td>
                      <td className="px-4 pb-4 text-right"><span className="font-mono font-black text-on-surface text-base">{fmtEur(activeTotals.materialsHT)}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Animate>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Animate variant="slide-left" className="bg-surface-container-low rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-secondary text-sm">engineering</span>
                  </div>
                  <h3 className="font-headline font-bold text-base">Main d&apos;oeuvre</h3>
                </div>
                <div className="space-y-5">
                  {[
                    { label: 'Pose plomberie sanitaire', detail: 'EF/EC + évacuations', pct: 60, amount: fmtEur(5040) },
                    { label: 'Pose chauffage + VMC',     detail: 'Gaz + radiateurs + thermostat', pct: 30, amount: fmtEur(2520) },
                    { label: 'Finitions + essais',       detail: 'COPREC + mise en service', pct: 10, amount: fmtEur(840) },
                  ].map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-on-surface-variant">{row.label}</span>
                        <span className="text-xs font-mono text-on-surface">{row.amount}</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-secondary transition-all duration-700" style={{ width: `${row.pct}%` }} />
                      </div>
                      <div className="text-[10px] text-outline mt-1">{row.detail}</div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-outline">Total MO</span>
                    <span className="text-lg font-mono font-bold text-secondary">{fmtEur(activeTotals.laborHT)}</span>
                  </div>
                </div>
              </Animate>

              <Animate variant="slide-right" delay={80} className="bg-surface-container-low rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-tertiary text-sm">construction</span>
                  </div>
                  <h3 className="font-headline font-bold text-base">Chantier & Essais</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'Branchement provisoire chantier', value: 'Forfait',      amount: fmtEur(380) },
                    { label: 'Essais COPREC réseaux eau',       value: 'PV inclus',    amount: fmtEur(450) },
                    { label: 'Mise en service GRDF',            value: 'Par logement', amount: fmtEur(280) },
                    { label: 'Nettoyage & enlèvement gravois',  value: 'Forfait',      amount: fmtEur(90)  },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center">
                      <div>
                        <span className="text-xs text-on-surface-variant">{row.label}</span>
                        <div className="text-[10px] text-outline">{row.value}</div>
                      </div>
                      <span className="text-sm font-mono text-on-surface">{row.amount}</span>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs uppercase tracking-widest text-outline">Total chantier</span>
                    <span className="text-lg font-mono font-bold text-tertiary">{fmtEur(activeTotals.chantierHT)}</span>
                  </div>
                </div>
              </Animate>
            </section>

            <Animate variant="fade-up" delay={100} as="section" className="bg-surface-container-low rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-primary text-sm">hub</span>
                <h3 className="font-headline font-bold text-base">Réseau fournisseurs</h3>
                <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Prix catalogue public</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['CEDEO', 'Pum Plastique', 'Richardson', 'Marplin'].map(v => {
                  const isActive = currentSupplier.name === v || currentSupplier.name === 'IA Optimisé'
                  return (
                    <div key={v} className={`px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 transition-colors ${isActive ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container border-white/5 text-on-surface-variant'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-primary animate-pulse' : 'bg-emerald-500'}`} />
                      {v}
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-4">
                💡 {t.quote.supplierHint}
              </p>
            </Animate>
          </div>

          <Animate variant="slide-right" delay={150} className="lg:col-span-4 space-y-6">
            <div className={`glass-panel rounded-3xl p-8 relative overflow-hidden transition-all duration-300 ${isEditing ? 'shadow-[0_0_0_1px_rgba(245,158,11,0.2)]' : 'glow-primary'}`}>
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-container/15 blur-[60px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-headline font-black text-[9px] ${selectedSupplierId === 'auto' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'}`}>{currentSupplier.initials}</div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Total du projet</span>
                </div>
                <div className={`text-4xl font-headline font-black tracking-tighter mb-1 transition-colors ${isEditing ? 'text-amber-400' : 'text-on-surface'}`}>
                  {fmtEur(activeTotals.totalTTC).split(',')[0]}
                  <span className={`text-2xl ${isEditing ? 'text-amber-400/60' : 'text-primary-fixed-dim'}`}>,{fmtEur(activeTotals.totalTTC).split(',')[1]}</span>
                </div>
                <div className="flex items-center gap-2 mb-6">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${isEditing ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <span className="text-xs text-outline">{isEditing ? 'Aperçu — non enregistré' : 'Prix garanti 14 jours'}</span>
                </div>
                {approved ? (
                  <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-headline font-bold text-base rounded-2xl flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Chiffrage approuvé
                  </div>
                ) : (
                  <button disabled={isEditing} onClick={() => setShowApprove(true)} className="w-full py-4 bg-primary-container text-on-primary-container font-headline font-bold text-base rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary-container/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100">
                    Approuver & envoyer
                  </button>
                )}
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-xs text-outline"><span>Matériaux HT</span><span className={`font-mono ${isEditing ? 'text-amber-400/80' : ''}`}>{fmtEur(activeTotals.materialsHT)}</span></div>
                  <div className="flex justify-between text-xs text-outline"><span>Main d&apos;oeuvre</span><span className={`font-mono ${isEditing ? 'text-amber-400/80' : ''}`}>{fmtEur(activeTotals.laborHT)}</span></div>
                  <div className="flex justify-between text-xs text-outline"><span>Chantier & essais</span><span className={`font-mono ${isEditing ? 'text-amber-400/80' : ''}`}>{fmtEur(activeTotals.chantierHT)}</span></div>
                  <div className="border-t border-white/5 pt-2 flex justify-between text-xs text-outline"><span>Total HT</span><span className={`font-mono font-bold ${isEditing ? 'text-amber-400/80' : 'text-on-surface'}`}>{fmtEur(activeTotals.subtotalHT)}</span></div>
                  <div className="flex justify-between text-xs text-outline"><span>TVA (20%)</span><span className={`font-mono ${isEditing ? 'text-amber-400/80' : ''}`}>{fmtEur(activeTotals.tva)}</span></div>
                  <div className="border-t border-white/5 pt-2 flex justify-between text-xs"><span className="font-bold text-on-surface">TOTAL TTC</span><span className={`font-mono font-black text-base ${isEditing ? 'text-amber-400' : 'text-primary'}`}>{fmtEur(activeTotals.totalTTC)}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-outline">Conformité chiffrage</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">✓ CONFORME</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Poste par poste',      ok: true },
                  { label: 'Prix unitaires HT',     ok: true },
                  { label: 'TVA 20% appliquée',     ok: true },
                  { label: 'Fournisseur identifié', ok: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-xs text-on-surface">{item.label}</span>
                  </div>
                ))}
                {(() => {
                  const acc = supplierAccounts[selectedSupplierId]
                  const isConnected = acc?.status === 'connected'
                  const channelLabel =
                    acc?.channel === 'fabdis'      ? 'Catalogue FAB-DIS' :
                    acc?.channel === 'invoice_ocr' ? 'Factures OCR' :
                    acc?.channel === 'discount'    ? 'Remise négociée' :
                    acc?.channel === 'extranet'    ? 'Extranet' : ''
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-sm ${isConnected ? 'text-emerald-400' : 'text-outline'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isConnected ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span className={`text-xs ${isConnected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {isConnected ? `${currentSupplier.name} · ${channelLabel}` : 'Compte fournisseur'}
                      </span>
                      {!isConnected && selectedSupplierId !== 'auto' && (
                        <button
                          onClick={() => setShowConnectModal(true)}
                          className="ml-auto text-[10px] font-bold uppercase tracking-widest text-primary hover:text-white transition-colors"
                        >
                          Connecter
                        </button>
                      )}
                      {!isConnected && selectedSupplierId === 'auto' && (
                        <span className="ml-auto text-[9px] text-outline uppercase tracking-widest">Multi-comptes</span>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Match quality strip — show how prices were obtained across the quote */}
              {(() => {
                const priced = rows.filter(r => r.matchMethod)
                if (priced.length === 0) return null
                const highCount   = priced.filter(r => r.matchMethod && (r.matchMethod === 'exact_code' || r.matchMethod === 'ean' || r.matchMethod === 'normalized_label')).length
                const mediumCount = priced.filter(r => r.matchMethod === 'fuzzy_trigram' || r.matchMethod === 'discount_fallback').length
                const lowCount    = priced.filter(r => r.matchMethod === 'public_fallback').length
                const total = priced.length
                const pct = (n: number) => total ? Math.round((n / total) * 100) : 0
                return (
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Origine des prix</span>
                      <a href="/catalog" className="text-[9px] font-bold uppercase tracking-widest text-primary hover:text-white transition-colors">Mon catalogue →</a>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden flex">
                      {highCount   > 0 && <div className="h-full bg-primary"      style={{ width: `${pct(highCount)}%` }} />}
                      {mediumCount > 0 && <div className="h-full bg-amber-400"    style={{ width: `${pct(mediumCount)}%` }} />}
                      {lowCount    > 0 && <div className="h-full bg-surface-container-highest" style={{ width: `${pct(lowCount)}%` }} />}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-primary">{highCount} catalogue</span>
                      <span className="text-amber-400">{mediumCount} heuristique</span>
                      <span className="text-on-surface-variant">{lowCount} tarif public</span>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-6 border border-white/5 space-y-5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-outline">Calendrier de commande</h4>
              {[
                { dot: 'bg-primary',     title: 'Chiffrage approuvé',         sub: 'Jour 0',     done: approved },
                { dot: 'bg-secondary',   title: 'Fournisseur confirmé',   sub: '+ 24h',      done: false    },
                { dot: 'bg-tertiary',    title: 'Matériaux expédiés',     sub: '+ 72h',      done: false    },
                { dot: 'bg-emerald-500', title: 'Livraison sur chantier', sub: '+ 5 jours',  done: false    },
              ].map((item, i) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.done ? 'bg-emerald-500' : item.dot} ${i === 0 && !item.done ? 'animate-pulse' : ''}`} />
                  <div>
                    <div className="text-xs font-bold text-on-surface">{item.title}</div>
                    <div className="text-[10px] text-outline">{item.sub}</div>
                  </div>
                  {item.done && <span className="ml-auto text-[10px] text-emerald-400 font-mono">✓</span>}
                </div>
              ))}
            </div>
          </Animate>
        </div>
      </main>

      {showApprove && (
        <Modal title={t.quote.confirmTitle} onClose={() => setShowApprove(false)}>
          <div className="space-y-6">
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">{t.quote.confirmLot}</span><span className="text-on-surface font-semibold">09 — Plomberie · Chauffage · VMC</span></div>
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">{t.quote.confirmSupplier}</span><span className="text-on-surface font-semibold">{currentSupplier.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">{t.quote.confirmTotalHT}</span><span className="text-on-surface font-semibold font-mono">{fmtEur(totals.subtotalHT)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-on-surface-variant">{t.quote.confirmTotalTTC}</span><span className="text-primary font-bold font-mono">{fmtEur(totals.totalTTC)}</span></div>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">{t.quote.confirmDesc}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowApprove(false)} className="flex-1 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold hover:bg-surface-container-high transition-all">{t.common.cancel}</button>
              <button onClick={handleApprove} className="flex-1 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold hover:shadow-[0_0_20px_rgba(212,255,58,0.4)] transition-all">{t.common.confirm}</button>
            </div>
          </div>
        </Modal>
      )}

      {showConnectModal && (
        <SupplierConnectModal
          initialSupplierId={selectedSupplierId !== 'auto' ? selectedSupplierId : undefined}
          onClose={() => setShowConnectModal(false)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}

/** Per-line confidence badge. Colour reflects how the price was obtained. */
function MatchBadge({ method, score }: { method: MatchMethod; score: number }) {
  const tier  = methodTier(method)
  const label = methodLabel(method)
  const cls   =
    tier === 'high'   ? 'bg-primary/10 text-primary' :
    tier === 'medium' ? 'bg-amber-400/10 text-amber-400' :
                        'bg-white/5 text-on-surface-variant'
  const icon =
    tier === 'high'   ? 'verified' :
    tier === 'medium' ? 'bolt' :
                        'help'
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${cls}`} title={`${label} · score ${Math.round(score * 100)}%`}>
      <span className="material-symbols-outlined text-[11px]">{icon}</span>
      {label}
    </span>
  )
}

