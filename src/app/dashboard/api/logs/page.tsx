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
  Button,
  Input,
  Badge,
} from '@/components/zoruui';
import { AlertCircle, Filter } from 'lucide-react';

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
            Last 30 days. Filter via query string:{' '}
            <code className="font-mono">?keyId=…</code>,{' '}
            <code className="font-mono">?path=…</code>,{' '}
            <code className="font-mono">?minStatus=400</code>.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardContent className="pt-4">
          <form method="get" className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <Input
              name="path"
              defaultValue={params.path ?? ''}
              placeholder="path (e.g. /api/v1/me)"
              className="font-mono"
            />
            <Input
              name="keyId"
              defaultValue={params.keyId ?? ''}
              placeholder="key id"
              className="font-mono"
            />
            <Input
              name="minStatus"
              type="number"
              defaultValue={params.minStatus ?? ''}
              placeholder="min status (e.g. 400)"
            />
            <Button type="submit">
              <Filter className="h-4 w-4 mr-1" /> Filter
            </Button>
          </form>
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
                {res.rows.length === 0 ? (
                  <div className="text-center text-zoru-ink-muted py-8 text-sm">
                    No requests match the current filter.
                  </div>
                ) : (
                  <ol className="relative space-y-6 border-l border-zinc-200 pl-6 dark:border-zinc-800">
                    {res.rows.map((r) => (
                        <li key={r._id} className="relative">
                            <span
                                className="absolute -left-[29px] top-1.5 inline-block size-3 rounded-full border border-white dark:border-zinc-950 bg-zinc-300 dark:bg-zinc-700"
                                aria-hidden
                            />
                            <div className="flex flex-wrap items-baseline gap-2 text-sm mb-1">
                                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                    {r.method}
                                </Badge>
                                <span className="font-mono text-zoru-ink">{r.path}</span>
                                <span
                                    className={
                                      r.status >= 500
                                        ? 'text-zoru-danger text-xs font-semibold px-1.5 py-0.5 rounded bg-red-500/10'
                                        : r.status >= 400
                                          ? 'text-zoru-warning text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/10'
                                          : r.status >= 300
                                            ? 'text-blue-500 text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/10'
                                            : 'text-zoru-success text-xs font-semibold px-1.5 py-0.5 rounded bg-green-500/10'
                                    }
                                >
                                    {r.status}
                                </span>
                                <span className="ml-auto text-xs text-zoru-ink-muted">
                                    {new Date(r.ts).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-zoru-ink-muted">
                                <span>Latency: <span className="font-mono">{r.latencyMs} ms</span></span>
                                <span>Key ID: <span className="font-mono text-zoru-ink-subtle">{r.keyId.slice(0, 10)}…</span></span>
                                {r.errorType && (
                                    <span className="text-zoru-danger">Error: {r.errorType}</span>
                                )}
                            </div>
                        </li>
                    ))}
                  </ol>
                )}
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
