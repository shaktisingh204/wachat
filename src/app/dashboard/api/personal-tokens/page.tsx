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
} from '@/components/zoruui';
import { PatsClient } from './_PatsClient';

export const dynamic = 'force-dynamic';

export default async function PersonalTokensPage(): Promise<JSX.Element> {
  const res = await listPersonalTokens();
  
  if (!res.success) {
    throw new Error(res.error || 'Failed to load tokens');
  }

  const initial = res.tokens as Parameters<typeof PatsClient>[0]['initialTokens'];

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Personal Access Tokens</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Personal Access Tokens</ZoruPageTitle>
          <ZoruPageDescription>
            User-scoped tokens. Calls inherit your RBAC, so a PAT can only do what your account can.
            Format: <code className="font-mono">sab_pat_*</code>.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <PatsClient initialTokens={initial} />
    </div>
  );
}
