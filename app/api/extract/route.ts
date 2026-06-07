import { NextRequest } from 'next/server'
import { runExtractionPipeline } from '@/server/services/extraction/extractionService'
import { isProviderId, type ProviderId } from '@/features/quote/providers/types'
import { getCurrentUser } from '@/server/core/auth/session'
import { getActiveAccountId } from '@/server/core/auth/activeAccount'
import { uploadCctpPdf } from '@/server/services/storage/cctpStorage'
import { cctpUploadRepository } from '@/server/repositories/cctpUploadRepository'
import { logger } from '@/server/core/logger'

export const runtime = 'nodejs'
export const maxDuration = 300

function pickProvider(req: NextRequest, form: FormData): ProviderId {
  const fromQuery  = req.nextUrl.searchParams.get('provider')
  const fromHeader = req.headers.get('x-extract-provider')
  const fromForm   = form.get('provider')
  const fromEnv    = process.env.EXTRACTION_PROVIDER

  const formValue = typeof fromForm === 'string' ? fromForm : null
  const candidate = fromQuery ?? fromHeader ?? formValue ?? fromEnv ?? 'openai'
  return isProviderId(candidate) ? candidate : 'openai'
}

function pickModel(req: NextRequest, form: FormData): string | undefined {
  const fromQuery  = req.nextUrl.searchParams.get('model')
  const fromHeader = req.headers.get('x-extract-model')
  const fromForm   = form.get('model')
  const formValue  = typeof fromForm === 'string' ? fromForm : null
  return fromQuery ?? fromHeader ?? formValue ?? undefined
}

function pickSkipToc(req: NextRequest, form: FormData): boolean {
  const fromQuery  = req.nextUrl.searchParams.get('skipToc')
  const fromForm   = form.get('skipToc')
  const formValue  = typeof fromForm === 'string' ? fromForm : null
  const raw = fromQuery ?? formValue
  return raw === '1' || raw === 'true'
}

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid multipart payload.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing `file` field.' }, { status: 400 })
  }
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return Response.json({ error: 'Only PDF files are supported for now.' }, { status: 415 })
  }

  const provider = pickProvider(req, form)
  const model    = pickModel(req, form)
  const skipToc  = pickSkipToc(req, form)

  // Persist the source PDF before extraction so the user can come back to the
  // original document later. Best-effort: a failed upload should not block
  // extraction (the user still wants their quote even if Storage hiccups).
  let cctpUploadId: string | null = null
  try {
    const user = await getCurrentUser()
    if (user) {
      const accountId = await getActiveAccountId(user)
      const bytes = Buffer.from(await file.arrayBuffer())
      const { storagePath, sizeBytes } = await uploadCctpPdf({
        accountId,
        fileName: file.name,
        bytes,
        contentType: file.type || 'application/pdf',
      })
      const upload = await cctpUploadRepository.insert({
        accountId,
        uploadedBy: user.id,
        fileName: file.name,
        storagePath,
        sizeBytes,
        contentType: file.type || 'application/pdf',
      })
      cctpUploadId = upload.id
    }
  } catch (err) {
    logger.warn({ err }, 'CCTP source upload failed; continuing with extraction')
  }

  let result: Awaited<ReturnType<typeof runExtractionPipeline>>
  try {
    result = await runExtractionPipeline(file, { provider, model, skipToc })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Extraction failed unexpectedly.'
    return Response.json({ error: message, provider, model, cctpUploadId }, { status: 502 })
  }

  if (!result.ok) {
    const status = result.error.code === 'missing_key' ? 500 : result.error.status ?? 502
    return Response.json({ error: result.error.message, provider, model, toc: result.toc, cctpUploadId }, { status })
  }

  return Response.json({
    quote: result.quote,
    toc: result.toc,
    validation: result.validation,
    tocSkippedReason: result.tocSkippedReason ?? null,
    fileName: file.name,
    provider,
    model,
    cctpUploadId,
  })
}
