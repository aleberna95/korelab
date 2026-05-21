import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateClientSchema,
  UpdateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from '@/lib/domain/schemas/client'
import type { Client } from '@/lib/domain/types'

const COLLECTION = 'clients'
const converter = makeDocConverter<Client>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export type ClientFilters = {
  status?: Client['status']
  tag?: string
  limit?: number
}

export const clientsRepo = {
  async getById(id: string): Promise<Client | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  async list(filters: ClientFilters = {}): Promise<Client[]> {
    let q = col().orderBy('name') as FirebaseFirestore.Query<Client>

    if (filters.status) q = q.where('status', '==', filters.status)
    if (filters.tag) q = q.where('tags', 'array-contains', filters.tag)
    q = q.limit(filters.limit ?? 100)

    const snap = await q.get()
    return snap.docs.map((d) => d.data())
  },

  async create(
    input: CreateClientInput,
    actorUid?: string,
  ): Promise<Client> {
    const validated = CreateClientSchema.parse(input)
    const ref = col().doc()
    const now = FieldValue.serverTimestamp()

    await ref.set({
      ...validated,
      id: ref.id,
      createdAt: now,
      updatedAt: now,
    } as unknown as Client)

    const created = await ref.get()
    return created.data()!
  },

  async update(
    id: string,
    patch: UpdateClientInput,
    actorUid?: string,
  ): Promise<void> {
    const validated = UpdateClientSchema.parse(patch)
    await col()
      .doc(id)
      .update({ ...validated, updatedAt: FieldValue.serverTimestamp() })
  },

  async archive(id: string, actorUid?: string): Promise<void> {
    await col()
      .doc(id)
      .update({ status: 'archived', updatedAt: FieldValue.serverTimestamp() })
  },
}
