import { listOAuthApps, getUsageByKey } from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Breadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbPage,
} from '@/components/sabcrm/20ui/compat';
import { AppsClient } from './_AppsClient';

import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function OAuthAppsPage(): Promise<JSX.Element> {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>OAuth apps</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>OAuth apps</ZoruPageTitle>
          <ZoruPageDescription>
            Register third-party clients to issue scoped access tokens via the Authorization
            Code + PKCE flow. Token endpoint: <code className="font-mono">/api/v1/oauth/token</code>.
          </ZoruPageDescription>
        </ZoruPageHeading>
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
            <div className="h-64 bg-zoru-ink/50 rounded-lg"></div>
            <div className="h-32 bg-zoru-ink/50 rounded-lg"></div>
            <div className="h-32 bg-zoru-ink/50 rounded-lg"></div>
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
