import 'server-only'
import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore'

/**
 * Creates a typed Firestore data converter for a given document type.
 *
 * - toFirestore: passes data through as-is (Admin SDK accepts it).
 * - fromFirestore: spreads the snapshot data and injects the document ID as `id`.
 *
 * Timestamps are handled natively by the Firestore Admin SDK — they are
 * deserialized as Timestamp objects and serialized from FieldValue / Timestamp.
 */
export function makeDocConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...rest } = data
      return rest as DocumentData
    },
    fromFirestore(snap: QueryDocumentSnapshot): T {
      return { ...snap.data(), id: snap.id } as T
    },
  }
}
