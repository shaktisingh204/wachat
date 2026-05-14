import { getUserActivities } from '@/app/actions/worksuite/chat.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WsUserActivity } from '@/lib/worksuite/chat-types';
import { ActivityFeed } from './_components/activity-feed';

interface PageSearchParams {
  actor?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;
  // Run independent fetches in parallel (async-parallel)
  const [activities, session] = await Promise.all([
    getUserActivities({
      actorUserId: sp.actor || undefined,
      action: sp.action || undefined,
      resourceType: sp.resourceType || undefined,
      from: sp.from || undefined,
      to: sp.to || undefined,
    }) as Promise<(WsUserActivity & { _id: string })[]>,
    getSession(),
  ]);

  return (
    <ActivityFeed
      activities={activities}
      currentUserId={session?.user?._id ? String(session.user._id) : undefined}
      initialFilters={{
        actor: sp.actor || '',
        action: sp.action || '',
        resourceType: sp.resourceType || '',
        from: sp.from || '',
        to: sp.to || '',
      }}
    />
  );
}
