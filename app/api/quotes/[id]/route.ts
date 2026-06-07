import { requireUser } from '@/server/core/auth/session'
import { getActiveAccountId } from '@/server/core/auth/activeAccount'
import { ForbiddenError, NotFoundError } from '@/server/core/errors'
import { respondToError } from '@/server/core/errors'
import { quoteRepository } from '@/server/repositories/quoteRepository'
import { updateQuoteSchema, toDetailDTO } from '@/server/services/quotes/quoteDto'

export const runtime = 'nodejs'

// Next.js 15+: params is async — typed as Promise<...>.
type Ctx = { params: Promise<{ id: string }> }

async function loadOwnedQuote(id: string) {
  const user = await requireUser()
  const accountId = await getActiveAccountId(user)
  const head = await quoteRepository.findById(id)
  if (!head) throw new NotFoundError('Quote')
  if (head.accountId !== accountId) throw new ForbiddenError('Quote not in your account')
  return { user, accountId, head }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await loadOwnedQuote(id)
    const detail = await quoteRepository.findByIdWithLines(id)
    if (!detail) {
      // race condition guard — extremely unlikely; the row was just checked
      return Response.json({ error: 'Quote not found' }, { status: 404 })
    }
    return Response.json({ quote: toDetailDTO(detail, detail.lines) })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await loadOwnedQuote(id)
    const body = await req.json()
    const input = updateQuoteSchema.parse(body)

    const headerPatch: Record<string, unknown> = {}
    if (input.projectName !== undefined) headerPatch.projectName = input.projectName
    if (input.lot         !== undefined) headerPatch.lot = input.lot
    if (input.client      !== undefined) headerPatch.client = input.client
    if (input.summary     !== undefined) headerPatch.summary = input.summary
    if (input.sector      !== undefined) headerPatch.sector = input.sector
    if (input.fileName    !== undefined) headerPatch.fileName = input.fileName
    if (input.supplierId  !== undefined) headerPatch.supplierId = input.supplierId
    if (input.vatRate     !== undefined) headerPatch.vatRate = input.vatRate.toFixed(4)
    if (input.totalHT     !== undefined) headerPatch.totalHT = input.totalHT.toFixed(2)
    if (input.totalTTC    !== undefined) headerPatch.totalTTC = input.totalTTC.toFixed(2)
    if (input.aiNotes     !== undefined) headerPatch.aiNotes = input.aiNotes
    if (input.aiConfidence !== undefined && input.aiConfidence !== null) {
      headerPatch.aiConfidence = input.aiConfidence.toFixed(2)
    }
    if (input.status !== undefined) {
      headerPatch.status = input.status
      if (input.status === 'approved') headerPatch.approvedAt = new Date()
      if (input.status === 'sent')     headerPatch.sentAt     = new Date()
      if (input.status === 'archived') headerPatch.archivedAt = new Date()
    }

    if (input.lines !== undefined) {
      const updated = await quoteRepository.updateWithLines(
        id,
        headerPatch,
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
      if (!updated) return Response.json({ error: 'Quote not found' }, { status: 404 })
      return Response.json({ quote: toDetailDTO(updated, updated.lines) })
    }

    // Header-only patch
    const updatedHead = await quoteRepository.updateHeader(id, headerPatch)
    if (!updatedHead) return Response.json({ error: 'Quote not found' }, { status: 404 })
    const detail = await quoteRepository.findByIdWithLines(id)
    return Response.json({ quote: toDetailDTO(updatedHead, detail?.lines ?? []) })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await loadOwnedQuote(id)
    await quoteRepository.softArchive(id)
    return new Response(null, { status: 204 })
  } catch (err) {
    return errorResponse(err)
  }
}

function errorResponse(err: unknown): Response {
  // Delegate to the shared error funnel so AppError subclasses (401/403/404…)
  // and ZodError map to their correct status without duplicate logic.
  return respondToError(err)
}
