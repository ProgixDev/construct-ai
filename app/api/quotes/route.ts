import { handle } from '@/server/core/http'
import { requireUser } from '@/server/core/auth/session'
import { getActiveAccountId } from '@/server/core/auth/activeAccount'
import { quoteRepository } from '@/server/repositories/quoteRepository'
import {
  createQuoteSchema,
  toSummaryDTO,
  toDetailDTO,
} from '@/server/services/quotes/quoteDto'

export const runtime = 'nodejs'

/**
 * GET /api/quotes — list the current user's account quotes, newest first.
 * Excludes archived rows unless ?includeArchived=1 is passed.
 */
export const GET = handle(async (req) => {
  const user = await requireUser()
  const accountId = await getActiveAccountId(user)

  const url = new URL(req.url)
  const includeArchived = url.searchParams.get('includeArchived') === '1'

  const rows = await quoteRepository.listForAccount(accountId, { includeArchived })
  return {
    quotes: rows.map((q) => toSummaryDTO(q, 0)), // lineCount filled per-row below if needed
  }
})

/**
 * POST /api/quotes — create a new quote from an extraction result + editable
 * lines. The devis number is minted server-side so it's stable across reloads.
 */
export const POST = handle(async (req) => {
  const user = await requireUser()
  const accountId = await getActiveAccountId(user)

  const body = await req.json()
  const input = createQuoteSchema.parse(body)

  const devisNumber = await quoteRepository.nextDevisNumber(accountId)

  const created = await quoteRepository.createWithLines(
    {
      accountId,
      createdBy: user.id,
      cctpUploadId: input.cctpUploadId ?? null,
      devisNumber,
      projectName: input.projectName,
      lot: input.lot,
      client: input.client,
      summary: input.summary,
      sector: input.sector,
      fileName: input.fileName,
      supplierId: input.supplierId,
      vatRate: input.vatRate.toFixed(4),
      totalHT: input.totalHT.toFixed(2),
      totalTTC: input.totalTTC.toFixed(2),
      aiConfidence: input.aiConfidence != null ? input.aiConfidence.toFixed(2) : null,
      aiNotes: input.aiNotes,
    },
    input.lines.map((l) => ({
      idx: l.idx,
      category: l.category,
      name: l.name,
      description: l.description,
      reference: l.reference,
      quantity: l.quantity.toFixed(3),
      unit: l.unit,
      unitPrice: l.unitPrice.toFixed(2),
      lineTotalHT: l.lineTotalHT.toFixed(2),
      uncertain: l.uncertain,
    })),
  )

  return Response.json({ quote: toDetailDTO(created, created.lines) }, { status: 201 })
})
