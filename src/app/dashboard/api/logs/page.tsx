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
  Table,
  ZoruTableHeader,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableCell,
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
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Request log</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Request log</ZoruPageTitle>
          <ZoruPageDescription>
            Last 30 days. Filter via query string:{' '}
            <code className="font-mono">?keyId=…</code>,{' '}
            <code className="font-mono">?path=…</code>,{' '}
            <code className="font-mono">?minStatus=400</code>.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruCard>
        <ZoruCardContent className="pt-4">
          <form method="get" className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <ZoruInput
              name="path"
              defaultValue={params.path ?? ''}
              placeholder="path (e.g. /api/v1/me)"
              className="font-mono"
            />
            <ZoruInput
              name="keyId"
              defaultValue={params.keyId ?? ''}
              placeholder="key id"
              className="font-mono"
            />
            <ZoruInput
              name="minStatus"
              type="number"
              defaultValue={params.minStatus ?? ''}
              placeholder="min status (e.g. 400)"
            />
            <ZoruButton type="submit">
              <Filter className="h-4 w-4 mr-1" /> Filter
            </ZoruButton>
          </form>
        </ZoruCardContent>
      </ZoruCard>

      {!res.success ? (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertDescription>{res.error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          <ZoruCard>
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>When</ZoruTableHead>
                  <ZoruTableHead>Method</ZoruTableHead>
                  <ZoruTableHead>Path</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Latency</ZoruTableHead>
                  <ZoruTableHead>Key</ZoruTableHead>
                  <ZoruTableHead>Error</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {res.rows.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell colSpan={7} className="text-center text-zoru-ink-muted py-8 text-sm">
                      No requests match the current filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : null}
                {res.rows.map((r) => (
                  <ZoruTableRow key={r._id}>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">{new Date(r.ts).toLocaleString()}</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs text-zoru-ink">{r.method}</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs text-zoru-ink">{r.path}</ZoruTableCell>
                    <ZoruTableCell>
                      <span
                        className={
                          r.status >= 500
                            ? 'text-zoru-danger text-xs font-medium'
                            : r.status >= 400
                              ? 'text-zoru-warning text-xs font-medium'
                              : r.status >= 300
                                ? 'text-blue-400 text-xs font-medium'
                                : 'text-zoru-success text-xs font-medium'
                        }
                      >
                        {r.status}
                      </span>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">{r.latencyMs} ms</ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs text-zoru-ink-subtle">{r.keyId.slice(0, 10)}…</ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">{r.errorType ?? ''}</ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          </ZoruCard>

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
