import { listPersonalTokens } from '@/app/actions/developer-platform.actions';
import { PageHeader, PageHeading, PageTitle, PageDescription, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/sabcrm/20ui/compat';
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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Personal Access Tokens</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Personal Access Tokens</PageTitle>
          <PageDescription>
            User-scoped tokens. Calls inherit your RBAC, so a PAT can only do what your account can.
            Format: <code className="font-mono">sab_pat_*</code>.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <PatsClient initialTokens={initial} />
    </div>
  );
}
