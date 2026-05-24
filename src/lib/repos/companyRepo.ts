import 'server-only'
import { getAdminDb } from '@/lib/firebase/admin'
import type { CompanySettings } from '@/lib/domain/company'

const COLLECTION = 'users'
const SETTINGS_DOC = 'company'

function ref(uid: string) {
  return getAdminDb()
    .collection(COLLECTION)
    .doc(uid)
    .collection('settings')
    .doc(SETTINGS_DOC)
}

export const companyRepo = {
  async get(uid: string): Promise<CompanySettings | null> {
    const snap = await ref(uid).get()
    return snap.exists ? (snap.data() as CompanySettings) : null
  },

  async save(uid: string, data: CompanySettings): Promise<void> {
    await ref(uid).set(data, { merge: true })
  },
}
