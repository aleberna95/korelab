/**
 * One-time script: set the `role: 'admin'` custom claim on a Firebase Auth user.
 *
 * Required env vars:
 *   FIREBASE_ADMIN_SA_JSON   single-line JSON of your service account key
 *
 * Usage:
 *   npx tsx scripts/setAdminClaim.ts <UID>
 *
 * After running, the user must SIGN OUT AND BACK IN before the new claim is
 * present in their ID token (Firebase Auth refreshes claims on token rotation).
 */

import 'dotenv/config'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

async function main(): Promise<void> {
  const uid = process.argv[2]
  if (!uid) {
    console.error('Usage: npx tsx scripts/setAdminClaim.ts <UID>')
    process.exit(1)
  }

  const saJson = process.env.FIREBASE_ADMIN_SA_JSON
  if (!saJson) {
    console.error('FIREBASE_ADMIN_SA_JSON is not set in environment.')
    process.exit(1)
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(saJson)) })
  }

  const auth = getAuth()
  const user = await auth.getUser(uid)

  // Preserve any existing claims; merge in role: 'admin'.
  const existing = (user.customClaims ?? {}) as Record<string, unknown>
  await auth.setCustomUserClaims(uid, { ...existing, role: 'admin' })

  console.log(`✅ Set role:'admin' on user ${user.email ?? uid}`)
  console.log('User must sign out and back in for the claim to appear in their ID token.')
}

main().catch((err) => {
  console.error('❌ Failed:', err)
  process.exit(1)
})
