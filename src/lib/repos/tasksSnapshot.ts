// No 'server-only' — this file is safe to lazy-import in client components.
// Usage in useEffect: const { onTasksSnapshot } = await import('@/lib/repos/tasksSnapshot')

import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import { clientApp } from '@/lib/firebase/client'
import type { TaskColor } from '@/lib/domain/types'

export type SerializedTask = {
  id: string
  text: string
  color: TaskColor
  order: number
  done: boolean
  doneAtMs?: number
  createdAtMs: number
  updatedAtMs: number
}

/**
 * Subscribe to all tasks ordered by `order` desc.
 * Returns an unsubscribe function.
 */
export function onTasksSnapshot(
  callback: (tasks: SerializedTask[]) => void,
): () => void {
  const db = getFirestore(clientApp)
  const q = query(collection(db, 'tasks'), orderBy('order', 'desc'))

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((doc) => {
        const d = doc.data()
        return {
          id: doc.id,
          text: d.text as string,
          color: d.color as TaskColor,
          order: d.order as number,
          done: d.done as boolean,
          doneAtMs: (d.doneAt as { toMillis?: () => number } | undefined)?.toMillis?.(),
          createdAtMs: (d.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
          updatedAtMs: (d.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
        }
      }),
    )
  })
}
