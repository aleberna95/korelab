/**
 * tokens.ts — StatusToken validation and usage tracking.
 *
 * Tokens are stored as sha256(rawToken) in Firestore.
 * URL contains the raw token; we hash on lookup (constant-time).
 * On valid use: update lastUsedAt; once per day per token, write auditLog.
 */

import 'server-only'
import { createHash } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLogRepo } from '@/lib/repos/auditLogRepo'
import type { StatusToken } from '@/lib/domain/types'

/**
 * Validate a raw token from the URL.
 * Returns the token doc if valid; null if not found, revoked, or expired.
 * Uses the existing lookupByRawToken (already hashes, checks revoked/expiry).
 */
export async function validateToken(rawToken: string): Promise<StatusToken | null> {
  if (!rawToken || rawToken.length < 8) return null
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const db = getAdminDb()
  const snap = await db
    .collection('statusTokens')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  const data = doc.data() as Omit<StatusToken, 'id'>
  // Check revoked/expired
  if (data.revokedAt) return null
  if (data.expiresAt && data.expiresAt.toDate() < new Date()) return null
  return { id: doc.id, ...data }
}

/**
 * Record token usage:
 * - Always updates lastUsedAt.
 * - Writes an auditLog entry at most once per calendar day per token.
 */
export async function recordTokenUse(token: StatusToken): Promise<void> {
  const db = getAdminDb()

  // Check if we already logged today (to avoid spamming the audit log)
  const todayKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const dedupRef = db.collection('tokenUsageDedup').doc(`${token.id}::${todayKey}`)

  const [existing] = await Promise.all([
    dedupRef.get(),
    // Always update lastUsedAt regardless
    db.collection('statusTokens').doc(token.id).update({
      lastUsedAt: FieldValue.serverTimestamp(),
    }),
  ])

  if (!existing.exists) {
    await Promise.all([
      dedupRef.set({ tokenId: token.id, date: todayKey }),
      auditLogRepo.write({
        actorKind: 'webhook', // external access, no actorUid
        action: 'status.token.used',
        targetCollection: 'statusTokens',
        targetId: token.id,
        metadata: { scope: token.scope, targetId: token.targetId },
      }),
    ])
  }
}
