export const dynamic = 'force-dynamic';
/**
 * Interviews list — §1D.1 rebuild.
 *
 * KPI (4): Today · This week · Pending feedback · Cancelled
 * Columns (8): candidate, round, mode, panel, slot, status, score, link
 * Filters (5): status, mode, from-date, candidate, panel
 * Views: table | calendar (by slot date)
 */

import { getInterviews } from '@/app/actions/hr.actions';
import { InterviewsView } from './_components/interviews-view';

export default async function InterviewsPage() {
  const raw = await getInterviews();
  const interviews = (raw as any[]).map((i) => ({
    ...i,
    _id: String(i._id),
  }));
  return <InterviewsView initial={interviews as any} />;
}
