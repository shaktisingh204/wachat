import { Activity } from 'lucide-react';

import { CrmPageHeader } from '../_components/crm-page-header';
import { getUserActivities } from '@/app/actions/worksuite/chat.actions';
import type { WsUserActivity } from '@/lib/worksuite/chat-types';
import { ActivityBrowser } from './_components/activity-browser';

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
  const activities = (await getUserActivities({
    actorUserId: sp.actor || undefined,
    action: sp.action || undefined,
    resourceType: sp.resourceType || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
  })) as (WsUserActivity & { _id: string })[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="User Activity Log"
        subtitle="Audit trail of everything your teammates do."
        icon={Activity}
      />
      <ActivityBrowser
        activities={activities}
        initialFilters={{
          actor: sp.actor || '',
          action: sp.action || '',
          resourceType: sp.resourceType || '',
          from: sp.from || '',
          to: sp.to || '',
        }}
      />
    </div>
  );
}
