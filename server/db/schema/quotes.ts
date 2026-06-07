import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, numeric, timestamp, jsonb, unique, index,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { users } from './users'
import { cctpUploads } from './cctpUploads'

export const quoteStatusEnum = pgEnum('quote_status', ['draft', 'approved', 'sent', 'archived'])

// One row per devis. Lines live in quote_lines (FK quote_id).
// All money fields are numeric(14,2) — enough up to 99 999 999 999.99 €.
// `devis_number` is unique per account (legal requirement: a devis number,
// once issued, must be stable and non-reusable inside its emitting entity).
export const quotes = pgTable(
  'quotes',
  {
    id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    accountId:    uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    createdBy:    uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    cctpUploadId: uuid('cctp_upload_id').references(() => cctpUploads.id, { onDelete: 'set null' }),

    devisNumber:  text('devis_number').notNull(),

    projectName:  text('project_name').notNull(),
    lot:          text('lot').notNull().default(''),
    client:       text('client').notNull().default(''),
    summary:      text('summary').notNull().default(''),
    sector:       text('sector').notNull().default('Plomberie'),
    fileName:     text('file_name').notNull().default(''),

    supplierId:   text('supplier_id').notNull().default('auto'),
    vatRate:      numeric('vat_rate', { precision: 5, scale: 4 }).notNull().default('0.2000'),
    totalHT:      numeric('total_ht', { precision: 14, scale: 2 }).notNull().default('0'),
    totalTTC:     numeric('total_ttc', { precision: 14, scale: 2 }).notNull().default('0'),

    aiConfidence: numeric('ai_confidence', { precision: 3, scale: 2 }),
    aiNotes:      jsonb('ai_notes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    status:       quoteStatusEnum('status').notNull().default('draft'),
    approvedAt:   timestamp('approved_at', { withTimezone: true }),
    sentAt:       timestamp('sent_at',     { withTimezone: true }),
    archivedAt:   timestamp('archived_at', { withTimezone: true }),

    createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('quotes_devis_number_per_account').on(table.accountId, table.devisNumber),
    index('quotes_account_created_idx').on(table.accountId, table.createdAt),
    index('quotes_account_status_idx').on(table.accountId, table.status),
    index('quotes_created_by_idx').on(table.createdBy),
  ],
)

export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number]
