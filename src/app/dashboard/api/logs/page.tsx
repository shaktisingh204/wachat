import Link from 'next/link';
import { getUsageLogs } from '@/app/actions/developer-platform.actions';
import { PageHeader, PageHeading, PageTitle, PageDescription, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage, Alert, AlertDescription, Card, CardBody } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { LogFilter } from './components/log-filter';
import { LogTimeline } from './components/log-timeline';

export const dynamic = 'force-dynamic';

interface SearchParams {
  keyId?: string;
  path?: string;
  minStatus?: string;
  cursor?: string;
  limit?: string;
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<JSX.Element> {
  const params = await searchParams;
  const limit = params.limit ? Math.min(Math.max(Number(params.limit) || 50, 1), 200) : 50;
  const minStatus = params.minStatus ? Number(params.minStatus) : undefined;

  const res = await getUsageLogs({
    keyId: params.keyId,
    path: params.path,
    minStatus: Number.isFinite(minStatus) ? minStatus : undefined,
    cursor: params.cursor,
    limit,
  });

  const nextUrl = res.success && res.nextCursor
    ? '/dashboard/api/logs?' +
      new URLSearchParams({
        ...(params.keyId ? { keyId: params.keyId } : {}),
        ...(params.path ? { path: params.path } : {}),
        ...(params.minStatus ? { minStatus: params.minStatus } : {}),
        cursor: res.nextCursor,
        limit: String(limit),
      }).toString()
    : null;

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Request log</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Request log</PageTitle>
          <PageDescription>
            Last 30 days. Filter logs by providing specific criteria.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card>
        <CardBody className="pt-4">
          <LogFilter />
        </CardBody>
      </Card>

      {!res.success ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{res.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardBody className="pt-6">
              <LogTimeline logs={res.rows} />
            </CardBody>
          </Card>

          {nextUrl ? (
            <div className="flex justify-end">
              <Link
                href={nextUrl}
                className="text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)] underline underline-offset-2"
              >
                Next page →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
