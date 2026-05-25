import { Suspense } from 'react';
/**
 * Candidates list — §1D.1 rebuild.
 *
 * Server component loads the candidates once via `getCandidates()` and
 * hands them to the client `<CandidatesView />` which handles search,
 * filters, KPI strip, view switching (table / kanban), bulk delete and
 * pagination.
 *
 * Per spec the page ships:
 *   • KPI (5): Total · New · In review · Offer · Hired
 *   • 8 columns (name+photo, job, stage, source, score, last activity,
 *     email, phone)
 *   • 6 filters (stage, job, source, owner, min score, applied-from)
 *   • Bulk bar (export + delete)
 *   • View switcher (table / kanban-by-stage)
 *   • +New CTA → /candidates/new
 *
 * TODO 1D.4: kanban drag-between-columns optimistic update —
 *   depends on `updateCandidateStage` action.
 */

import { getCandidates } from '@/app/actions/hr.actions';
import { CandidatesView } from './_components/candidates-view';

export const dynamic = 'force-dynamic';

async function CandidatesPageContainer() {
  const raw = await getCandidates();
  const candidates = (raw as any[]).map((c) => ({
    ...c,
    _id: String(c._id),
  }));
  return <CandidatesView initial={candidates as any} />;
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CandidatesPageContainer  />
    </Suspense>
  );
}
