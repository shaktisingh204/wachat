import { Activity } from 'lucide-react';

import {
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
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
      <ZoruPageHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Activity className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <ZoruPageHeading>
            <ZoruPageTitle>User Activity Log</ZoruPageTitle>
            <ZoruPageDescription>Audit trail of everything your teammates do.</ZoruPageDescription>
          </ZoruPageHeading>
        </div>
      </ZoruPageHeader>
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
