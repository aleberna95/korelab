'use client'

import { useTransition } from 'react'
import { deleteService } from '../../actions'

type Props = { serviceId: string }

export function DeleteServiceButton({ serviceId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Eliminare questo servizio definitivamente? L\'azione non può essere annullata.')) return
    startTransition(async () => {
      await deleteService(serviceId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="btn-danger text-sm"
    >
      {isPending ? 'Eliminazione…' : 'Elimina servizio'}
    </button>
  )
}
