import 'server-only'
import { Timestamp } from 'firebase-admin/firestore'
import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'

/**
 * Recursively converts Firestore Timestamp instances to ISO strings so that
 * documents are safe to pass across the RSC → Client Component boundary.
 */
function serializeTimestamps(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(serializeTimestamps)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeTimestamps(v)]),
    )
  }
  return value
}

/**
 * Creates a typed Firestore data converter for a given document type.
 *
 * - toFirestore: passes data through as-is (Admin SDK accepts it).
 * - fromFirestore: spreads the snapshot data, injects the document ID as `id`,
 *   and converts all Timestamp fields to ISO strings for RSC serialization safety.
 */
export function makeDocConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...rest } = data
      return rest as DocumentData
    },
    fromFirestore(snap: QueryDocumentSnapshot): T {
      return serializeTimestamps({ ...snap.data(), id: snap.id }) as T
    },
  }
}
