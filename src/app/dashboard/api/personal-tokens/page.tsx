import { listPersonalTokens } from '@/app/actions/developer-platform.actions';
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
import { PatsClient } from './_PatsClient';

export const dynamic = 'force-dynamic';

export default async function PersonalTokensPage(): Promise<JSX.Element> {
  const res = await listPersonalTokens();
  const initial = res.success ? (res.tokens as Parameters<typeof PatsClient>[0]['initialTokens']) : [];
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
            <ZoruBreadcrumbPage>Personal Access Tokens</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Personal Access Tokens</ZoruPageTitle>
          <ZoruPageDescription>
            User-scoped tokens. Calls inherit your RBAC, so a PAT can only do what your account can.
            Format: <code className="font-mono">sab_pat_*</code>.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {loadError ? (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>Failed to load tokens: {loadError}</ZoruAlertDescription>
        </ZoruAlert>
      ) : null}

      <PatsClient initialTokens={initial} />
    </div>
  );
}
