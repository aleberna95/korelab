import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { makeDocConverter } from '@/lib/firebase/converters'
import {
  CreateDependencySchema,
  type CreateDependencyInput,
} from '@/lib/domain/schemas/dependency'
import type { Dependency } from '@/lib/domain/types'

const COLLECTION = 'dependencies'
const converter = makeDocConverter<Dependency>()

function col() {
  return getAdminDb().collection(COLLECTION).withConverter(converter)
}

export const dependenciesRepo = {
  async getById(id: string): Promise<Dependency | null> {
    const snap = await col().doc(id).get()
    return snap.exists ? snap.data()! : null
  },

  /** All dependencies where `fromId` = the given node */
  async listOutbound(fromId: string): Promise<Dependency[]> {
    const snap = await col().where('fromId', '==', fromId).get()
    return snap.docs.map((d) => d.data())
  },

  /** All dependencies where `toId` = the given node */
  async listInbound(toId: string): Promise<Dependency[]> {
    const snap = await col().where('toId', '==', toId).get()
    return snap.docs.map((d) => d.data())
  },

  /** All edges connected to a given node (in either direction) */
  async listForNode(nodeId: string): Promise<Dependency[]> {
    const [outbound, inbound] = await Promise.all([
      this.listOutbound(nodeId),
      this.listInbound(nodeId),
    ])
    const seen = new Set<string>()
    return [...outbound, ...inbound].filter((d) => {
      if (seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })
  },

  async create(input: CreateDependencyInput): Promise<Dependency> {
    const validated = CreateDependencySchema.parse(input)
    const ref = col().doc()
    await ref.set({
      ...validated,
      id: ref.id,
      createdAt: FieldValue.serverTimestamp(),
    } as unknown as Dependency)
    const created = await ref.get()
    return created.data()!
  },

  async delete(id: string): Promise<void> {
    await col().doc(id).delete()
  },
}
