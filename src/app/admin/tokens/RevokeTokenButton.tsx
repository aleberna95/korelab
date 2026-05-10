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
      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
    >
      {isPending ? 'Revoking…' : 'Revoke'}
    </button>
  )
}
