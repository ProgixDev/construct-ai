import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { cctpUploads, type CctpUpload, type NewCctpUpload } from '@/server/db/schema'

export const cctpUploadRepository = {
  async insert(data: NewCctpUpload): Promise<CctpUpload> {
    const [row] = await db.insert(cctpUploads).values(data).returning()
    return row
  },

  async findById(id: string): Promise<CctpUpload | null> {
    const [row] = await db.select().from(cctpUploads).where(eq(cctpUploads.id, id)).limit(1)
    return row ?? null
  },
}
