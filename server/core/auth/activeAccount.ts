import 'server-only'
import { ForbiddenError } from '@/server/core/errors'
import { membershipRepository } from '@/server/repositories/membershipRepository'
import type { User } from '@/server/db/schema'

/**
 * Resolve the user's "active" account.
 *
 * MVP rule: every user has at least one membership (bootstrap creates a
 * personal account on first login). We pick the most recent active one.
 * When account-switching UI lands, this becomes a cookie/header lookup with
 * fallback to "most recent" — same return shape.
 */
export async function getActiveAccountId(user: User): Promise<string> {
  const rows = await membershipRepository.listActiveForUser(user.id)
  if (rows.length === 0) {
    throw new ForbiddenError('No active membership — cannot scope quotes to an account')
  }
  // listActiveForUser doesn't expose its sort order publicly; sort here so
  // behavior is deterministic regardless of repository internals.
  rows.sort((a, b) =>
    (b.membership.createdAt?.getTime() ?? 0) - (a.membership.createdAt?.getTime() ?? 0),
  )
  return rows[0].membership.accountId
}
