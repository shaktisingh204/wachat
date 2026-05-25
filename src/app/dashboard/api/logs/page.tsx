import Link from 'next/link';
import { getUsageLogs } from '@/app/actions/developer-platform.actions';
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
  Card,
  ZoruCardContent,
} from '@/components/zoruui';
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Request log</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Request log</ZoruPageTitle>
          <ZoruPageDescription>
            Last 30 days. Filter logs by providing specific criteria.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardContent className="pt-4">
          <LogFilter />
        </ZoruCardContent>
      </Card>

      {!res.success ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>{res.error}</ZoruAlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <ZoruCardContent className="pt-6">
              <LogTimeline logs={res.rows} />
            </ZoruCardContent>
          </Card>

          {nextUrl ? (
            <div className="flex justify-end">
              <Link
                href={nextUrl}
                className="text-xs text-zoru-ink-muted hover:text-zoru-ink underline underline-offset-2"
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
