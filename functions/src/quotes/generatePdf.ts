/**
 * generateQuotePdf — HTTPS Callable Cloud Function.
 *
 * Renders a quote as a PDF using @react-pdf/renderer, uploads it to Firebase
 * Storage and stores the download URL in the Firestore quote document.
 *
 * Auth: admin token required (token.role === 'admin').
 * Storage path: quotes/{quoteId}/{quoteNumber}.pdf
 * Returns: { url: string }
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getApps, initializeApp } from 'firebase-admin/app'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import * as crypto from 'crypto'
import React from 'react'
import { QuotePdf } from './QuotePdf'
import type { QuoteData, CompanyData } from './types'

if (!getApps().length) initializeApp()

const db = getFirestore()

export const generateQuotePdf = onCall<{ quoteId: string }>(
  { memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
  // ── Auth check ──────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticazione richiesta.')
  }
  if (!request.auth.token.role || request.auth.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Accesso riservato agli amministratori.')
  }

  const uid = request.auth.uid
  const { quoteId } = request.data

  if (!quoteId || typeof quoteId !== 'string') {
    throw new HttpsError('invalid-argument', 'quoteId mancante o non valido.')
  }

  // ── Load quote ───────────────────────────────────────────────────────────
  const quoteSnap = await db.collection('quotes').doc(quoteId).get()
  if (!quoteSnap.exists) {
    throw new HttpsError('not-found', `Preventivo ${quoteId} non trovato.`)
  }
  const quoteRaw = quoteSnap.data() as Record<string, unknown>
  const quote: QuoteData = {
    id: quoteSnap.id,
    ...(quoteRaw as Omit<QuoteData, 'id'>),
  }

  // ── Load company settings ────────────────────────────────────────────────
  let company: CompanyData | null = null
  try {
    const companySnap = await db
      .collection('users')
      .doc(uid)
      .collection('settings')
      .doc('company')
      .get()
    if (companySnap.exists) {
      company = companySnap.data() as CompanyData
    }
  } catch {
    // non-blocking — render without company data
  }

  // ── Render PDF ───────────────────────────────────────────────────────────
  const element = React.createElement(QuotePdf, { quote, company }) as React.ReactElement<DocumentProps>
  const pdfBuffer = await renderToBuffer(element)

  // ── Upload to Storage ─────────────────────────────────────────────────────
  const bucket = getStorage().bucket()
  const safeName = quote.number.replace(/\//g, '-')
  const filePath = `quotes/${quoteId}/${safeName}.pdf`
  const file = bucket.file(filePath)

  // Use a Firebase Storage download token (no IAM signBlob permission needed).
  const downloadToken = crypto.randomUUID()

  await file.save(Buffer.from(pdfBuffer), {
    contentType: 'application/pdf',
    metadata: {
      cacheControl: 'private, max-age=300',
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  })

  const bucketName = bucket.name
  const encodedPath = encodeURIComponent(filePath)
  const downloadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}` +
    `?alt=media&token=${downloadToken}`

  // ── Persist URL on quote document ────────────────────────────────────────
  await db.collection('quotes').doc(quoteId).update({ pdfUrl: downloadUrl })

  return { url: downloadUrl }
  },
)
