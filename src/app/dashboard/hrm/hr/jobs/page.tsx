/**
 * Jobs list — §1D.1 rebuild.
 *
 * KPI (4): Open · Filled · Closed · Avg time-to-fill
 * Columns (9): title, department, designation, type, openings,
 *   applicants, status, expiry, created
 * Filters (5): status, department, type, location, owner
 */

import { getJobPostings } from '@/app/actions/hr.actions';
import { JobsView } from './_components/jobs-view';

export default async function JobsPage() {
  const raw = await getJobPostings();
  const jobs = (raw as any[]).map((j) => ({ ...j, _id: String(j._id) }));
  return <JobsView initial={jobs as any} />;
}
