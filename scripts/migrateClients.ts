/**
 * migrateClients.ts — One-time migration.
 *
 * Migrates client documents from the old schema (businessType, contacts[],
 * supportPlan, consent, telegramChatId) to the simplified schema:
 * { name, email?, phone?, notes?, tags, status, createdAt, updatedAt }
 *
 * Changes:
 *   - contacts[0].email → email (first contact's email)
 *   - contacts[0].phone → phone (first contact's phone)
 *   - status 'paused' → 'active'
 *   - removes: businessType, contacts, telegramChatId, supportPlan, consent
 *
 * Run:
 *   npx tsx scripts/migrateClients.ts
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account key
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const app = initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
})

const db = getFirestore(app)

async function main() {
  const snap = await db.collection('clients').get()
  console.log(`Found ${snap.size} client(s) to migrate`)

  let updated = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const data = doc.data()

    // Already migrated if it has no old fields
    if (!data.businessType && !data.contacts && !data.supportPlan && !data.consent) {
      console.log(`  ${doc.id} (${data.name}): already migrated, skipping`)
      skipped++
      continue
    }

    // Extract contact info from first contact
    const primaryContact = Array.isArray(data.contacts)
      ? (data.contacts.find((c: { primary?: boolean }) => c.primary) ?? data.contacts[0])
      : null

    const email: string | undefined = primaryContact?.email || undefined
    const phone: string | undefined = primaryContact?.phone || undefined

    // Map status
    const status = data.status === 'archived' ? 'archived' : 'active'

    const patch: Record<string, unknown> = {
      status,
      tags: data.tags ?? [],
      updatedAt: FieldValue.serverTimestamp(),
      // Remove old fields
      businessType: FieldValue.delete(),
      contacts: FieldValue.delete(),
      telegramChatId: FieldValue.delete(),
      supportPlan: FieldValue.delete(),
      consent: FieldValue.delete(),
    }

    if (email) patch.email = email
    if (phone) patch.phone = phone

    await doc.ref.update(patch)
    console.log(`  ${doc.id} (${data.name}): migrated${email ? ` email=${email}` : ''}${phone ? ` phone=${phone}` : ''} status=${status}`)
    updated++
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
