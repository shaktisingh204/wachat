/**
 * Probation list — §1D.1 rebuild.
 *
 * KPI (4): Active · Ending this month · Confirmed · Extended
 * Columns (8): employee, reviewer, start, end, status, score, mid
 *   review, extension
 * Filters (5): status, reviewer, min score, end from, employee
 */

import { getProbations } from '@/app/actions/hr.actions';
import { ProbationView } from './_components/probation-view';

export default async function ProbationPage() {
  const raw = await getProbations();
  const probations = (raw as any[]).map((p) => ({ ...p, _id: String(p._id) }));
  return <ProbationView initial={probations as any} />;
}
