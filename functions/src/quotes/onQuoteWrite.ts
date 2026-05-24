/**
 * onQuoteWrite — Firestore trigger.
 *
 * Fires when a quote document is updated. Automatically regenerates the PDF
 * when the quote status transitions to 'in-approvazione' or 'approvato'.
 *
 * Only triggers on status changes (not on every field update) to avoid
 * redundant PDF generations during draft editing.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getApps, initializeApp } from 'firebase-admin/app'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { QuotePdf } from './QuotePdf'
import type { QuoteData, CompanyData, QuoteStatus } from './types'

if (!getApps().length) initializeApp()

const db = getFirestore()

const PDF_TRIGGER_STATUSES: QuoteStatus[] = ['in-approvazione', 'approvato']

export const onQuoteWrite = onDocumentUpdated('quotes/{quoteId}', async (event) => {
  const before = event.data?.before?.data() as Record<string, unknown> | undefined
  const after = event.data?.after?.data() as Record<string, unknown> | undefined

  if (!before || !after) return

  const prevStatus = before.status as QuoteStatus
  const nextStatus = after.status as QuoteStatus

  // Only regenerate when status changes to a trigger status
  if (prevStatus === nextStatus) return
  if (!PDF_TRIGGER_STATUSES.includes(nextStatus)) return

  const quoteId = event.params.quoteId
  const quote: QuoteData = {
    id: quoteId,
    ...(after as Omit<QuoteData, 'id'>),
  }

  // ── Load company settings ──────────────────────────────────────────────────
  // Look up company settings from the first admin user found in the users
  // collection. The owning uid is not directly available here; we search for
  // any document under users/{uid}/settings/company.
  let company: CompanyData | null = null
  try {
    const usersSnap = await db.collection('users').limit(1).get()
    if (!usersSnap.empty) {
      const uid = usersSnap.docs[0].id
      const companySnap = await db
        .collection('users')
        .doc(uid)
        .collection('settings')
        .doc('company')
        .get()
      if (companySnap.exists) {
        company = companySnap.data() as CompanyData
      }
    }
  } catch {
    // non-blocking — render without company data
  }

  // ── Render PDF ─────────────────────────────────────────────────────────────
  const element = React.createElement(QuotePdf, { quote, company }) as React.ReactElement<DocumentProps>
  const pdfBuffer = await renderToBuffer(element)

  // ── Upload to Storage ───────────────────────────────────────────────────────
  const bucket = getStorage().bucket()
  const safeName = quote.number.replace(/\//g, '-')
  const filePath = `quotes/${quoteId}/${safeName}.pdf`
  const file = bucket.file(filePath)

  await file.save(Buffer.from(pdfBuffer), {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'private, max-age=300' },
  })

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 7, // 7 years
  })

  // ── Persist URL on quote document ───────────────────────────────────────────
  await db.collection('quotes').doc(quoteId).update({ pdfUrl: signedUrl })
})
