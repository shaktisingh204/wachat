/**
 * /dashboard/crm/activity — tenant-wide audit feed (CRM_REBUILD_PLAN.md §5.4).
 *
 * Server Component. Reads `entityKind`, `actorId`, `from`, `to`, `cursor`
 * from `searchParams`, calls `getCrmActivityFeed`, and hands a fully
 * paginated page off to the `<ActivityFeedClient>` client shell.
 *
 * Data source: `crm_audit_log` Mongo collection. The same collection
 * that powers each entity's detail-page `<EntityAuditTimeline>` footer.
 */

import { getSession } from '@/app/actions/user.actions';
import {
    getCrmActivityFeed,
    type CrmActivityFeedFilters,
} from '@/app/actions/crm-activity.actions';

import { ActivityFeedClient } from './_components/activity-feed-client';

interface PageSearchParams {
    entityKind?: string;
    actorId?: string;
    from?: string;
    to?: string;
    cursor?: string;
}

export const dynamic = 'force-dynamic';

export default async function CrmActivityPage({
    searchParams,
}: {
    searchParams: Promise<PageSearchParams>;
}) {
    const sp = await searchParams;

    const filters: CrmActivityFeedFilters = {
        entityKind: sp.entityKind || undefined,
        actorId: sp.actorId || undefined,
        from: sp.from || undefined,
        to: sp.to || undefined,
        cursor: sp.cursor || undefined,
        limit: 50,
    };

    // Independent reads — run in parallel.
    const [feed, session] = await Promise.all([
        getCrmActivityFeed(filters),
        getSession(),
    ]);

    return (
        <ActivityFeedClient
            initialFeed={feed}
            currentUserId={session?.user?._id ? String(session.user._id) : undefined}
            initialFilters={{
                entityKind: sp.entityKind ?? '',
                actorId: sp.actorId ?? '',
                from: sp.from ?? '',
                to: sp.to ?? '',
            }}
        />
    );
}
