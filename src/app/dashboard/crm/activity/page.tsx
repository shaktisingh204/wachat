/**
 * /dashboard/crm/activity — tenant-wide activity feed + structured activities.
 *
 * Server component. Reads `entityKind`, `actorId`, `from`, `to`, `cursor`
 * from searchParams and pre-fetches:
 *  - Feed (audit log rows) via getCrmActivityFeed
 *  - Structured activities (crm_activities collection) via listCrmActivities
 *  - KPI strip via getCrmActivityPageKpis
 *
 * All reads run in parallel.
 */

import { getSession } from '@/app/actions/user.actions';
import {
  getCrmActivityFeed,
  listCrmActivities,
  getCrmActivityPageKpis,
  type CrmActivityFeedFilters,
} from '@/app/actions/crm-activity.actions';
import { ActivityPageClient } from './_components/activity-page-client';

export const dynamic = 'force-dynamic';

interface PageSearchParams {
  entityKind?: string;
  actorId?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export default async function CrmActivityPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;

  const feedFilters: CrmActivityFeedFilters = {
    entityKind: sp.entityKind || undefined,
    actorId: sp.actorId || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    cursor: sp.cursor || undefined,
    limit: 50,
  };

  const [feed, kpis, activities, session] = await Promise.all([
    getCrmActivityFeed(feedFilters),
    getCrmActivityPageKpis(),
    listCrmActivities({ page: 1, pageSize: 50 }),
    getSession(),
  ]);

  return (
    <ActivityPageClient
      initialFeed={feed}
      currentUserId={session?.user?._id ? String(session.user._id) : undefined}
      initialFilters={{
        entityKind: sp.entityKind ?? '',
        actorId: sp.actorId ?? '',
        from: sp.from ?? '',
        to: sp.to ?? '',
      }}
      kpis={kpis}
      initialActivities={activities}
    />
  );
}
