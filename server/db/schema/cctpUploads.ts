import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { users } from './users'

// Stores the original CCTP PDF the user uploaded so the source document
// remains available after extraction. The actual bytes live in the Supabase
// Storage bucket `cctp-uploads`; this row is the metadata pointer.
export const cctpUploads = pgTable(
  'cctp_uploads',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    storagePath: text('storage_path').notNull().unique(),
    sizeBytes: integer('size_bytes').notNull(),
    contentType: text('content_type').notNull().default('application/pdf'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cctp_uploads_account_idx').on(table.accountId, table.createdAt),
  ],
)

export type CctpUpload = typeof cctpUploads.$inferSelect
export type NewCctpUpload = typeof cctpUploads.$inferInsert
