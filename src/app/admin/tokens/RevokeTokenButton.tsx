'use client'

import { useTransition } from 'react'
import { revokeStatusToken } from './actions'

type Props = { tokenId: string }

export function RevokeTokenButton({ tokenId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Revoke this token? The link will stop working immediately.')) return
    startTransition(async () => {
      await revokeStatusToken(tokenId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="btn-danger text-xs px-3 py-1.5 min-h-[36px]"
    >
      {isPending ? 'Revoking…' : 'Revoke'}
    </button>
  )
}
