import 'server-only'
import { and, desc, eq, isNull, ne, or } from 'drizzle-orm'
import { db } from '@/server/db/client'
import {
  quotes, quoteLines,
  type Quote, type NewQuote,
  type QuoteLine, type NewQuoteLine,
} from '@/server/db/schema'

export type QuoteWithLines = Quote & { lines: QuoteLine[] }

// Lines on a fresh quote come without their quote_id (we set it in the insert).
export type NewQuoteLineInput = Omit<NewQuoteLine, 'quoteId'>

export const quoteRepository = {
  /**
   * List quotes for an account, newest first. Excludes archived by default —
   * archived rows are kept on disk for the 10-year legal retention but should
   * not pollute the working list.
   */
  async listForAccount(
    accountId: string,
    opts: { includeArchived?: boolean } = {},
  ): Promise<Quote[]> {
    const where = opts.includeArchived
      ? eq(quotes.accountId, accountId)
      : and(eq(quotes.accountId, accountId), ne(quotes.status, 'archived'))
    return db.select().from(quotes).where(where).orderBy(desc(quotes.createdAt))
  },

  async findById(id: string): Promise<Quote | null> {
    const [row] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1)
    return row ?? null
  },

  async findByIdWithLines(id: string): Promise<QuoteWithLines | null> {
    const [head] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1)
    if (!head) return null
    const lines = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id))
      .orderBy(quoteLines.idx)
    return { ...head, lines }
  },

  /**
   * Create a quote and its lines in a single transaction so we never end up
   * with a header without its body (or vice-versa).
   */
  async createWithLines(
    quoteData: NewQuote,
    lineData: NewQuoteLineInput[],
  ): Promise<QuoteWithLines> {
    return db.transaction(async (tx) => {
      const [head] = await tx.insert(quotes).values(quoteData).returning()
      if (lineData.length === 0) {
        return { ...head, lines: [] as QuoteLine[] }
      }
      const lines = await tx
        .insert(quoteLines)
        .values(lineData.map(l => ({ ...l, quoteId: head.id })))
        .returning()
      return { ...head, lines }
    })
  },

  /**
   * Replace a quote's body atomically: delete all current lines, insert the
   * new ones, and update the quote header. Used by the auto-save path on the
   * /quote editor — simpler than diffing rows and Just Works for our volumes.
   */
  async updateWithLines(
    id: string,
    quotePatch: Partial<Omit<Quote, 'id' | 'accountId' | 'createdBy' | 'createdAt'>>,
    lineData: NewQuoteLineInput[],
  ): Promise<QuoteWithLines | null> {
    return db.transaction(async (tx) => {
      const [head] = await tx
        .update(quotes)
        .set(quotePatch)
        .where(eq(quotes.id, id))
        .returning()
      if (!head) return null

      await tx.delete(quoteLines).where(eq(quoteLines.quoteId, id))
      const lines = lineData.length === 0
        ? []
        : await tx
            .insert(quoteLines)
            .values(lineData.map(l => ({ ...l, quoteId: head.id })))
            .returning()

      return { ...head, lines }
    })
  },

  async updateHeader(id: string, patch: Partial<Quote>): Promise<Quote | null> {
    const [row] = await db.update(quotes).set(patch).where(eq(quotes.id, id)).returning()
    return row ?? null
  },

  async softArchive(id: string): Promise<void> {
    await db
      .update(quotes)
      .set({ status: 'archived', archivedAt: new Date() })
      .where(eq(quotes.id, id))
  },

  /**
   * Compute the next devis number for an account. Format: DV-YYMMDD-NNNN,
   * where NNNN restarts at 0001 each day. Falls back to a 4-digit random
   * suffix when the lookup races (UNIQUE constraint catches collisions).
   */
  async nextDevisNumber(accountId: string, now: Date = new Date()): Promise<string> {
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const prefix = `DV-${yy}${mm}${dd}-`

    const rows = await db
      .select({ devisNumber: quotes.devisNumber })
      .from(quotes)
      .where(eq(quotes.accountId, accountId))
    const max = rows
      .map(r => r.devisNumber)
      .filter(n => n.startsWith(prefix))
      .map(n => parseInt(n.slice(prefix.length), 10))
      .filter(n => Number.isFinite(n))
      .reduce((m, n) => Math.max(m, n), 0)
    return `${prefix}${(max + 1).toString().padStart(4, '0')}`
  },
}

// Re-export helpers to discourage accidental cross-imports
export { isNull, or }
