import 'server-only'
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  const saJson = process.env.FIREBASE_ADMIN_SA_JSON
  if (!saJson) {
    throw new Error('FIREBASE_ADMIN_SA_JSON environment variable is not set')
  }

  const serviceAccount = JSON.parse(saJson)

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
}

let _db: Firestore | null = null
let _auth: Auth | null = null

export function getAdminDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getAdminApp())
  }
  return _db
}

export function getAdminAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getAdminApp())
  }
  return _auth
}
