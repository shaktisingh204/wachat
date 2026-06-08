import Link from 'next/link';
import { getUsageLogs } from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  StatCard,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
} from '@/components/sabcrm/20ui';
import { ArrowRight, Filter, ScrollText, ListChecks, TriangleAlert } from 'lucide-react';
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

  const rows = res.success ? res.rows : [];
  const errorCount = rows.filter((r) => r.status >= 400).length;

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
    <div className="20ui flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer platform</PageEyebrow>
          <PageTitle>Request log</PageTitle>
          <PageDescription>
            Every API request your tenant made in the last 30 days. Filter by path, key, or status
            to narrow the timeline.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Requests in view"
          value={rows.length.toLocaleString('en-US')}
          icon={<ListChecks />}
          accent="#3b7af5"
        />
        <StatCard
          label="Errors in view"
          value={errorCount.toLocaleString('en-US')}
          icon={<TriangleAlert />}
          accent="#d97706"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardBody>
          <LogFilter />
        </CardBody>
      </Card>

      {!res.success ? (
        <Alert tone="danger" title="Could not load logs">
          {res.error}
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardBody>
              <LogTimeline logs={rows} />
            </CardBody>
          </Card>

          {nextUrl ? (
            <div className="flex justify-end">
              <Link
                href={nextUrl}
                className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
              >
                Next page
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
