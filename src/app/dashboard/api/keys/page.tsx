import { listDeveloperKeys, getUsageByKey, getUsageLogs } from '@/app/actions/developer-platform.actions';
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
} from '@/components/sabcrm/20ui/compat';
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>API keys</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>API keys</ZoruPageTitle>
          <ZoruPageDescription>
            Tenant-scoped Bearer tokens for server-to-server integrations. Treat them like
            passwords — they grant full programmatic access.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {loadError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>Failed to load keys: {loadError}</ZoruAlertDescription>
        </Alert>
      ) : null}

      <KeysClient initialKeys={initialKeys} usageData={usageData} logsData={logsData} />
    </div>
  );
}
