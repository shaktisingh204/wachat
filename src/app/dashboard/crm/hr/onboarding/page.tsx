/**
 * CRM HR — Onboarding list (`/dashboard/crm/hr/onboarding`).
 *
 * Server component shell. Reads page/limit/q/status from the URL,
 * fetches onboardings + KPIs in parallel via Rust-backed actions, and
 * passes the result to `<OnboardingView>` for client interactions
 * (search, status filter, bulk actions, export, delete).
 *
 * Falls back to empty data when the user lacks the
 * `crm_onboarding:view` permission or the Rust service is unreachable.
 */

import { getOnboardings, getOnboardingKpis } from '@/app/actions/crm-onboarding.actions';
import { OnboardingView } from './_components/onboarding-view';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const statusParam = (sp.status ?? '').trim();

  const [listResult, kpis] = await Promise.all([
    getOnboardings({
      page,
      limit,
      ...(q ? { q } : {}),
      ...(statusParam ? { status: statusParam as never } : {}),
    }),
    getOnboardingKpis(),
  ]);

  return (
    <OnboardingView
      items={listResult.items}
      page={page}
      limit={limit}
      hasMore={listResult.hasMore}
      initialQuery={q}
      initialStatus={statusParam}
      kpis={kpis}
    />
  );
}
