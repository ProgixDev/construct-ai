import { z } from 'zod'
import type { Quote, QuoteLine, QuoteStatus } from '@/server/db/schema'

// ----- Request payloads -----------------------------------------------------

export const quoteLineInputSchema = z.object({
  idx:         z.number().int().nonnegative(),
  category:    z.string().min(1).max(120),
  name:        z.string().min(1).max(500),
  description: z.string().max(2000).default(''),
  reference:   z.string().max(500).default(''),
  quantity:    z.number().nonnegative(),
  unit:        z.string().min(1).max(16),
  unitPrice:   z.number().nonnegative().default(0),
  lineTotalHT: z.number().nonnegative().default(0),
  uncertain:   z.boolean().default(false),
})

export const createQuoteSchema = z.object({
  cctpUploadId: z.string().uuid().nullish(),

  projectName:  z.string().min(1).max(500),
  lot:          z.string().max(500).default(''),
  client:       z.string().max(500).default(''),
  summary:      z.string().max(4000).default(''),
  sector:       z.string().max(120).default('Plomberie'),
  fileName:     z.string().max(500).default(''),

  supplierId:   z.string().max(120).default('auto'),
  vatRate:      z.number().min(0).max(1).default(0.20),
  totalHT:      z.number().nonnegative().default(0),
  totalTTC:     z.number().nonnegative().default(0),

  aiConfidence: z.number().min(0).max(1).nullish(),
  aiNotes:      z.array(z.string()).default([]),

  lines:        z.array(quoteLineInputSchema).default([]),
})

export const updateQuoteSchema = createQuoteSchema.partial().extend({
  status: z.enum(['draft', 'approved', 'sent', 'archived']).optional(),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
export type QuoteLineInput   = z.infer<typeof quoteLineInputSchema>

// ----- DTO out --------------------------------------------------------------
// Numeric columns come back from postgres-js as strings (to preserve precision).
// The wire format converts them to numbers so the front-end can do arithmetic
// without sprinkling parseFloat() everywhere.

function toNum(s: string | number | null | undefined, fallback = 0): number {
  if (s === null || s === undefined) return fallback
  const n = typeof s === 'number' ? s : parseFloat(s)
  return Number.isFinite(n) ? n : fallback
}

export type QuoteSummaryDTO = {
  id: string
  devisNumber: string
  projectName: string
  lot: string
  client: string
  sector: string
  fileName: string
  supplierId: string
  status: QuoteStatus
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

export type QuoteLineDTO = {
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
}

export type QuoteDetailDTO = QuoteSummaryDTO & {
  summary: string
  vatRate: number
  aiConfidence: number | null
  aiNotes: string[]
  lines: QuoteLineDTO[]
}

export function toSummaryDTO(row: Quote, lineCount: number): QuoteSummaryDTO {
  return {
    id: row.id,
    devisNumber: row.devisNumber,
    projectName: row.projectName,
    lot: row.lot,
    client: row.client,
    sector: row.sector,
    fileName: row.fileName,
    supplierId: row.supplierId,
    status: row.status,
    totalHT: toNum(row.totalHT),
    totalTTC: toNum(row.totalTTC),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    cctpUploadId: row.cctpUploadId,
    createdBy: row.createdBy,
    lineCount,
  }
}

export function toLineDTO(row: QuoteLine): QuoteLineDTO {
  return {
    id: row.id,
    idx: row.idx,
    category: row.category,
    name: row.name,
    description: row.description,
    reference: row.reference,
    quantity: toNum(row.quantity),
    unit: row.unit,
    unitPrice: toNum(row.unitPrice),
    lineTotalHT: toNum(row.lineTotalHT),
    uncertain: row.uncertain,
  }
}

export function toDetailDTO(row: Quote, lines: QuoteLine[]): QuoteDetailDTO {
  return {
    ...toSummaryDTO(row, lines.length),
    summary: row.summary,
    vatRate: toNum(row.vatRate, 0.20),
    aiConfidence: row.aiConfidence !== null ? toNum(row.aiConfidence) : null,
    aiNotes: Array.isArray(row.aiNotes) ? row.aiNotes : [],
    lines: lines.map(toLineDTO),
  }
}
