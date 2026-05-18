/**
 * Onboarding list — §1D.1 rebuild.
 *
 * KPI (4): In progress · Completed · Overdue · Avg completion days
 * Columns (8): employee, task, category, progress, owner, due,
 *   status, created
 * Filters (5): status, category, employee, owner, due-from
 */

import { getOnboardingTemplates } from '@/app/actions/hr.actions';
import { OnboardingView } from './_components/onboarding-view';

export default async function OnboardingPage() {
  const raw = await getOnboardingTemplates();
  const onboardings = (raw as any[]).map((o) => ({
    ...o,
    _id: String(o._id),
  }));
  return <OnboardingView initial={onboardings as any} />;
}
