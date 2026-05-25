import { fmtDate as utilsFmtDate } from '@/lib/utils';
/**
 * hr-detail-loader — server-side helpers for HR detail pages.
 *
 * Most HR entities use the `genericSave` / `hrList` action pair from
 * `hr.actions.ts` and don't ship a dedicated `getById` action. Detail
 * pages (per §1D.2 of the CRM rebuild contract) need to fetch a single
 * document by id. This module provides a tenant-scoped Mongo lookup so
 * every HR detail page uses the same shape.
 *
 * Usage:
 *   ```ts
 *   const doc = await getHrEntityById('hr_assets', id);
 *   if (!doc) notFound();
 *   ```
 */

import 'server-only';

import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

/** Plain JSON-safe document shape returned to client/server components. */
export type HrJsonDoc = Record<string, unknown> & { _id: string };

/**
 * Load a single HR document by id, scoped to the current session's user.
 * Returns `null` when there is no session, the id is malformed, the
 * document is not found, or the read fails.
 */
export async function getHrEntityById(
  collection: string,
  id: string,
): Promise<HrJsonDoc | null> {
  if (!id || typeof id !== 'string' || !ObjectId.isValid(id)) return null;
  try {
    const session = await getSession();
    if (!session?.user?._id) return null;
    const userObjectId = new ObjectId(session.user._id as string);

    const { db } = await connectToDatabase();
    const doc = await db.collection(collection).findOne({
      _id: new ObjectId(id),
      userId: userObjectId,
    } as any);
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc)) as HrJsonDoc;
  } catch (e) {
    console.error(`[getHrEntityById] read failed for ${collection}/${id}:`, e);
    return null;
  }
}

/* ─── Display helpers ────────────────────────────────────────────────── */

export function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return '—';
  return utilsFmtDate(d);
}

export function fmtCurrency(value: unknown, currency = 'INR'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function fmtNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

export function fmtBool(value: unknown): string {
  if (value === true || value === 'yes' || value === 'true') return 'Yes';
  if (value === false || value === 'no' || value === 'false') return 'No';
  return '—';
}

export function fmtText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Truncate an arbitrary id/string for display ("…1f3a"). */
export function fmtShortId(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (!s) return '—';
  return s.length > 12 ? `…${s.slice(-8)}` : s;
}
