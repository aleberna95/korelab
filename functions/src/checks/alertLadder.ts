/**
 * alertLadder.ts — threshold-based alert deduplication.
 *
 * Prevents repeated alerts when a SSL cert or domain stays below a threshold.
 * Each monitor doc stores `alertedThresholds: number[]` — a set of days-values
 * that have already triggered an alert.
 *
 * Usage:
 *   const threshold = findCrossedThreshold(currentDays, THRESHOLDS, alertedThresholds)
 *   if (threshold !== null) {
 *     // send alert
 *     await recordThreshold(db, monitorId, threshold)
 *   }
 *   // On recovery: await clearThresholds(db, monitorId)
 */

import type { Firestore } from 'firebase-admin/firestore'

/** SSL cert alert thresholds in days (descending — largest first) */
export const SSL_THRESHOLDS = [30, 14, 7, 2]

/**
 * Returns the highest threshold that has been crossed by `currentDays`
 * but has NOT yet been recorded in `alreadyAlertedt`, or null if none.
 *
 * "crossed" means currentDays <= threshold.
 */
export function findCrossedThreshold(
  currentDays: number,
  thresholds: number[],
  alreadyAlerted: number[],
): number | null {
  const alreadySet = new Set(alreadyAlerted)

  // Walk thresholds descending; the first one we cross and haven't alerted is the one to fire.
  for (const t of thresholds) {
    if (currentDays <= t && !alreadySet.has(t)) {
      return t
    }
  }
  return null
}

/** Append a threshold to the monitor's alertedThresholds array. */
export async function recordThreshold(
  db: Firestore,
  monitorId: string,
  threshold: number,
): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore')
  await db.collection('monitors').doc(monitorId).update({
    alertedThresholds: FieldValue.arrayUnion(threshold),
  })
}

/** Clear all recorded thresholds (called on recovery). */
export async function clearThresholds(
  db: Firestore,
  monitorId: string,
): Promise<void> {
  await db.collection('monitors').doc(monitorId).update({
    alertedThresholds: [],
  })
}
