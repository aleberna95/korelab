'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { statusTokensRepo } from '@/lib/repos/statusTokensRepo'
import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import type { StatusToken } from '@/lib/domain/types'

export interface CreateTokenResult {
  rawToken: string
  tokenId: string
}

export async function createStatusToken(formData: {
  scope: StatusToken['scope']
  targetId: string
  allowedSections: StatusToken['allowedSections']
  expiresAt?: string
}): Promise<CreateTokenResult> {
  const { uid } = await requireAdmin()

  const rawToken = randomBytes(32).toString('base64url')

  const { token } = await statusTokensRepo.create(rawToken, {
    scope: formData.scope,
    targetId: formData.targetId,
    allowedSections: formData.allowedSections,
    expiresAt: formData.expiresAt || undefined,
  }, uid)

  revalidatePath('/admin/tokens')
  return { rawToken, tokenId: token.id }
}

export async function revokeStatusToken(tokenId: string): Promise<void> {
  const { uid } = await requireAdmin()
  await statusTokensRepo.revoke(tokenId, uid)
  revalidatePath('/admin/tokens')
}
