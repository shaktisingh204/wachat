import { listOAuthApps } from '@/app/actions/developer-platform.actions';
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

export const dynamic = 'force-dynamic';

export default async function OAuthAppsPage(): Promise<JSX.Element> {
  const res = await listOAuthApps();
  const initial = res.success ? res.apps : [];
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
            <ZoruBreadcrumbPage>OAuth apps</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>OAuth apps</ZoruPageTitle>
          <ZoruPageDescription>
            Register third-party clients to issue scoped access tokens via the Authorization
            Code + PKCE flow. Token endpoint: <code className="font-mono">/api/v1/oauth/token</code>.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {loadError ? (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>Failed to load apps: {loadError}</ZoruAlertDescription>
        </ZoruAlert>
      ) : null}

      <AppsClient initialApps={initial} />
    </div>
  );
}
