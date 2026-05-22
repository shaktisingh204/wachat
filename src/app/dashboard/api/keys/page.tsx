import { listDeveloperKeys } from '@/app/actions/developer-platform.actions';
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
import { KeysClient } from './_KeysClient';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage(): Promise<JSX.Element> {
  const res = await listDeveloperKeys();
  const initialKeys = res.success ? (res.keys as Parameters<typeof KeysClient>[0]['initialKeys']) : [];
  const loadError = res.success ? null : res.error;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>API keys</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>API keys</ZoruPageTitle>
          <ZoruPageDescription>
            Tenant-scoped Bearer tokens for server-to-server integrations. Treat them like
            passwords — they grant full programmatic access.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {loadError ? (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>Failed to load keys: {loadError}</ZoruAlertDescription>
        </ZoruAlert>
      ) : null}

      <KeysClient initialKeys={initialKeys} />
    </div>
  );
}
