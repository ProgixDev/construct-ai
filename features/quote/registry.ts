// Persistent list of saved quotes. Every row is tagged with `orgId` (who
// owns it) and `createdBy` (the user who produced it). These two fields
// drive visibility:
//
//   admin  — sees every quote
//   owner  — sees every quote where orgId matches their primary org
//   member — sees every quote where orgId matches AND createdBy matches
//
// Seeded with a small spread across subscriber + service-client orgs so
// the role switcher shows a meaningful diff.

'use client'

import { ADMIN_ORG_ID, DEFAULT_SUBSCRIBER_ORG_ID } from '@/features/auth/orgs'
import { getCurrentUser, type User } from '@/features/auth/currentUser'

const STORAGE_KEY = 'pc_quotes_v1'

export type QuoteStatus = 'finalisé' | 'brouillon' | 'envoyé' | 'archivé'

export type Quote = {
  id: string
  orgId: string
  /** userId of the person who created the quote. */
  createdBy: string
  projectName: string
  lot: string
  /** fr-FR date string — kept as string so the list doesn't bounce across TZ. */
  date: string
  supplier: string
  supplierInitials: string
  status: QuoteStatus
  lineItems: number
  totalHT: number
  sector: string
  /** For service-client quotes: fee Jean-Marc charges + issued-invoice metadata. */
  billing?: {
    mode: 'per_quote' | 'included'
    /** Fee HT (before VAT) Jean-Marc invoices for running this quote. */
    amount?: number
    /** French VAT rate applied on the invoice (20 = 20%). */
    vatRate?: number
    /** Assigned when the invoice is issued (e.g. "F-2026-0007"). */
    invoiceNumber?: string
    /** Epoch ms when the invoice was issued. */
    invoicedAt?: number | null
    /** Free-text line shown on the invoice body. */
    note?: string
  }
}

const SEED: Quote[] = [
  // Morel Plomberie — owner's own quotes
  { id: 'q-001', orgId: DEFAULT_SUBSCRIBER_ORG_ID, createdBy: 'u-owner',  projectName: 'Résidence Les Pins — Réhabilitation', lot: 'Lot 09 — Plomberie · Chauffage · VMC', date: '10/04/2026', supplier: 'CEDEO',        supplierInitials: 'CED', status: 'finalisé',  lineItems: 24, totalHT: 28450, sector: 'Plomberie' },
  { id: 'q-002', orgId: DEFAULT_SUBSCRIBER_ORG_ID, createdBy: 'u-owner',  projectName: 'Copropriété Bellevue — Neuf',         lot: 'Lot 09 — Plomberie · Sanitaires',      date: '05/04/2026', supplier: 'Pum Plastique', supplierInitials: 'PP',  status: 'envoyé',    lineItems: 31, totalHT: 42180, sector: 'Plomberie' },
  // Morel Plomberie — member's quote (should be invisible to owner? no — owner sees members too)
  { id: 'q-003', orgId: DEFAULT_SUBSCRIBER_ORG_ID, createdBy: 'u-member', projectName: 'TERRALIA Verdun — 27 logements',      lot: 'Lot 09 — Plomberie · Chauffage · VMC', date: '28/03/2026', supplier: 'IA Optimisé', supplierInitials: 'IA',  status: 'brouillon', lineItems: 47, totalHT: 89600, sector: 'CVC' },

  // Service-client quotes — created by Jean-Marc on behalf of clients
  {
    id: 'q-101', orgId: 'org-sarl-dubois', createdBy: 'u-admin',
    projectName: 'SARL Dubois — 18 logements mairie', lot: 'Lot 09 — Plomberie · Sanitaires',
    date: '02/04/2026', supplier: 'CEDEO', supplierInitials: 'CED', status: 'finalisé',
    lineItems: 36, totalHT: 54820, sector: 'Plomberie',
    billing: { mode: 'per_quote', amount: 650, invoicedAt: Date.parse('2026-04-03') },
  },
  {
    id: 'q-102', orgId: 'org-sarl-dubois', createdBy: 'u-admin',
    projectName: 'SARL Dubois — Révision variante chaudière', lot: 'Lot 09 — Chauffage gaz collectif',
    date: '09/04/2026', supplier: 'Marplin', supplierInitials: 'MP', status: 'envoyé',
    lineItems: 11, totalHT: 18940, sector: 'CVC',
    billing: { mode: 'per_quote', amount: 290, invoicedAt: null },
  },
  {
    id: 'q-201', orgId: 'org-bati-lorraine', createdBy: 'u-admin',
    projectName: 'Bâti Lorraine — EHPAD Pompey', lot: 'Lot 09 — Plomberie · VMC hygro B',
    date: '13/04/2026', supplier: 'Richardson', supplierInitials: 'RC', status: 'brouillon',
    lineItems: 52, totalHT: 112300, sector: 'Plomberie',
    billing: { mode: 'per_quote', amount: 1150, invoicedAt: null },
  },
]

type Listener = (quotes: Quote[]) => void
const listeners = new Set<Listener>()

// In-memory cache of API-backed quotes. When non-null, these replace the
// localStorage seed in `getAllQuotes()` — i.e. once the API has responded,
// the page shows real DB rows and the local registry becomes dormant.
let apiQuotes: Quote[] | null = null
let hydrating = false

type ApiQuoteSummary = {
  id: string
  devisNumber: string
  projectName: string
  lot: string
  client: string
  sector: string
  fileName: string
  supplierId: string
  status: 'draft' | 'approved' | 'sent' | 'archived'
  totalHT: number
  totalTTC: number
  createdAt: string
  updatedAt: string
  approvedAt: string | null
  sentAt: string | null
  cctpUploadId: string | null
  createdBy: string | null
  lineCount: number
}

function statusFromApi(s: ApiQuoteSummary['status']): QuoteStatus {
  return s === 'approved' || s === 'sent' ? 'finalisé'
       : s === 'archived'                  ? 'archivé'
       : 'brouillon'
}

function fmtDateFr(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR')
  } catch {
    return iso.slice(0, 10)
  }
}

function mapApiToQuote(api: ApiQuoteSummary): Quote {
  return {
    id: api.id,
    orgId: DEFAULT_SUBSCRIBER_ORG_ID,
    createdBy: api.createdBy ?? 'u-owner',
    projectName: api.projectName,
    lot: api.lot || '—',
    date: fmtDateFr(api.createdAt),
    supplier: api.supplierId === 'auto' ? 'IA Optimisé' : api.supplierId,
    supplierInitials: (api.supplierId === 'auto' ? 'IA' : api.supplierId.slice(0, 3)).toUpperCase(),
    status: statusFromApi(api.status),
    lineItems: api.lineCount ?? 0,
    totalHT: api.totalHT,
    sector: api.sector || 'Plomberie',
  }
}

export async function hydrateFromApi(): Promise<void> {
  if (typeof window === 'undefined') return
  if (hydrating) return
  hydrating = true
  try {
    const res = await fetch('/api/quotes', { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json() as { quotes: ApiQuoteSummary[] }
    apiQuotes = data.quotes.map(mapApiToQuote)
    listeners.forEach(fn => fn(apiQuotes!))
  } catch {
    // Network failure: registry stays on local seed silently.
  } finally {
    hydrating = false
  }
}

function safeLoad(): Quote[] {
  if (apiQuotes) return apiQuotes
  if (typeof window === 'undefined') return SEED
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED))
      return SEED
    }
    return JSON.parse(raw) as Quote[]
  } catch {
    return SEED
  }
}

function safeSave(quotes: Quote[]) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes)) } catch {}
  listeners.forEach(fn => fn(quotes))
}

export function getAllQuotes(): Quote[] {
  return safeLoad()
}

export function subscribeQuotes(cb: Listener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function addQuote(q: Quote): void {
  safeSave([q, ...safeLoad()])
}

export function updateQuote(id: string, patch: Partial<Quote>): void {
  const list = safeLoad()
  const idx = list.findIndex(q => q.id === id)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...patch }
  safeSave(list)
}

export function deleteQuote(id: string): void {
  safeSave(safeLoad().filter(q => q.id !== id))
}

/**
 * Scope a quote list to what the user is allowed to see in the currently
 * active org context.
 *
 * admin  — no filter when viewing admin org; otherwise filter by activeOrgId.
 * owner  — filter by primary org.
 * member — filter by primary org AND createdBy = self.
 */
export function visibleQuotes(all: Quote[], user: User = getCurrentUser()): Quote[] {
  if (user.role === 'admin') {
    // Admin in their own ops workspace: show every quote across every org.
    if (user.activeOrgId === user.primaryOrgId) return all
    // Admin "acting as" a client: scope to that client.
    return all.filter(q => q.orgId === user.activeOrgId)
  }
  if (user.role === 'owner') {
    return all.filter(q => q.orgId === user.primaryOrgId)
  }
  // member
  return all.filter(q => q.orgId === user.primaryOrgId && q.createdBy === user.id)
}

export function quotesForOrg(orgId: string): Quote[] {
  return safeLoad().filter(q => q.orgId === orgId)
}

/**
 * Next invoice number, using the F-YYYY-NNNN convention. Takes max seq seen
 * this year and increments — strictly monotonic so reissuing never collides,
 * even after a deletion. When the backend lands, a DB sequence replaces this.
 */
export function getNextInvoiceNumber(now: Date = new Date()): string {
  const year = now.getFullYear()
  const prefix = `F-${year}-`
  const maxSeq = safeLoad()
    .map(q => q.billing?.invoiceNumber)
    .filter((n): n is string => !!n && n.startsWith(prefix))
    .map(n => parseInt(n.slice(prefix.length), 10))
    .filter(n => Number.isFinite(n))
    .reduce((m, n) => Math.max(m, n), 0)
  return `${prefix}${(maxSeq + 1).toString().padStart(4, '0')}`
}
