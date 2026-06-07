import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { randomUUID } from 'node:crypto'

const BUCKET = 'cctp-uploads'

/**
 * Upload a CCTP PDF to the private `cctp-uploads` bucket.
 * Files are stored under `{accountId}/{uuid}.pdf` so the account_id prefix
 * is the unit of access control if/when we wire RLS later.
 */
export async function uploadCctpPdf(args: {
  accountId: string
  fileName: string
  bytes: Buffer | Uint8Array
  contentType?: string
}): Promise<{ storagePath: string; sizeBytes: number }> {
  const ext = args.fileName.toLowerCase().endsWith('.pdf') ? '.pdf' : '.pdf'
  const storagePath = `${args.accountId}/${randomUUID()}${ext}`

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, args.bytes, {
    contentType: args.contentType ?? 'application/pdf',
    upsert: false,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  return { storagePath, sizeBytes: args.bytes.length }
}

/** Signed download URL — short-lived so the link can't be reshared. */
export async function signedDownloadUrl(storagePath: string, expiresInSec = 60): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSec)
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown'}`)
  }
  return data.signedUrl
}

export async function deleteCctpPdf(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}
