import { listOAuthApps, getUsageByKey } from '@/app/actions/developer-platform.actions';
import { PageHeader, PageHeading, PageTitle, PageDescription, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/sabcrm/20ui';
import { AppsClient } from './_AppsClient';

import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function OAuthAppsPage(): Promise<JSX.Element> {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>OAuth apps</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
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

function AppsSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="h-64 bg-[var(--st-text)]/50 rounded-lg"></div>
            <div className="h-32 bg-[var(--st-text)]/50 rounded-lg"></div>
            <div className="h-32 bg-[var(--st-text)]/50 rounded-lg"></div>
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
  
  return <AppsClient initialApps={initial} usageData={usageData} />;
}
