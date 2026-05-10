import 'server-only'
import { createHash } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateStatusTokenSchema,
  UpdateStatusTokenSchema,
  type CreateStatusTokenInput,
  type UpdateStatusTokenInput,
} from '@/lib/domain/schemas/statusToken'
import type { StatusToken } from '@/lib/domain/types'
import { auditLogRepo } from './auditLogRepo'

const COLLECTION = 'statusTokens'
const converter = makeDocConverter<StatusToken>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

/** SHA-256 hash of a raw token string */
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export const statusTokensRepo = {
  async getById(id: string): Promise<StatusToken | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  /**
   * Look up a token by the raw (URL-provided) value.
   * We hash it first and query by tokenHash — the raw token is never stored.
   */
  async lookupByRawToken(rawToken: string): Promise<StatusToken | null> {
    const hash = hashToken(rawToken)
    const snap = await col().where('tokenHash', '==', hash).limit(1).get()
    if (snap.empty) return null
    const token = snap.docs[0].data()
    // Reject expired or revoked tokens
    if (token.revokedAt) return null
    if (token.expiresAt && token.expiresAt.toMillis() < Date.now()) return null
    return token
  },

  async list(filters: {
    scope?: StatusToken['scope']
    targetId?: string
    limit?: number
  } = {}): Promise<StatusToken[]> {
    let q = col().orderBy('createdAt', 'desc') as FirebaseFirestore.Query<StatusToken>

    if (filters.scope) q = q.where('scope', '==', filters.scope)
    if (filters.targetId) q = q.where('targetId', '==', filters.targetId)
    q = q.limit(filters.limit ?? 50)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  /**
   * Create a new status token. The caller generates the raw token and passes it in;
   * only the hash is persisted. The raw token must be returned to the caller once.
   */
  async create(
    rawToken: string,
    input: CreateStatusTokenInput,
    actorUid: string,
  ): Promise<{ token: StatusToken; rawToken: string }> {
    const validated = CreateStatusTokenSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    const { expiresAt, ...rest } = validated
    await ref.set({
      ...rest,
      id: ref.id,
      tokenHash: hashToken(rawToken),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdAt: now,
      createdBy: actorUid,
    } as unknown as StatusToken)

    await auditLogRepo.write({
      actorUid,
      actorKind: 'user',
      action: 'statusTokens.create',
      targetCollection: COLLECTION,
      targetId: ref.id,
    })

    const created = await ref.get()
    return { token: created.data()!, rawToken }
  },

  async revoke(id: string, actorUid?: string): Promise<void> {
    await col().doc(id).update({ revokedAt: FieldValue.serverTimestamp() })

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'statusTokens.revoke',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },

  async updateLastUsed(id: string): Promise<void> {
    await getAdminDb()
      .collection(COLLECTION)
      .doc(id)
      .update({ lastUsedAt: FieldValue.serverTimestamp() })
  },

  async update(id: string, patch: UpdateStatusTokenInput, actorUid?: string): Promise<void> {
    const validated = UpdateStatusTokenSchema.parse(patch)
    await col().doc(id).update(validated)

    await auditLogRepo.write({
      actorUid,
      actorKind: actorUid ? 'user' : 'function',
      action: 'statusTokens.update',
      targetCollection: COLLECTION,
      targetId: id,
    })
  },
}
