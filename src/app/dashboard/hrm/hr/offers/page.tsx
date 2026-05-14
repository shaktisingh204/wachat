/**
 * Offers list — §1D.1 rebuild.
 *
 * KPI (5): Draft · Sent · Accepted · Rejected · Expired
 * Columns (9): candidate, designation, department, CTC, variable %,
 *   joining, status, validity, sent at
 * Filters (5): status, candidate, job, joining from, min CTC
 */

import { getOfferLetters } from '@/app/actions/hr.actions';
import { OffersView } from './_components/offers-view';

export default async function OffersPage() {
  const raw = await getOfferLetters();
  const offers = (raw as any[]).map((o) => ({ ...o, _id: String(o._id) }));
  return <OffersView initial={offers as any} />;
}
