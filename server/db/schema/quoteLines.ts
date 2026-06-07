import { sql } from 'drizzle-orm'
import {
  pgTable, uuid, text, numeric, integer, boolean, timestamp, unique, index,
} from 'drizzle-orm/pg-core'
import { quotes } from './quotes'

// One row per quote line. `idx` is the display order — UNIQUE per quote so
// reordering must renumber in a transaction.
export const quoteLines = pgTable(
  'quote_lines',
  {
    id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    quoteId:     uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
    idx:         integer('idx').notNull(),
    category:    text('category').notNull(),
    name:        text('name').notNull(),
    description: text('description').notNull().default(''),
    reference:   text('reference').notNull().default(''),
    quantity:    numeric('quantity',      { precision: 14, scale: 3 }).notNull(),
    unit:        text('unit').notNull(),
    unitPrice:   numeric('unit_price',    { precision: 14, scale: 2 }).notNull().default('0'),
    lineTotalHT: numeric('line_total_ht', { precision: 14, scale: 2 }).notNull().default('0'),
    uncertain:   boolean('uncertain').notNull().default(false),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('quote_lines_idx_per_quote').on(table.quoteId, table.idx),
    index('quote_lines_quote_idx').on(table.quoteId, table.idx),
  ],
)

export type QuoteLine = typeof quoteLines.$inferSelect
export type NewQuoteLine = typeof quoteLines.$inferInsert
