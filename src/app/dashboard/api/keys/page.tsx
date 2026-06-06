import { listDeveloperKeys, getUsageByKey, getUsageLogs } from '@/app/actions/developer-platform.actions';
import { PageHeader, PageHeading, PageTitle, PageDescription, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage, Alert, AlertDescription } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { KeysClient } from './_KeysClient';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage(): Promise<JSX.Element> {
  const [res, usageRes, logsRes] = await Promise.all([
    listDeveloperKeys(),
    getUsageByKey(),
    getUsageLogs({ limit: 10 })
  ]);
  const initialKeys = res.success ? (res.keys as Parameters<typeof KeysClient>[0]['initialKeys']) : [];
  const usageData = usageRes.success ? usageRes.rows : [];
  const logsData = logsRes.success ? logsRes.rows : [];
  const loadError = res.success ? null : res.error;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>API keys</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>API keys</PageTitle>
          <PageDescription>
            Tenant-scoped Bearer tokens for server-to-server integrations. Treat them like
            passwords — they grant full programmatic access.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load keys: {loadError}</AlertDescription>
        </Alert>
      ) : null}

      <KeysClient initialKeys={initialKeys} usageData={usageData} logsData={logsData} />
    </div>
  );
}
