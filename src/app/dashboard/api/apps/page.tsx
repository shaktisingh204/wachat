import { listOAuthApps, getUsageByKey } from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  StatCard,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { Boxes, Activity, TriangleAlert } from 'lucide-react';
import { AppsClient } from './_AppsClient';

import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function OAuthAppsPage(): Promise<JSX.Element> {
  return (
    <div className="20ui flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer platform</PageEyebrow>
          <PageTitle>OAuth apps</PageTitle>
          <PageDescription>
            Register third-party clients to issue scoped access tokens via the Authorization
            Code + PKCE flow. Token endpoint: <code className="font-mono">/api/v1/oauth/token</code>.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Suspense fallback={<AppsSkeleton />}>
        <AppsLoader />
      </Suspense>
    </div>
  );
}

function AppsSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton height={76} radius="var(--st-radius)" />
        <Skeleton height={76} radius="var(--st-radius)" />
        <Skeleton height={76} radius="var(--st-radius)" />
      </div>
      <Skeleton height={256} radius="var(--st-radius)" />
      <Skeleton height={140} radius="var(--st-radius)" />
      <Skeleton height={140} radius="var(--st-radius)" />
    </div>
  );
}

async function AppsLoader() {
  const [res, usageRes] = await Promise.all([
    listOAuthApps(),
    getUsageByKey()
  ]);

  if (!res.success) {
    throw new Error(res.error || 'Failed to load apps');
  }

  const initial = res.apps;
  const usageData = usageRes.success ? usageRes.rows : [];

  const totalApps = initial.length;
  const totalRequests = initial.reduce(
    (sum, a) => sum + (usageData.find((u) => u.keyId === a.clientId)?.count ?? 0),
    0,
  );
  const totalErrors = initial.reduce(
    (sum, a) => sum + (usageData.find((u) => u.keyId === a.clientId)?.errorCount ?? 0),
    0,
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Registered apps" value={String(totalApps)} icon={<Boxes />} accent="#1f9d55" />
        <StatCard
          label="Requests (30d)"
          value={totalRequests.toLocaleString('en-US')}
          icon={<Activity />}
          accent="#3b7af5"
        />
        <StatCard
          label="Errors (30d)"
          value={totalErrors.toLocaleString('en-US')}
          icon={<TriangleAlert />}
          accent="#d97706"
        />
      </div>
      <AppsClient initialApps={initial} usageData={usageData} />
    </>
  );
}
