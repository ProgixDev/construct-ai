// Tiny client-side store that bridges UploadModal → /processing → /quote.
//
// UploadModal:       start(file) — kicks off the POST /api/extract
// /processing page:  subscribe()  — renders live status, redirects when ready
// /quote page:       load()       — reads the final ExtractedQuote
//
// No external deps; module state survives client-side navigations.

import type { ExtractedQuote, ExtractedToc, QuoteValidation } from './types'
import { recordQuoteUsed } from '@/features/subscription/store'
import { getAiPreference } from '@/features/settings/aiPreference'

const RESULT_KEY     = 'df_quote_result'
const FILE_KEY       = 'df_quote_file_name'
const TOC_KEY        = 'df_quote_toc'
const VALIDATION_KEY = 'df_quote_validation'
const DEVIS_KEY      = 'df_quote_devis_number'
const QUOTE_ID_KEY   = 'df_quote_db_id'
const UPLOAD_ID_KEY  = 'df_quote_upload_id'

// Human-friendly devis number, generated once per extraction so every PDF
// re-export of the same quote carries the same reference (legal requirement
// for a French devis — the number must be stable once issued).
function makeDevisNumber(): string {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `DV-${yy}${mm}${dd}-${rand}`
}

export type ExtractionStage =
  | 'reading'     // uploading file / starting request
  | 'parsing'     // LLM is running
  | 'structuring' // shaping JSON
  | 'pricing'     // applying supplier prices
  | 'ready'
  | 'error'

export type ExtractionState =
  | { status: 'idle' }
  | { status: 'running'; fileName: string; stage: ExtractionStage; progress: number }
  | { status: 'done';    fileName: string; quote: ExtractedQuote; toc: ExtractedToc | null; validation: QuoteValidation | null; devisNumber: string; quoteId?: string | null }
  | { status: 'error';   fileName: string; message: string }

type Listener = (s: ExtractionState) => void

let state: ExtractionState = { status: 'idle' }
const listeners = new Set<Listener>()

function emit() { listeners.forEach(l => l(state)) }
function set(next: ExtractionState) { state = next; emit() }

export function getState()               { return state }
export function subscribe(l: Listener)   { listeners.add(l); l(state); return () => listeners.delete(l) }

// Stage → progress mapping used by the processing UI.
// Rough time-based estimate: the LLM call is the slow part.
const STAGE_PROGRESS: Record<ExtractionStage, number> = {
  reading:     8,
  parsing:     30,
  structuring: 75,
  pricing:     92,
  ready:       100,
  error:       0,
}

export async function startExtraction(file: File) {
  // Clear any previous result
  try {
    sessionStorage.removeItem(RESULT_KEY)
    sessionStorage.removeItem(FILE_KEY)
    sessionStorage.removeItem(TOC_KEY)
    sessionStorage.removeItem(VALIDATION_KEY)
    sessionStorage.removeItem(DEVIS_KEY)
    sessionStorage.removeItem(QUOTE_ID_KEY)
    sessionStorage.removeItem(UPLOAD_ID_KEY)
  } catch {}
  set({ status: 'running', fileName: file.name, stage: 'reading', progress: STAGE_PROGRESS.reading })

  const form = new FormData()
  form.append('file', file)

  // Honor the org's AI-engine preference if set. Server still falls back
  // to EXTRACTION_PROVIDER env var when neither provider nor model is sent.
  const pref = getAiPreference()
  if (pref) {
    form.append('provider', pref.provider)
    form.append('model', pref.model)
  }

  try {
    // Kick off request and simulate stage transitions while we wait —
    // the server is opaque, so we drive UX with a soft progress.
    const req = fetch('/api/extract', { method: 'POST', body: form })

    // After a short delay we consider the upload done and the model working.
    setTimeout(() => {
      if (state.status === 'running' && state.stage === 'reading') {
        set({ ...state, stage: 'parsing', progress: STAGE_PROGRESS.parsing })
      }
    }, 1200)
    setTimeout(() => {
      if (state.status === 'running' && state.stage === 'parsing') {
        set({ ...state, stage: 'structuring', progress: STAGE_PROGRESS.structuring })
      }
    }, 6000)

    const res = await req
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(body.error || `HTTP ${res.status}`)
    }

    const data = await res.json() as {
      quote: ExtractedQuote
      fileName: string
      toc: ExtractedToc | null
      validation: QuoteValidation | null
      cctpUploadId?: string | null
    }
    set({ status: 'running', fileName: data.fileName, stage: 'pricing', progress: STAGE_PROGRESS.pricing })

    // Mint a fallback devis number — overwritten by the server's number once
    // the DB draft is created.
    let devisNumber = makeDevisNumber()

    // Auto-create a persistent draft in DB. If the call fails (e.g. user not
    // logged in, network blip), we silently fall back to sessionStorage-only
    // mode so the extraction still works.
    let quoteId: string | null = null
    try {
      const initialLines = data.quote.items.map((it, i) => ({
        idx: i,
        category: it.category,
        name: it.name,
        description: it.description ?? '',
        reference: it.reference ?? '',
        quantity: Number.isFinite(it.quantity) ? it.quantity : 0,
        unit: it.unit,
        unitPrice: 0,
        lineTotalHT: 0,
        uncertain: !!it.uncertain,
      }))
      const draftRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cctpUploadId: data.cctpUploadId ?? null,
          projectName: data.quote.projectName || 'Devis sans titre',
          lot:         data.quote.lot     || '',
          client:      data.quote.client  || '',
          summary:     data.quote.summary || '',
          sector:      'Plomberie',
          fileName:    data.fileName,
          supplierId:  'auto',
          vatRate:     0.20,
          totalHT:     0,
          totalTTC:    0,
          aiConfidence: data.quote.confidence ?? null,
          aiNotes:      data.quote.notes ?? [],
          lines:        initialLines,
        }),
      })
      if (draftRes.ok) {
        const { quote: created } = await draftRes.json() as { quote: { id: string; devisNumber: string } }
        quoteId = created.id
        devisNumber = created.devisNumber
      }
    } catch {
      // Best-effort: persistence failure must never block the extraction.
    }

    // Persist to sessionStorage so /quote survives a hard refresh even without DB.
    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(data.quote))
      sessionStorage.setItem(FILE_KEY, data.fileName)
      sessionStorage.setItem(DEVIS_KEY, devisNumber)
      if (quoteId) sessionStorage.setItem(QUOTE_ID_KEY, quoteId)
      if (data.cctpUploadId) sessionStorage.setItem(UPLOAD_ID_KEY, data.cctpUploadId)
      if (data.toc) sessionStorage.setItem(TOC_KEY, JSON.stringify(data.toc))
      else sessionStorage.removeItem(TOC_KEY)
      if (data.validation) sessionStorage.setItem(VALIDATION_KEY, JSON.stringify(data.validation))
      else sessionStorage.removeItem(VALIDATION_KEY)
    } catch {}

    recordQuoteUsed()
    set({ status: 'done', fileName: data.fileName, quote: data.quote, toc: data.toc ?? null, validation: data.validation ?? null, devisNumber, quoteId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown extraction error.'
    set({ status: 'error', fileName: file.name, message })
  }
}

export type StoredQuote = {
  quote: ExtractedQuote
  fileName: string
  toc: ExtractedToc | null
  validation: QuoteValidation | null
  devisNumber: string
  quoteId: string | null
  cctpUploadId: string | null
}

export function loadStoredQuote(): StoredQuote | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY)
    if (!raw) return null
    const quote = JSON.parse(raw) as ExtractedQuote
    const fileName = sessionStorage.getItem(FILE_KEY) || 'CCTP.pdf'
    const tocRaw = sessionStorage.getItem(TOC_KEY)
    const toc = tocRaw ? JSON.parse(tocRaw) as ExtractedToc : null
    const validationRaw = sessionStorage.getItem(VALIDATION_KEY)
    const validation = validationRaw ? JSON.parse(validationRaw) as QuoteValidation : null
    let devisNumber = sessionStorage.getItem(DEVIS_KEY)
    if (!devisNumber) {
      devisNumber = makeDevisNumber()
      try { sessionStorage.setItem(DEVIS_KEY, devisNumber) } catch {}
    }
    const quoteId = sessionStorage.getItem(QUOTE_ID_KEY)
    const cctpUploadId = sessionStorage.getItem(UPLOAD_ID_KEY)
    return { quote, fileName, toc, validation, devisNumber, quoteId, cctpUploadId }
  } catch {
    return null
  }
}

/**
 * Fetch a persisted quote by id and shape it into the same `StoredQuote`
 * envelope that `loadStoredQuote()` returns. Used when /quote is opened
 * with ?id=... — i.e. the user reopened a draft from /projects.
 */
export type QuoteDetailDTO = {
  id: string
  devisNumber: string
  projectName: string
  lot: string
  client: string
  summary: string
  sector: string
  fileName: string
  supplierId: string
  status: 'draft' | 'approved' | 'sent' | 'archived'
  vatRate: number
  totalHT: number
  totalTTC: number
  aiConfidence: number | null
  aiNotes: string[]
  cctpUploadId: string | null
  lines: Array<{
    id: string
    idx: number
    category: string
    name: string
    description: string
    reference: string
    quantity: number
    unit: string
    unitPrice: number
    lineTotalHT: number
    uncertain: boolean
  }>
}

export async function fetchQuoteById(id: string): Promise<{
  stored: StoredQuote
  detail: QuoteDetailDTO
} | null> {
  const res = await fetch(`/api/quotes/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  const { quote: detail } = await res.json() as { quote: QuoteDetailDTO }

  const extracted: ExtractedQuote = {
    projectName: detail.projectName,
    lot: detail.lot,
    client: detail.client,
    summary: detail.summary,
    confidence: detail.aiConfidence ?? 0,
    notes: detail.aiNotes,
    items: detail.lines.map(l => ({
      category: l.category,
      name: l.name,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit as ExtractedQuote['items'][number]['unit'],
      reference: l.reference,
      uncertain: l.uncertain,
    })),
  }

  return {
    stored: {
      quote: extracted,
      fileName: detail.fileName,
      toc: null,
      validation: null,
      devisNumber: detail.devisNumber,
      quoteId: detail.id,
      cctpUploadId: detail.cctpUploadId,
    },
    detail,
  }
}

/**
 * Persist an edit to /api/quotes/[id]. Sends the full lines array — the server
 * replaces the row body atomically.
 */
export async function patchQuote(id: string, payload: {
  supplierId?: string
  status?: 'draft' | 'approved' | 'sent' | 'archived'
  totalHT?: number
  totalTTC?: number
  vatRate?: number
  lines?: Array<{
    idx: number
    category: string
    name: string
    description?: string
    reference?: string
    quantity: number
    unit: string
    unitPrice: number
    lineTotalHT: number
    uncertain?: boolean
  }>
}): Promise<boolean> {
  try {
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

export function clearStoredQuote() {
  try {
    sessionStorage.removeItem(RESULT_KEY)
    sessionStorage.removeItem(FILE_KEY)
    sessionStorage.removeItem(TOC_KEY)
    sessionStorage.removeItem(VALIDATION_KEY)
    sessionStorage.removeItem(DEVIS_KEY)
    sessionStorage.removeItem(QUOTE_ID_KEY)
    sessionStorage.removeItem(UPLOAD_ID_KEY)
  } catch {}
  set({ status: 'idle' })
}
