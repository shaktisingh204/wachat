/**
 * CRM HR — Onboarding list (`/dashboard/crm/hr/onboarding`).
 *
 * Server component shell. Reads page/limit/q/status from the URL,
 * fetches via the Rust-backed `getOnboardings` action, and hands the
 * result to `<OnboardingView>` for client interactions (search,
 * status filter, delete).
 *
 * Falls back to an empty list when the user lacks the
 * `crm_onboarding:view` permission or the Rust service is unreachable
 * (the action already records a fallback metric).
 */

import { getOnboardings } from '@/app/actions/crm-onboarding.actions';
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

  const { items, hasMore } = await getOnboardings({
    page,
    limit,
    ...(q ? { q } : {}),
    ...(statusParam ? { status: statusParam as never } : {}),
  });

  return (
    <OnboardingView
      items={items}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      initialStatus={statusParam}
    />
  );
}
