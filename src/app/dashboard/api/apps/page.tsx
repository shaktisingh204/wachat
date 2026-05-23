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
  Alert,
  ZoruAlertDescription,
} from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
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
            <div className="h-64 bg-zinc-800/50 rounded-lg"></div>
            <div className="h-32 bg-zinc-800/50 rounded-lg"></div>
            <div className="h-32 bg-zinc-800/50 rounded-lg"></div>
        </div>
    );
}

async function AppsLoader() {
  const [res, usageRes] = await Promise.all([
    listOAuthApps(),
    getUsageByKey()
  ]);
  const initial = res.success ? res.apps : [];
  const loadError = res.success ? null : res.error;
  const usageData = usageRes.success ? usageRes.rows : [];
  
  if (loadError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>Failed to load apps: {loadError}</ZoruAlertDescription>
        </Alert>
      );
  }
  
  return <AppsClient initialApps={initial} usageData={usageData} />;
}
